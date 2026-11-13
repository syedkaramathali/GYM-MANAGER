import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { db } from './index.ts';
import {
  memberPayments,
  members,
  membershipHistory,
  subscriptionPayments,
  users,
  whatsappLogs,
} from './schema.ts';

// Pure date helpers (YYYY-MM-DD in UTC/local safe format)
export function toIsoDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function calculateExpiryDate(startDateStr: string, durationMonths: number): string {
  const [year, month, day] = startDateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  d.setMonth(d.getMonth() + durationMonths);
  return toIsoDateString(d);
}

export function getDaysRemaining(expiryDateStr: string, referenceDateStr?: string): number {
  const todayStr = referenceDateStr ?? toIsoDateString(new Date());
  const [ey, em, ed] = expiryDateStr.split('-').map(Number);
  const [ty, tm, td] = todayStr.split('-').map(Number);
  const expiryUtc = Date.UTC(ey, em - 1, ed);
  const todayUtc = Date.UTC(ty, tm - 1, td);
  return Math.round((expiryUtc - todayUtc) / (1000 * 60 * 60 * 24));
}

export function deriveMembershipState(expiryDateStr: string): 'active' | 'expiring_soon' | 'expired' {
  const days = getDaysRemaining(expiryDateStr);
  if (days < 0) return 'expired';
  if (days <= 7) return 'expiring_soon';
  return 'active';
}

