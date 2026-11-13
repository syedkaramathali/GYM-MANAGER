import { and, eq } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { getDaysRemaining, toIsoDateString } from '../db/queries.ts';
import { members, users, whatsappLogs } from '../db/schema.ts';

export type WhatsappTriggerType =
  | '7_days'
  | '3_days'
  | '1_day'
  | 'expiry_day'
  | 'renewal_confirmation'
  | 'manual';

export function formatPhoneForWhatsApp(rawPhone: string): string {
  const digits = rawPhone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `91${digits}`;
  }
  return digits;
}

export function buildReminderMessage(
  memberName: string,
  triggerType: WhatsappTriggerType,
  gymName?: string | null,
  expiryDate?: string,
  daysRemaining?: number
): string {
  const firstName = memberName.trim().split(/\s+/)[0] || memberName;
  switch (triggerType) {
    case '7_days':
      return `Hello ${firstName}! Your gym membership will expire in 7 days. Please renew your membership to continue enjoying our gym facilities.`;
    case '3_days':
      return `Hello ${firstName}! Your gym membership will expire in 3 days. Please renew your membership to continue enjoying our gym facilities.`;
    case '1_day':
      return `Hello ${firstName}! Your gym membership will expire tomorrow (in 1 day). Please renew your membership to continue enjoying our gym facilities.`;
    case 'expiry_day':
      if (daysRemaining !== undefined && daysRemaining < 0 && expiryDate) {
        return `Hello ${firstName}! Your gym membership expired on ${expiryDate}. Please renew your membership to continue enjoying our gym facilities. Thank you!`;
      }
      return `Hello ${firstName}! Your gym membership has expired today. Please renew your membership. Thank you!`;
    case 'renewal_confirmation':
      return `Hello ${firstName}! Your gym membership${gymName ? ` at ${gymName}` : ''} has been renewed${expiryDate ? ` until ${expiryDate}` : ''}. Thank you for staying fit with us!`;
    default:
      return `Hello ${firstName}! Quick reminder from ${gymName || 'your gym'} regarding your membership.`;
  }
}

export function isWhatsAppConfigured(): boolean {
  return Boolean(
    process.env.WHATSAPP_ACCESS_TOKEN &&
      process.env.WHATSAPP_PHONE_NUMBER_ID &&
      !process.env.WHATSAPP_ACCESS_TOKEN.includes('YOUR_') &&
      !process.env.WHATSAPP_PHONE_NUMBER_ID.includes('YOUR_')
  );
}

