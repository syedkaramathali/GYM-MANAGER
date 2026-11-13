import crypto from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import Razorpay from 'razorpay';
import { db } from '../db/index.ts';
import { generateReceiptNumber } from '../db/queries.ts';
import { subscriptionPayments, users } from '../db/schema.ts';
import type { OwnerRecord } from '../middleware/auth.ts';

export interface SubscriptionPlanConfig {
  id: 'monthly' | 'quarterly' | 'half_yearly' | 'yearly';
  name: string;
  amountInr: number;
  months: number;
  cadenceLabel: string;
  summary: string;
}

export const SUBSCRIPTION_PLANS: Record<string, SubscriptionPlanConfig> = {
  monthly: {
    id: 'monthly',
    name: 'Monthly',
    amountInr: 299,
    months: 1,
    cadenceLabel: 'per month',
    summary: 'Full member CRM, expiry alerts & WhatsApp automation for 30 days',
  },
  quarterly: {
    id: 'quarterly',
    name: 'Quarterly',
    amountInr: 799,
    months: 3,
    cadenceLabel: 'for 3 months',
    summary: 'Save ₹98 over monthly billing with full WhatsApp & receipt tools',
  },
  half_yearly: {
    id: 'half_yearly',
    name: 'Half-Yearly',
    amountInr: 1499,
    months: 6,
    cadenceLabel: 'for 6 months',
    summary: 'Built for growing fitness studios looking for half-year predictability',
  },
  yearly: {
    id: 'yearly',
    name: 'Yearly',
    amountInr: 2499,
    months: 12,
    cadenceLabel: 'per year',
    summary: 'Best annual value — save ₹1,089 with uninterrupted 12-month coverage',
  },
};

export function isRazorpayConfigured(): boolean {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  return Boolean(
    keyId &&
      keySecret &&
      !keyId.includes('YOUR_') &&
      !keySecret.includes('YOUR_')
  );
}

function getRazorpayClient(): Razorpay {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret || keyId.includes('YOUR_') || keySecret.includes('YOUR_')) {
    throw new Error('RAZORPAY_NOT_CONFIGURED');
  }
  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
}

function computeNextSubscriptionExpiry(currentExpiry: Date | null, monthsToAdd: number): {
  periodStart: Date;
  periodEnd: Date;
} {
  const now = new Date();
  const baseDate =
    currentExpiry && currentExpiry.getTime() > now.getTime()
      ? new Date(currentExpiry)
      : new Date(now);
  const periodEnd = new Date(baseDate);
  periodEnd.setMonth(periodEnd.getMonth() + monthsToAdd);
  return {
    periodStart: baseDate,
    periodEnd,
  };
}

export async function createRazorpaySubscriptionOrder(
  owner: OwnerRecord,
  planId: string
) {
  const plan = SUBSCRIPTION_PLANS[planId];
  if (!plan) {
    throw new Error('INVALID_PLAN');
  }

  const client = getRazorpayClient();
  const receiptNumber = generateReceiptNumber('SUB');
  const amountPaise = plan.amountInr * 100;

  const order = await client.orders.create({
    amount: amountPaise,
    currency: 'INR',
    receipt: receiptNumber,
    notes: {
      ownerId: String(owner.id),
      ownerUid: owner.uid,
      gymName: owner.gymName || '',
      planId: plan.id,
    },
  });

  await db.insert(subscriptionPayments).values({
    ownerId: owner.id,
    planId: plan.id,
    planName: plan.name,
    amountInr: plan.amountInr,
    currency: 'INR',
    razorpayOrderId: order.id,
    status: 'created',
    receiptNumber,
  });

  return {
    orderId: order.id,
    amountPaise: order.amount,
    amountInr: plan.amountInr,
    currency: order.currency,
    keyId: process.env.RAZORPAY_KEY_ID,
    receiptNumber,
    plan,
  };
}

