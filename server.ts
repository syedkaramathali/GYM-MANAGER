import 'dotenv/config';
import express, { Request, Response } from 'express';
import cron from 'node-cron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  calculateExpiryDate,
  createMemberPaymentRecord,
  createMemberRecord,
  deleteMemberRecord,
  getDashboardData,
  getMemberHistory,
  getMemberPaymentsByOwner,
  getMembersByOwner,
  getSubscriptionHistoryByOwner,
  getWhatsappLogsByOwner,
  markMemberPaymentPaid,
  renewMemberRecord,
  updateMemberRecord,
  updateOwnerRegistration,
} from './src/db/queries.ts';
import { AuthRequest, requireAuth } from './src/middleware/auth.ts';
import {
  createRazorpaySubscriptionOrder,
  isRazorpayConfigured,
  SUBSCRIPTION_PLANS,
  verifyAndProcessWebhook,
  verifyCheckoutSignatureAndActivate,
} from './src/services/razorpay.ts';
import {
  buildReminderMessage,
  checkAndNotifySingleMember,
  dispatchWhatsAppMessage,
  isWhatsAppConfigured,
  runAutomatedExpiryNotifications,
} from './src/services/whatsapp.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Razorpay Webhook MUST receive raw Buffer body before express.json() parses it
app.post(
  '/api/webhooks/razorpay',
  express.raw({ type: 'application/json' }),
  async (req: Request, res: Response) => {
    try {
      const signature = req.headers['x-razorpay-signature'] as string | undefined;
      const rawBody = Buffer.isBuffer(req.body)
        ? req.body
        : Buffer.from(JSON.stringify(req.body));
      const result = await verifyAndProcessWebhook(rawBody, signature);
      res.json(result);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Webhook verification failed';
      console.error('Razorpay webhook error:', message);
      res.status(400).json({ error: message });
    }
  }
);

app.use(express.json({ limit: '5mb' }));

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ ok: true });
});

// Owner profile & registration routes
app.get('/api/owner/me', requireAuth, async (req: AuthRequest, res: Response) => {
  res.json({
    owner: req.owner,
    integrations: {
      whatsappConfigured: isWhatsAppConfigured(),
      razorpayConfigured: isRazorpayConfigured(),
    },
  });
});

app.post(
  '/api/owner/register',
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.owner) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { ownerName, gymName, mobileNumber, email, profilePhoto } = req.body as {
        ownerName?: string;
        gymName?: string;
        mobileNumber?: string;
        email?: string;
        profilePhoto?: string | null;
      };

      if (!ownerName?.trim() || !gymName?.trim() || !mobileNumber?.trim()) {
        res.status(400).json({
          error: 'Owner name, gym name, and mobile number are required.',
        });
        return;
      }

      const updated = await updateOwnerRegistration(req.owner.id, {
        ownerName,
        gymName,
        mobileNumber,
        email: email || req.owner.email,
        profilePhoto,
      });

      res.json({ owner: updated });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Registration failed';
      res.status(500).json({ error: msg });
    }
  }
);

app.put(
  '/api/owner/profile',
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.owner) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { ownerName, gymName, mobileNumber, email, profilePhoto } = req.body as {
        ownerName?: string;
        gymName?: string;
        mobileNumber?: string;
        email?: string;
        profilePhoto?: string | null;
      };

      if (!ownerName?.trim() || !gymName?.trim() || !mobileNumber?.trim()) {
        res.status(400).json({
          error: 'Owner name, gym name, and mobile number are required.',
        });
        return;
      }

      const updated = await updateOwnerRegistration(req.owner.id, {
        ownerName,
        gymName,
        mobileNumber,
        email: email?.trim() || req.owner.email,
        profilePhoto,
      });

      res.json({ owner: updated });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to update owner profile';
      res.status(500).json({ error: msg });
    }
  }
);

// Dashboard overview (automatically evaluates due/expired WhatsApp alerts for this gym)
app.get('/api/dashboard', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.owner) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    await runAutomatedExpiryNotifications(req.owner.id).catch((err) =>
      console.error('Auto WhatsApp check on dashboard failed:', err)
    );
    const data = await getDashboardData(req.owner.id);
    res.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to load dashboard';
    res.status(500).json({ error: msg });
  }
});