export async function dispatchWhatsAppMessage(params: {
  ownerId: number;
  memberId: number;
  recipientPhone: string;
  triggerType: WhatsappTriggerType;
  targetExpiryDate: string;
  messageBody: string;
  allowDuplicate?: boolean;
}) {
  const normalizedPhone = formatPhoneForWhatsApp(params.recipientPhone);

  let existingLogId: number | null = null;
  if (!params.allowDuplicate) {
    const existing = await db
      .select()
      .from(whatsappLogs)
      .where(
        and(
          eq(whatsappLogs.memberId, params.memberId),
          eq(whatsappLogs.triggerType, params.triggerType),
          eq(whatsappLogs.targetExpiryDate, params.targetExpiryDate)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      if (existing[0].deliveryStatus === 'sent' || !isWhatsAppConfigured()) {
        return { skipped: true, log: existing[0] };
      }
      // Credentials are now configured — retry updating the previously pending/failed log
      existingLogId = existing[0].id;
    }
  }

  let deliveryStatus = 'not_configured';
  let providerMessageId: string | null = null;
  let errorMessage: string | null = null;

  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const apiVersion = process.env.WHATSAPP_API_VERSION || 'v21.0';

  if (
    accessToken &&
    phoneNumberId &&
    !accessToken.includes('YOUR_') &&
    !phoneNumberId.includes('YOUR_')
  ) {
    try {
      const response = await fetch(
        `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: normalizedPhone,
            type: 'text',
            text: {
              preview_url: false,
              body: params.messageBody,
            },
          }),
        }
      );

      const data = (await response.json()) as {
        messages?: Array<{ id: string }>;
        error?: { message?: string };
      };

      if (response.ok && data.messages?.[0]?.id) {
        deliveryStatus = 'sent';
        providerMessageId = data.messages[0].id;
      } else {
        deliveryStatus = 'failed';
        errorMessage = data.error?.message || `WhatsApp API error (${response.status})`;
      }
    } catch (err: unknown) {
      deliveryStatus = 'failed';
      errorMessage =
        err instanceof Error ? err.message : 'Network error calling WhatsApp Cloud API';
    }
  } else {
    deliveryStatus = 'not_configured';
    errorMessage =
      'WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID are not set in server secrets.';
  }

  if (existingLogId !== null) {
    const updated = await db
      .update(whatsappLogs)
      .set({
        recipientPhone: normalizedPhone,
        messageBody: params.messageBody,
        deliveryStatus,
        providerMessageId,
        errorMessage,
        sentAt: new Date(),
      })
      .where(eq(whatsappLogs.id, existingLogId))
      .returning();

    return { skipped: false, log: updated[0] };
  }

  const dedupKeyExpiry =
    params.allowDuplicate
      ? `${params.targetExpiryDate}-${Date.now()}`
      : params.targetExpiryDate;

  const inserted = await db
    .insert(whatsappLogs)
    .values({
      ownerId: params.ownerId,
      memberId: params.memberId,
      recipientPhone: normalizedPhone,
      triggerType: params.triggerType,
      targetExpiryDate: dedupKeyExpiry,
      messageBody: params.messageBody,
      deliveryStatus,
      providerMessageId,
      errorMessage,
    })
    .returning();

  return { skipped: false, log: inserted[0] };
}

export async function checkAndNotifySingleMember(
  member: {
    id: number;
    ownerId: number;
    fullName: string;
    whatsappNumber: string;
    expiryDate: string;
  },
  gymName?: string | null
) {
  const todayStr = toIsoDateString(new Date());
  const days = getDaysRemaining(member.expiryDate, todayStr);

  let triggerType: WhatsappTriggerType | null = null;
  if (days === 7) triggerType = '7_days';
  else if (days === 3) triggerType = '3_days';
  else if (days === 1) triggerType = '1_day';
  else if (days <= 0) triggerType = 'expiry_day';

  if (!triggerType) {
    return null;
  }

  const messageBody = buildReminderMessage(
    member.fullName,
    triggerType,
    gymName,
    member.expiryDate,
    days
  );

  return dispatchWhatsAppMessage({
    ownerId: member.ownerId,
    memberId: member.id,
    recipientPhone: member.whatsappNumber,
    triggerType,
    targetExpiryDate: member.expiryDate,
    messageBody,
  });
}

export async function runAutomatedExpiryNotifications(filterOwnerId?: number) {
  const rows = filterOwnerId
    ? await db
        .select({
          member: members,
          gymName: users.gymName,
        })
        .from(members)
        .innerJoin(users, eq(members.ownerId, users.id))
        .where(eq(members.ownerId, filterOwnerId))
    : await db
        .select({
          member: members,
          gymName: users.gymName,
        })
        .from(members)
        .innerJoin(users, eq(members.ownerId, users.id));

  const results = {
    checked: rows.length,
    triggered: 0,
    sent: 0,
    skippedDuplicates: 0,
    notConfigured: 0,
    failed: 0,
  };

  for (const row of rows) {
    const dispatchResult = await checkAndNotifySingleMember(row.member, row.gymName);
    if (!dispatchResult) continue;

    results.triggered += 1;

    if (dispatchResult.skipped) {
      results.skippedDuplicates += 1;
    } else if (dispatchResult.log.deliveryStatus === 'sent') {
      results.sent += 1;
    } else if (dispatchResult.log.deliveryStatus === 'not_configured') {
      results.notConfigured += 1;
    } else {
      results.failed += 1;
    }
  }

  return results;
}