export async function activateVerifiedOrder(params: {
  orderId: string;
  paymentId: string;
  signature: string;
  paymentMethod?: string | null;
  verifiedVia: 'checkout_signature' | 'webhook';
  expectedOwnerId?: number;
}) {
  const existingRows = await db
    .select()
    .from(subscriptionPayments)
    .where(eq(subscriptionPayments.razorpayOrderId, params.orderId))
    .limit(1);

  if (!existingRows.length) {
    throw new Error('ORDER_NOT_FOUND');
  }

  const txRecord = existingRows[0];

  if (
    params.expectedOwnerId !== undefined &&
    txRecord.ownerId !== params.expectedOwnerId
  ) {
    throw new Error('ORDER_OWNERSHIP_MISMATCH');
  }

  // Idempotent return if already verified
  if (txRecord.status === 'verified') {
    const ownerRows = await db
      .select()
      .from(users)
      .where(eq(users.id, txRecord.ownerId))
      .limit(1);
    return {
      transaction: txRecord,
      owner: ownerRows[0],
      alreadyVerified: true,
    };
  }

  const plan = SUBSCRIPTION_PLANS[txRecord.planId];
  const months = plan ? plan.months : 1;

  const ownerRows = await db
    .select()
    .from(users)
    .where(eq(users.id, txRecord.ownerId))
    .limit(1);

  if (!ownerRows.length) {
    throw new Error('OWNER_NOT_FOUND');
  }

  const owner = ownerRows[0];
  const { periodStart, periodEnd } = computeNextSubscriptionExpiry(
    owner.subscriptionExpiresAt,
    months
  );

  // Fetch exact payment method from Razorpay API if available and not passed
  let resolvedMethod = params.paymentMethod || null;
  if (!resolvedMethod && isRazorpayConfigured()) {
    try {
      const client = getRazorpayClient();
      const paymentInfo = await client.payments.fetch(params.paymentId);
      const methodMap: Record<string, string> = {
        upi: 'UPI',
        card: 'Credit / Debit Card',
        netbanking: 'Net Banking',
        wallet: 'Wallet',
      };
      resolvedMethod =
        methodMap[paymentInfo.method] || paymentInfo.method || 'Online';
    } catch (err) {
      console.warn('Could not fetch payment method details from Razorpay:', err);
    }
  }

  const updatedTx = await db
    .update(subscriptionPayments)
    .set({
      razorpayPaymentId: params.paymentId,
      razorpaySignature: params.signature,
      paymentMethod: resolvedMethod || 'Razorpay Checkout',
      status: 'verified',
      verifiedVia: params.verifiedVia,
      periodStart,
      periodEnd,
      verifiedAt: new Date(),
    })
    .where(
      and(
        eq(subscriptionPayments.id, txRecord.id),
        eq(subscriptionPayments.ownerId, txRecord.ownerId)
      )
    )
    .returning();

  const updatedOwner = await db
    .update(users)
    .set({
      subscriptionPlan: txRecord.planId,
      subscriptionStatus: 'active',
      subscriptionExpiresAt: periodEnd,
      updatedAt: new Date(),
    })
    .where(eq(users.id, txRecord.ownerId))
    .returning();

  return {
    transaction: updatedTx[0],
    owner: updatedOwner[0],
    alreadyVerified: false,
  };
}

export async function verifyCheckoutSignatureAndActivate(
  ownerId: number,
  payload: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
    paymentMethod?: string;
  }
) {
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret || keySecret.includes('YOUR_')) {
    throw new Error('RAZORPAY_NOT_CONFIGURED');
  }

  const expectedSignature = crypto
    .createHmac('sha256', keySecret)
    .update(`${payload.razorpay_order_id}|${payload.razorpay_payment_id}`)
    .digest('hex');

  const expectedBuf = Buffer.from(expectedSignature, 'utf8');
  const providedBuf = Buffer.from(payload.razorpay_signature || '', 'utf8');

  if (
    expectedBuf.length !== providedBuf.length ||
    !crypto.timingSafeEqual(expectedBuf, providedBuf)
  ) {
    throw new Error('INVALID_SIGNATURE');
  }

  return activateVerifiedOrder({
    orderId: payload.razorpay_order_id,
    paymentId: payload.razorpay_payment_id,
    signature: payload.razorpay_signature,
    paymentMethod: payload.paymentMethod,
    verifiedVia: 'checkout_signature',
    expectedOwnerId: ownerId,
  });
}

export async function verifyAndProcessWebhook(
  rawBody: Buffer,
  signatureHeader: string | undefined
) {
  const webhookSecret =
    process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET;

  if (!webhookSecret || webhookSecret.includes('YOUR_')) {
    throw new Error('WEBHOOK_SECRET_NOT_CONFIGURED');
  }

  if (!signatureHeader) {
    throw new Error('MISSING_WEBHOOK_SIGNATURE');
  }

  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex');

  const expectedBuf = Buffer.from(expectedSignature, 'utf8');
  const providedBuf = Buffer.from(signatureHeader, 'utf8');

  if (
    expectedBuf.length !== providedBuf.length ||
    !crypto.timingSafeEqual(expectedBuf, providedBuf)
  ) {
    throw new Error('INVALID_WEBHOOK_SIGNATURE');
  }

  const event = JSON.parse(rawBody.toString('utf8')) as {
    event: string;
    payload?: {
      payment?: {
        entity?: {
          id?: string;
          order_id?: string;
          method?: string;
          status?: string;
        };
      };
      order?: {
        entity?: {
          id?: string;
        };
      };
    };
  };

  if (event.event === 'payment.captured' || event.event === 'order.paid') {
    const paymentEntity = event.payload?.payment?.entity;
    const orderId =
      paymentEntity?.order_id || event.payload?.order?.entity?.id;
    const paymentId = paymentEntity?.id;

    if (orderId && paymentId) {
      await activateVerifiedOrder({
        orderId,
        paymentId,
        signature: signatureHeader,
        paymentMethod: paymentEntity?.method || null,
        verifiedVia: 'webhook',
      });
    }
  } else if (event.event === 'payment.failed') {
    const orderId = event.payload?.payment?.entity?.order_id;
    if (orderId) {
      await db
        .update(subscriptionPayments)
        .set({ status: 'failed' })
        .where(eq(subscriptionPayments.razorpayOrderId, orderId));
    }
  }

  return { received: true, event: event.event };
}