export function generateReceiptNumber(prefix: 'RCP' | 'SUB'): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${y}${m}${d}-${rand}`;
}

export async function getOrCreateOwner(
  uid: string,
  email: string,
  displayName: string | null
) {
  try {
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.uid, uid))
      .limit(1);

    if (existing.length > 0) {
      return existing[0];
    }

    const result = await db
      .insert(users)
      .values({
        uid,
        email: email || '',
        ownerName: displayName,
        isOnboarded: false,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email: email || '',
          updatedAt: new Date(),
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database query failed in getOrCreateOwner:', error);
    throw new Error('Failed to load owner profile.', { cause: error });
  }
}

export async function updateOwnerRegistration(
  ownerId: number,
  data: {
    ownerName: string;
    gymName: string;
    mobileNumber: string;
    email: string;
    profilePhoto?: string | null;
  }
) {
  try {
    const updatePayload: {
      ownerName: string;
      gymName: string;
      mobileNumber: string;
      email: string;
      isOnboarded: boolean;
      updatedAt: Date;
      profilePhoto?: string | null;
    } = {
      ownerName: data.ownerName.trim(),
      gymName: data.gymName.trim(),
      mobileNumber: data.mobileNumber.trim(),
      email: data.email.trim(),
      isOnboarded: true,
      updatedAt: new Date(),
    };

    if (data.profilePhoto !== undefined) {
      updatePayload.profilePhoto = data.profilePhoto || null;
    }

    const result = await db
      .update(users)
      .set(updatePayload)
      .where(eq(users.id, ownerId))
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database query failed in updateOwnerRegistration:', error);
    throw new Error('Failed to save gym registration details.', { cause: error });
  }
}

export async function getOwnerById(ownerId: number) {
  try {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.id, ownerId))
      .limit(1);
    return result[0] || null;
  } catch (error) {
    console.error('Database query failed in getOwnerById:', error);
    throw new Error('Failed to fetch gym owner.', { cause: error });
  }
}

export async function getMembersByOwner(
  ownerId: number,
  search?: string
) {
  try {
    const trimmed = search?.trim();
    const whereCondition = trimmed
      ? and(
          eq(members.ownerId, ownerId),
          or(
            ilike(members.fullName, `%${trimmed}%`),
            ilike(members.mobileNumber, `%${trimmed}%`),
            ilike(members.memberCode, `%${trimmed}%`)
          )
        )
      : eq(members.ownerId, ownerId);

    const rows = await db
      .select()
      .from(members)
      .where(whereCondition)
      .orderBy(desc(members.createdAt));

    return rows.map((row) => ({
      ...row,
      daysRemaining: getDaysRemaining(row.expiryDate),
      membershipState: deriveMembershipState(row.expiryDate),
    }));
  } catch (error) {
    console.error('Database query failed in getMembersByOwner:', error);
    throw new Error('Failed to fetch members.', { cause: error });
  }
}

export async function getNextMemberCode(ownerId: number): Promise<string> {
  try {
    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(members)
      .where(eq(members.ownerId, ownerId));
    const nextNum = (countResult[0]?.count ?? 0) + 1;
    const year = new Date().getFullYear();
    return `GM-${year}-${String(nextNum).padStart(4, '0')}`;
  } catch (error) {
    console.error('Database query failed in getNextMemberCode:', error);
    throw new Error('Failed to generate member ID.', { cause: error });
  }
}

export async function createMemberRecord(
  ownerId: number,
  input: {
    fullName: string;
    mobileNumber: string;
    whatsappNumber: string;
    age: number;
    gender: string;
    startDate: string;
    durationMonths: number;
    durationLabel: string;
    expiryDate?: string;
    membershipAmount: number;
    paymentStatus: string;
    paymentMethod?: string;
    profilePhoto?: string | null;
  }
) {
  try {
    const memberCode = await getNextMemberCode(ownerId);
    const expiryDate =
      input.expiryDate || calculateExpiryDate(input.startDate, input.durationMonths);
    const paymentMethod = input.paymentMethod || 'Cash';

    const insertedMembers = await db
      .insert(members)
      .values({
        ownerId,
        memberCode,
        fullName: input.fullName.trim(),
        mobileNumber: input.mobileNumber.trim(),
        whatsappNumber: input.whatsappNumber.trim(),
        age: input.age,
        gender: input.gender,
        startDate: input.startDate,
        durationMonths: input.durationMonths,
        durationLabel: input.durationLabel,
        expiryDate,
        membershipAmount: input.membershipAmount,
        paymentStatus: input.paymentStatus,
        profilePhoto: input.profilePhoto || null,
      })
      .returning();

    const createdMember = insertedMembers[0];

    await db.insert(membershipHistory).values({
      ownerId,
      memberId: createdMember.id,
      actionType: 'Initial Join',
      startDate: input.startDate,
      expiryDate,
      durationMonths: input.durationMonths,
      durationLabel: input.durationLabel,
      amount: input.membershipAmount,
      paymentStatus: input.paymentStatus,
      paymentMethod,
    });

    await db.insert(memberPayments).values({
      ownerId,
      memberId: createdMember.id,
      receiptNumber: generateReceiptNumber('RCP'),
      amount: input.membershipAmount,
      paymentMethod,
      paymentStatus: input.paymentStatus,
      notes: `${input.durationLabel} initial membership`,
    });

    return {
      ...createdMember,
      daysRemaining: getDaysRemaining(createdMember.expiryDate),
      membershipState: deriveMembershipState(createdMember.expiryDate),
    };
  } catch (error) {
    console.error('Database query failed in createMemberRecord:', error);
    throw new Error('Failed to create member record.', { cause: error });
  }
}

export async function updateMemberRecord(
  ownerId: number,
  memberId: number,
  input: {
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
  }
) {
  try {
    const updated = await db
      .update(members)
      .set({
        fullName: input.fullName.trim(),
        mobileNumber: input.mobileNumber.trim(),
        whatsappNumber: input.whatsappNumber.trim(),
        age: input.age,
        gender: input.gender,
        startDate: input.startDate,
        durationMonths: input.durationMonths,
        durationLabel: input.durationLabel,
        expiryDate: input.expiryDate,
        membershipAmount: input.membershipAmount,
        paymentStatus: input.paymentStatus,
        profilePhoto: input.profilePhoto ?? undefined,
        updatedAt: new Date(),
      })
      .where(and(eq(members.id, memberId), eq(members.ownerId, ownerId)))
      .returning();

    if (!updated.length) return null;
    const m = updated[0];

    // Keep latest member payment row in sync with updated plan amount / payment status
    const latestPayments = await db
      .select()
      .from(memberPayments)
      .where(and(eq(memberPayments.memberId, memberId), eq(memberPayments.ownerId, ownerId)))
      .orderBy(desc(memberPayments.paidAt))
      .limit(1);

    if (input.paymentStatus === 'Pending') {
      if (latestPayments.length > 0) {
        await db
          .update(memberPayments)
          .set({
            paymentStatus: 'Pending',
            amount: input.membershipAmount,
          })
          .where(
            and(
              eq(memberPayments.id, latestPayments[0].id),
              eq(memberPayments.ownerId, ownerId)
            )
          );
      } else {
        await db.insert(memberPayments).values({
          ownerId,
          memberId: m.id,
          receiptNumber: generateReceiptNumber('RCP'),
          amount: input.membershipAmount,
          paymentMethod: 'Cash',
          paymentStatus: 'Pending',
          notes: `${input.durationLabel} membership due`,
        });
      }
    } else if (input.paymentStatus === 'Paid') {
      await db
        .update(memberPayments)
        .set({ paymentStatus: 'Paid', paidAt: new Date() })
        .where(
          and(
            eq(memberPayments.memberId, memberId),
            eq(memberPayments.ownerId, ownerId),
            eq(memberPayments.paymentStatus, 'Pending')
          )
        );
    }

    return {
      ...m,
      daysRemaining: getDaysRemaining(m.expiryDate),
      membershipState: deriveMembershipState(m.expiryDate),
    };
  } catch (error) {
    console.error('Database query failed in updateMemberRecord:', error);
    throw new Error('Failed to update member record.', { cause: error });
  }
}

export async function deleteMemberRecord(ownerId: number, memberId: number) {
  try {
    const deleted = await db
      .delete(members)
      .where(and(eq(members.id, memberId), eq(members.ownerId, ownerId)))
      .returning();
    return deleted[0] || null;
  } catch (error) {
    console.error('Database query failed in deleteMemberRecord:', error);
    throw new Error('Failed to delete member record.', { cause: error });
  }
}

export async function renewMemberRecord(
  ownerId: number,
  memberId: number,
  input: {
    durationMonths: number;
    durationLabel: string;
    amount: number;
    paymentStatus: string;
    paymentMethod: string;
  }
) {
  try {
    const existingRows = await db
      .select()
      .from(members)
      .where(and(eq(members.id, memberId), eq(members.ownerId, ownerId)))
      .limit(1);

    if (!existingRows.length) return null;
    const member = existingRows[0];

    const todayStr = toIsoDateString(new Date());
    const daysLeft = getDaysRemaining(member.expiryDate, todayStr);
    // If active, extend from current expiry date; if expired, start fresh from today
    const renewalStart = daysLeft >= 0 ? member.expiryDate : todayStr;
    const newExpiryDate = calculateExpiryDate(renewalStart, input.durationMonths);

    const updated = await db
      .update(members)
      .set({
        startDate: renewalStart,
        durationMonths: input.durationMonths,
        durationLabel: input.durationLabel,
        expiryDate: newExpiryDate,
        membershipAmount: input.amount,
        paymentStatus: input.paymentStatus,
        updatedAt: new Date(),
      })
      .where(and(eq(members.id, memberId), eq(members.ownerId, ownerId)))
      .returning();

    await db.insert(membershipHistory).values({
      ownerId,
      memberId,
      actionType: 'Renewal',
      startDate: renewalStart,
      expiryDate: newExpiryDate,
      durationMonths: input.durationMonths,
      durationLabel: input.durationLabel,
      amount: input.amount,
      paymentStatus: input.paymentStatus,
      paymentMethod: input.paymentMethod,
    });

    const receiptRows = await db
      .insert(memberPayments)
      .values({
        ownerId,
        memberId,
        receiptNumber: generateReceiptNumber('RCP'),
        amount: input.amount,
        paymentMethod: input.paymentMethod,
        paymentStatus: input.paymentStatus,
        notes: `${input.durationLabel} membership renewal`,
      })
      .returning();

    return {
      member: {
        ...updated[0],
        daysRemaining: getDaysRemaining(updated[0].expiryDate),
        membershipState: deriveMembershipState(updated[0].expiryDate),
      },
      receipt: receiptRows[0],
    };
  } catch (error) {
    console.error('Database query failed in renewMemberRecord:', error);
    throw new Error('Failed to renew membership.', { cause: error });
  }
}

export async function getMemberHistory(ownerId: number, memberId: number) {
  try {
    const memberRows = await db
      .select()
      .from(members)
      .where(and(eq(members.id, memberId), eq(members.ownerId, ownerId)))
      .limit(1);

    if (!memberRows.length) return null;

    const history = await db
      .select()
      .from(membershipHistory)
      .where(
        and(
          eq(membershipHistory.memberId, memberId),
          eq(membershipHistory.ownerId, ownerId)
        )
      )
      .orderBy(desc(membershipHistory.createdAt));

    const payments = await db
      .select()
      .from(memberPayments)
      .where(
        and(
          eq(memberPayments.memberId, memberId),
          eq(memberPayments.ownerId, ownerId)
        )
      )
      .orderBy(desc(memberPayments.paidAt));

    const notifications = await db
      .select()
      .from(whatsappLogs)
      .where(
        and(
          eq(whatsappLogs.memberId, memberId),
          eq(whatsappLogs.ownerId, ownerId)
        )
      )
      .orderBy(desc(whatsappLogs.sentAt));

    return {
      member: {
        ...memberRows[0],
        daysRemaining: getDaysRemaining(memberRows[0].expiryDate),
        membershipState: deriveMembershipState(memberRows[0].expiryDate),
      },
      history,
      payments,
      notifications,
    };
  } catch (error) {
    console.error('Database query failed in getMemberHistory:', error);
    throw new Error('Failed to fetch member history.', { cause: error });
  }
}

export async function getDashboardData(ownerId: number) {
  try {
    const allMembers = await getMembersByOwner(ownerId);
    const payments = await db
      .select({
        id: memberPayments.id,
        memberId: memberPayments.memberId,
        receiptNumber: memberPayments.receiptNumber,
        amount: memberPayments.amount,
        paymentMethod: memberPayments.paymentMethod,
        paymentStatus: memberPayments.paymentStatus,
        notes: memberPayments.notes,
        paidAt: memberPayments.paidAt,
        memberName: members.fullName,
        memberCode: members.memberCode,
      })
      .from(memberPayments)
      .innerJoin(members, eq(memberPayments.memberId, members.id))
      .where(eq(memberPayments.ownerId, ownerId))
      .orderBy(desc(memberPayments.paidAt));

    const activeCount = allMembers.filter((m) => m.membershipState === 'active').length;
    const expiringSoonCount = allMembers.filter(
      (m) => m.membershipState === 'expiring_soon'
    ).length;
    const expiredCount = allMembers.filter((m) => m.membershipState === 'expired').length;

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const monthlyRevenue = payments
      .filter((p) => {
        if (p.paymentStatus !== 'Paid') return false;
        const d = new Date(p.paidAt);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      })
      .reduce((acc, p) => acc + p.amount, 0);

    const totalRevenue = payments
      .filter((p) => p.paymentStatus === 'Paid')
      .reduce((acc, p) => acc + p.amount, 0);

    const pendingPaymentRows = payments.filter((p) => p.paymentStatus === 'Pending');
    const pendingMemberIdsWithRow = new Set(pendingPaymentRows.map((p) => p.memberId));
    const pendingPaymentsTotal = pendingPaymentRows.reduce((acc, p) => acc + p.amount, 0);
    const fallbackPendingMembersTotal = allMembers
      .filter((m) => m.paymentStatus === 'Pending' && !pendingMemberIdsWithRow.has(m.id))
      .reduce((acc, m) => acc + m.membershipAmount, 0);
    const pendingAmount = pendingPaymentsTotal + fallbackPendingMembersTotal;

    // Build 6-month revenue chart series
    const revenueChart: { month: string; revenue: number; signups: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const target = new Date(currentYear, currentMonth - i, 1);
      const tMonth = target.getMonth();
      const tYear = target.getFullYear();
      const label = target.toLocaleDateString('en-IN', { month: 'short' });

      const rev = payments
        .filter((p) => {
          if (p.paymentStatus !== 'Paid') return false;
          const d = new Date(p.paidAt);
          return d.getMonth() === tMonth && d.getFullYear() === tYear;
        })
        .reduce((sum, p) => sum + p.amount, 0);

      const signups = allMembers.filter((m) => {
        const d = new Date(m.createdAt);
        return d.getMonth() === tMonth && d.getFullYear() === tYear;
      }).length;

      revenueChart.push({ month: label, revenue: rev, signups });
    }

    return {
      stats: {
        totalMembers: allMembers.length,
        activeMembers: activeCount + expiringSoonCount, // active includes expiring soon, plus separate expiringSoon count
        healthyActiveMembers: activeCount,
        expiringSoonMembers: expiringSoonCount,
        expiredMembers: expiredCount,
        monthlyRevenue,
        totalRevenue,
        pendingAmount,
      },
      recentMembers: allMembers.slice(0, 6),
      expiringSoonList: allMembers
        .filter((m) => m.membershipState === 'expiring_soon')
        .sort((a, b) => a.daysRemaining - b.daysRemaining)
        .slice(0, 5),
      revenueChart,
      statusBreakdown: [
        { name: 'Active', value: activeCount, color: '#16A34A' },
        { name: 'Expiring Soon', value: expiringSoonCount, color: '#D97706' },
        { name: 'Expired', value: expiredCount, color: '#DC2626' },
      ],
    };
  } catch (error) {
    console.error('Database query failed in getDashboardData:', error);
    throw new Error('Failed to compute dashboard metrics.', { cause: error });
  }
}

export async function getMemberPaymentsByOwner(ownerId: number) {
  try {
    return await db
      .select({
        id: memberPayments.id,
        memberId: memberPayments.memberId,
        receiptNumber: memberPayments.receiptNumber,
        amount: memberPayments.amount,
        paymentMethod: memberPayments.paymentMethod,
        paymentStatus: memberPayments.paymentStatus,
        notes: memberPayments.notes,
        paidAt: memberPayments.paidAt,
        memberName: members.fullName,
        memberCode: members.memberCode,
        memberMobile: members.mobileNumber,
      })
      .from(memberPayments)
      .innerJoin(members, eq(memberPayments.memberId, members.id))
      .where(eq(memberPayments.ownerId, ownerId))
      .orderBy(desc(memberPayments.paidAt));
  } catch (error) {
    console.error('Database query failed in getMemberPaymentsByOwner:', error);
    throw new Error('Failed to fetch member payments.', { cause: error });
  }
}

export async function createMemberPaymentRecord(
  ownerId: number,
  input: {
    memberId: number;
    amount: number;
    paymentMethod: string;
    paymentStatus: string;
    notes?: string;
  }
) {
  try {
    // Enforce gym ownership of target member
    const targetMember = await db
      .select()
      .from(members)
      .where(and(eq(members.id, input.memberId), eq(members.ownerId, ownerId)))
      .limit(1);

    if (!targetMember.length) {
      return null;
    }

    const inserted = await db
      .insert(memberPayments)
      .values({
        ownerId,
        memberId: input.memberId,
        receiptNumber: generateReceiptNumber('RCP'),
        amount: input.amount,
        paymentMethod: input.paymentMethod,
        paymentStatus: input.paymentStatus,
        notes: input.notes?.trim() || 'Membership payment',
      })
      .returning();

    if (input.paymentStatus === 'Paid') {
      await db
        .update(members)
        .set({ paymentStatus: 'Paid', updatedAt: new Date() })
        .where(and(eq(members.id, input.memberId), eq(members.ownerId, ownerId)));
    }

    return {
      ...inserted[0],
      memberName: targetMember[0].fullName,
      memberCode: targetMember[0].memberCode,
      memberMobile: targetMember[0].mobileNumber,
    };
  } catch (error) {
    console.error('Database query failed in createMemberPaymentRecord:', error);
    throw new Error('Failed to record payment.', { cause: error });
  }
}

export async function markMemberPaymentPaid(ownerId: number, paymentId: number) {
  try {
    const updated = await db
      .update(memberPayments)
      .set({ paymentStatus: 'Paid', paidAt: new Date() })
      .where(
        and(eq(memberPayments.id, paymentId), eq(memberPayments.ownerId, ownerId))
      )
      .returning();

    if (!updated.length) return null;

    await db
      .update(members)
      .set({ paymentStatus: 'Paid', updatedAt: new Date() })
      .where(
        and(eq(members.id, updated[0].memberId), eq(members.ownerId, ownerId))
      );

    return updated[0];
  } catch (error) {
    console.error('Database query failed in markMemberPaymentPaid:', error);
    throw new Error('Failed to update payment status.', { cause: error });
  }
}

export async function getWhatsappLogsByOwner(ownerId: number) {
  try {
    return await db
      .select({
        id: whatsappLogs.id,
        memberId: whatsappLogs.memberId,
        recipientPhone: whatsappLogs.recipientPhone,
        triggerType: whatsappLogs.triggerType,
        targetExpiryDate: whatsappLogs.targetExpiryDate,
        messageBody: whatsappLogs.messageBody,
        deliveryStatus: whatsappLogs.deliveryStatus,
        providerMessageId: whatsappLogs.providerMessageId,
        errorMessage: whatsappLogs.errorMessage,
        sentAt: whatsappLogs.sentAt,
        memberName: members.fullName,
        memberCode: members.memberCode,
      })
      .from(whatsappLogs)
      .innerJoin(members, eq(whatsappLogs.memberId, members.id))
      .where(eq(whatsappLogs.ownerId, ownerId))
      .orderBy(desc(whatsappLogs.sentAt))
      .limit(100);
  } catch (error) {
    console.error('Database query failed in getWhatsappLogsByOwner:', error);
    throw new Error('Failed to fetch WhatsApp notification logs.', { cause: error });
  }
}

export async function getSubscriptionHistoryByOwner(ownerId: number) {
  try {
    return await db
      .select()
      .from(subscriptionPayments)
      .where(eq(subscriptionPayments.ownerId, ownerId))
      .orderBy(desc(subscriptionPayments.createdAt));
  } catch (error) {
    console.error('Database query failed in getSubscriptionHistoryByOwner:', error);
    throw new Error('Failed to fetch subscription transactions.', { cause: error });
  }
}