// Members CRUD & Management
app.get('/api/members', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.owner) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const status = typeof req.query.status === 'string' ? req.query.status : 'all';

    const list = await getMembersByOwner(req.owner.id, search);
    const filtered =
      status === 'active'
        ? list.filter((m) => m.membershipState === 'active' || m.membershipState === 'expiring_soon')
        : status === 'expiring_soon'
        ? list.filter((m) => m.membershipState === 'expiring_soon')
        : status === 'expired'
        ? list.filter((m) => m.membershipState === 'expired')
        : list;

    res.json({ members: filtered });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to load members';
    res.status(500).json({ error: msg });
  }
});

app.post('/api/members', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.owner) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const body = req.body as {
      fullName?: string;
      mobileNumber?: string;
      whatsappNumber?: string;
      age?: number;
      gender?: string;
      startDate?: string;
      durationMonths?: number;
      durationLabel?: string;
      expiryDate?: string;
      membershipAmount?: number;
      paymentStatus?: string;
      paymentMethod?: string;
      profilePhoto?: string | null;
    };

    if (
      !body.fullName?.trim() ||
      !body.mobileNumber?.trim() ||
      !body.whatsappNumber?.trim() ||
      !body.startDate ||
      !body.durationMonths ||
      body.membershipAmount === undefined
    ) {
      res.status(400).json({ error: 'Please complete all required member fields.' });
      return;
    }

    const durationMonths = Number(body.durationMonths);
    const expiryDate =
      body.expiryDate || calculateExpiryDate(body.startDate, durationMonths);

    const created = await createMemberRecord(req.owner.id, {
      fullName: body.fullName,
      mobileNumber: body.mobileNumber,
      whatsappNumber: body.whatsappNumber,
      age: Number(body.age || 25),
      gender: body.gender || 'Male',
      startDate: body.startDate,
      durationMonths,
      durationLabel: body.durationLabel || `${durationMonths} Month(s)`,
      expiryDate,
      membershipAmount: Number(body.membershipAmount),
      paymentStatus: body.paymentStatus || 'Paid',
      paymentMethod: body.paymentMethod || 'Cash',
      profilePhoto: body.profilePhoto || null,
    });

    const autoNotify = await checkAndNotifySingleMember(
      created,
      req.owner.gymName
    ).catch((err) => {
      console.error('Auto WhatsApp check on member create failed:', err);
      return null;
    });

    res.status(201).json({
      member: created,
      autoWhatsapp: autoNotify && !autoNotify.skipped ? autoNotify.log : null,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to add member';
    res.status(500).json({ error: msg });
  }
});

app.put('/api/members/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.owner) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const memberId = Number(req.params.id);
    if (!Number.isFinite(memberId)) {
      res.status(400).json({ error: 'Invalid member ID.' });
      return;
    }

    const body = req.body as {
      fullName: string;
      mobileNumber: string;
      whatsappNumber: string;
      age: number;
      gender: string;
      startDate: string;
      durationMonths: number;
      durationLabel: string;
      expiryDate: string;
      membershipAmount: number;
      paymentStatus: string;
      profilePhoto?: string | null;
    };

    const updated = await updateMemberRecord(req.owner.id, memberId, body);
    if (!updated) {
      res.status(404).json({ error: 'Member not found.' });
      return;
    }

    const autoNotify = await checkAndNotifySingleMember(
      updated,
      req.owner.gymName
    ).catch((err) => {
      console.error('Auto WhatsApp check on member update failed:', err);
      return null;
    });

    res.json({
      member: updated,
      autoWhatsapp: autoNotify && !autoNotify.skipped ? autoNotify.log : null,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to update member';
    res.status(500).json({ error: msg });
  }
});

app.delete(
  '/api/members/:id',
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.owner) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const memberId = Number(req.params.id);
      if (!Number.isFinite(memberId)) {
        res.status(400).json({ error: 'Invalid member ID.' });
        return;
      }
      const deleted = await deleteMemberRecord(req.owner.id, memberId);
      if (!deleted) {
        res.status(404).json({ error: 'Member not found.' });
        return;
      }
      res.json({ deletedId: deleted.id });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to delete member';
      res.status(500).json({ error: msg });
    }
  }
);

app.get(
  '/api/members/:id/history',
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.owner) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const memberId = Number(req.params.id);
      if (!Number.isFinite(memberId)) {
        res.status(400).json({ error: 'Invalid member ID.' });
        return;
      }
      const details = await getMemberHistory(req.owner.id, memberId);
      if (!details) {
        res.status(404).json({ error: 'Member not found.' });
        return;
      }
      res.json(details);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to load history';
      res.status(500).json({ error: msg });
    }
  }
);

// One-click Membership Renewal + Automatic WhatsApp Confirmation
app.post(
  '/api/members/:id/renew',
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.owner) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const memberId = Number(req.params.id);
      if (!Number.isFinite(memberId)) {
        res.status(400).json({ error: 'Invalid member ID.' });
        return;
      }

      const body = req.body as {
        durationMonths?: number;
        durationLabel?: string;
        amount?: number;
        paymentStatus?: string;
        paymentMethod?: string;
      };

      const renewed = await renewMemberRecord(req.owner.id, memberId, {
        durationMonths: Number(body.durationMonths || 1),
        durationLabel: body.durationLabel || `${body.durationMonths || 1} Month(s)`,
        amount: Number(body.amount || 0),
        paymentStatus: body.paymentStatus || 'Paid',
        paymentMethod: body.paymentMethod || 'UPI',
      });

      if (!renewed) {
        res.status(404).json({ error: 'Member not found.' });
        return;
      }

      const messageBody = buildReminderMessage(
        renewed.member.fullName,
        'renewal_confirmation',
        req.owner.gymName,
        renewed.member.expiryDate
      );

      const whatsappResult = await dispatchWhatsAppMessage({
        ownerId: req.owner.id,
        memberId: renewed.member.id,
        recipientPhone: renewed.member.whatsappNumber,
        triggerType: 'renewal_confirmation',
        targetExpiryDate: renewed.member.expiryDate,
        messageBody,
        allowDuplicate: true,
      });

      res.json({
        member: renewed.member,
        receipt: renewed.receipt,
        whatsappLog: whatsappResult.log,
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Renewal failed';
      res.status(500).json({ error: msg });
    }
  }
);

// Member Payments & Receipts
app.get('/api/payments', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.owner) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const payments = await getMemberPaymentsByOwner(req.owner.id);
    res.json({ payments });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to fetch payments';
    res.status(500).json({ error: msg });
  }
});

app.post('/api/payments', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.owner) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const body = req.body as {
      memberId?: number;
      amount?: number;
      paymentMethod?: string;
      paymentStatus?: string;
      notes?: string;
    };

    if (!body.memberId || body.amount === undefined) {
      res.status(400).json({ error: 'Member and amount are required.' });
      return;
    }

    const payment = await createMemberPaymentRecord(req.owner.id, {
      memberId: Number(body.memberId),
      amount: Number(body.amount),
      paymentMethod: body.paymentMethod || 'Cash',
      paymentStatus: body.paymentStatus || 'Paid',
      notes: body.notes,
    });

    if (!payment) {
      res.status(404).json({ error: 'Member not found.' });
      return;
    }

    res.status(201).json({ payment });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to record payment';
    res.status(500).json({ error: msg });
  }
});

app.patch(
  '/api/payments/:id/mark-paid',
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.owner) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const paymentId = Number(req.params.id);
      if (!Number.isFinite(paymentId)) {
        res.status(400).json({ error: 'Invalid payment ID.' });
        return;
      }
      const updated = await markMemberPaymentPaid(req.owner.id, paymentId);
      if (!updated) {
        res.status(404).json({ error: 'Payment record not found.' });
        return;
      }
      res.json({ payment: updated });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to update payment';
      res.status(500).json({ error: msg });
    }
  }
);

// WhatsApp Business Cloud API Notification Routes
app.get(
  '/api/whatsapp/logs',
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.owner) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const logs = await getWhatsappLogsByOwner(req.owner.id);
      res.json({
        logs,
        configured: isWhatsAppConfigured(),
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to load logs';
      res.status(500).json({ error: msg });
    }
  }
);

app.post(
  '/api/whatsapp/run-reminders',
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.owner) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const summary = await runAutomatedExpiryNotifications(req.owner.id);
      res.json({ summary, configured: isWhatsAppConfigured() });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Reminder run failed';
      res.status(500).json({ error: msg });
    }
  }
);

app.post(
  '/api/whatsapp/send-manual',
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.owner) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const body = req.body as {
        memberId?: number;
        messageBody?: string;
      };

      if (!body.memberId) {
        res.status(400).json({ error: 'Member ID is required.' });
        return;
      }

      const details = await getMemberHistory(req.owner.id, Number(body.memberId));
      if (!details) {
        res.status(404).json({ error: 'Member not found.' });
        return;
      }

      const text =
        body.messageBody?.trim() ||
        buildReminderMessage(
          details.member.fullName,
          details.member.daysRemaining <= 0
            ? 'expiry_day'
            : details.member.daysRemaining === 1
            ? '1_day'
            : details.member.daysRemaining <= 3
            ? '3_days'
            : '7_days',
          req.owner.gymName,
          details.member.expiryDate
        );

      const result = await dispatchWhatsAppMessage({
        ownerId: req.owner.id,
        memberId: details.member.id,
        recipientPhone: details.member.whatsappNumber,
        triggerType: 'manual',
        targetExpiryDate: details.member.expiryDate,
        messageBody: text,
        allowDuplicate: true,
      });

      res.json({ log: result.log, configured: isWhatsAppConfigured() });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to send message';
      res.status(500).json({ error: msg });
    }
  }
);

// Gym Owner Razorpay Subscription Billing Routes
app.get('/api/billing/plans', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.owner) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const transactions = await getSubscriptionHistoryByOwner(req.owner.id);
    res.json({
      plans: Object.values(SUBSCRIPTION_PLANS),
      razorpayConfigured: isRazorpayConfigured(),
      subscription: {
        plan: req.owner.subscriptionPlan,
        status: req.owner.subscriptionStatus,
        expiresAt: req.owner.subscriptionExpiresAt,
      },
      transactions,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to load billing';
    res.status(500).json({ error: msg });
  }
});

app.post(
  '/api/billing/create-order',
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.owner) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const { planId } = req.body as { planId?: string };
      if (!planId || !SUBSCRIPTION_PLANS[planId]) {
        res.status(400).json({ error: 'Invalid subscription plan selected.' });
        return;
      }

      const order = await createRazorpaySubscriptionOrder(req.owner, planId);
      res.json(order);
    } catch (error: unknown) {
      const code = error instanceof Error ? error.message : 'ORDER_CREATION_FAILED';
      if (code === 'RAZORPAY_NOT_CONFIGURED') {
        res.status(503).json({
          code: 'RAZORPAY_NOT_CONFIGURED',
          error:
            'Razorpay credentials (RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET) are not configured on the server.',
        });
        return;
      }
      res.status(500).json({ error: 'Failed to create Razorpay order.' });
    }
  }
);

app.post(
  '/api/billing/verify-payment',
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.owner) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        paymentMethod,
      } = req.body as {
        razorpay_order_id?: string;
        razorpay_payment_id?: string;
        razorpay_signature?: string;
        paymentMethod?: string;
      };

      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        res.status(400).json({
          error: 'Missing Razorpay verification parameters.',
        });
        return;
      }

      const verification = await verifyCheckoutSignatureAndActivate(req.owner.id, {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        paymentMethod,
      });

      res.json({
        verified: true,
        transaction: verification.transaction,
        owner: verification.owner,
      });
    } catch (error: unknown) {
      const code = error instanceof Error ? error.message : 'VERIFICATION_FAILED';
      const status =
        code === 'INVALID_SIGNATURE' || code === 'ORDER_OWNERSHIP_MISMATCH'
          ? 400
          : 500;
      res.status(status).json({
        verified: false,
        error:
          code === 'INVALID_SIGNATURE'
            ? 'Payment signature verification failed. Subscription was not activated.'
            : 'Unable to verify Razorpay payment.',
      });
    }
  }
);

// Automated hourly WhatsApp expiry notification cron job (catches expiries promptly with deduplication)
cron.schedule('0 * * * *', () => {
  console.log('[GymManager Scheduler] Running hourly WhatsApp membership expiry check...');
  runAutomatedExpiryNotifications()
    .then((summary) => {
      console.log('[GymManager Scheduler] Completed:', summary);
    })
    .catch((err) => {
      console.error('[GymManager Scheduler] Error:', err);
    });
});

// Run an automatic expiry check shortly after server startup
setTimeout(() => {
  runAutomatedExpiryNotifications()
    .then((summary) => {
      console.log('[GymManager Startup Check] Completed:', summary);
    })
    .catch((err) => {
      console.error('[GymManager Startup Check] Error:', err);
    });
}, 5000);

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`GymManager server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
