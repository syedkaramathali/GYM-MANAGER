import { relations } from 'drizzle-orm';
import {
  boolean,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// Gym Owners table — synced with Firebase Auth UID
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  ownerName: text('owner_name'),
  gymName: text('gym_name'),
  mobileNumber: text('mobile_number'),
  profilePhoto: text('profile_photo'),
  isOnboarded: boolean('is_onboarded').default(false).notNull(),
  subscriptionPlan: text('subscription_plan').default('none').notNull(), // none | monthly | quarterly | half_yearly | yearly
  subscriptionStatus: text('subscription_status').default('inactive').notNull(), // inactive | active | expired
  subscriptionExpiresAt: timestamp('subscription_expires_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Gym Members table — strictly isolated per ownerId
export const members = pgTable('members', {
  id: serial('id').primaryKey(),
  ownerId: integer('owner_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  memberCode: text('member_code').notNull(),
  fullName: text('full_name').notNull(),
  mobileNumber: text('mobile_number').notNull(),
  whatsappNumber: text('whatsapp_number').notNull(),
  age: integer('age').notNull(),
  gender: text('gender').notNull(), // Male | Female | Other
  startDate: text('start_date').notNull(), // YYYY-MM-DD
  durationMonths: integer('duration_months').notNull(),
  durationLabel: text('duration_label').notNull(),
  expiryDate: text('expiry_date').notNull(), // YYYY-MM-DD
  membershipAmount: integer('membership_amount').notNull(),
  paymentStatus: text('payment_status').notNull(), // Paid | Pending
  profilePhoto: text('profile_photo'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Membership History table — records initial sign-ups and every renewal
export const membershipHistory = pgTable('membership_history', {
  id: serial('id').primaryKey(),
  ownerId: integer('owner_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  memberId: integer('member_id')
    .references(() => members.id, { onDelete: 'cascade' })
    .notNull(),
  actionType: text('action_type').notNull(), // Initial Join | Renewal
  startDate: text('start_date').notNull(),
  expiryDate: text('expiry_date').notNull(),
  durationMonths: integer('duration_months').notNull(),
  durationLabel: text('duration_label').notNull(),
  amount: integer('amount').notNull(),
  paymentStatus: text('payment_status').notNull(), // Paid | Pending
  paymentMethod: text('payment_method').notNull(), // Cash | UPI | Online
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Member Payments & Receipts table
export const memberPayments = pgTable('member_payments', {
  id: serial('id').primaryKey(),
  ownerId: integer('owner_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  memberId: integer('member_id')
    .references(() => members.id, { onDelete: 'cascade' })
    .notNull(),
  receiptNumber: text('receipt_number').notNull().unique(),
  amount: integer('amount').notNull(),
  paymentMethod: text('payment_method').notNull(), // Cash | UPI | Online
  paymentStatus: text('payment_status').notNull(), // Paid | Pending
  notes: text('notes'),
  paidAt: timestamp('paid_at').defaultNow().notNull(),
});

// WhatsApp Business Cloud API Notification Logs (with deduplication index)
export const whatsappLogs = pgTable(
  'whatsapp_logs',
  {
    id: serial('id').primaryKey(),
    ownerId: integer('owner_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    memberId: integer('member_id')
      .references(() => members.id, { onDelete: 'cascade' })
      .notNull(),
    recipientPhone: text('recipient_phone').notNull(),
    triggerType: text('trigger_type').notNull(), // 7_days | 3_days | 1_day | expiry_day | renewal_confirmation | manual
    targetExpiryDate: text('target_expiry_date').notNull(),
    messageBody: text('message_body').notNull(),
    deliveryStatus: text('delivery_status').notNull(), // sent | failed | not_configured
    providerMessageId: text('provider_message_id'),
    errorMessage: text('error_message'),
    sentAt: timestamp('sent_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('whatsapp_dedup_idx').on(
      table.memberId,
      table.triggerType,
      table.targetExpiryDate
    ),
  ]
);

// Gym Owner Razorpay Subscription Transactions
export const subscriptionPayments = pgTable('subscription_payments', {
  id: serial('id').primaryKey(),
  ownerId: integer('owner_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  planId: text('plan_id').notNull(), // monthly | quarterly | half_yearly | yearly
  planName: text('plan_name').notNull(),
  amountInr: integer('amount_inr').notNull(),
  currency: text('currency').default('INR').notNull(),
  razorpayOrderId: text('razorpay_order_id').notNull().unique(),
  razorpayPaymentId: text('razorpay_payment_id'),
  razorpaySignature: text('razorpay_signature'),
  paymentMethod: text('payment_method'), // UPI | Google Pay | PhonePe | Debit Card | Credit Card | Net Banking
  status: text('status').default('created').notNull(), // created | verified | failed
  receiptNumber: text('receipt_number').notNull().unique(),
  verifiedVia: text('verified_via'), // checkout_signature | webhook
  periodStart: timestamp('period_start'),
  periodEnd: timestamp('period_end'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  verifiedAt: timestamp('verified_at'),
});

// Drizzle Relations
export const usersRelations = relations(users, ({ many }) => ({
  members: many(members),
  membershipHistory: many(membershipHistory),
  memberPayments: many(memberPayments),
  whatsappLogs: many(whatsappLogs),
  subscriptionPayments: many(subscriptionPayments),
}));

export const membersRelations = relations(members, ({ one, many }) => ({
  owner: one(users, {
    fields: [members.ownerId],
    references: [users.id],
  }),
  history: many(membershipHistory),
  payments: many(memberPayments),
  whatsappLogs: many(whatsappLogs),
}));

export const membershipHistoryRelations = relations(
  membershipHistory,
  ({ one }) => ({
    owner: one(users, {
      fields: [membershipHistory.ownerId],
      references: [users.id],
    }),
    member: one(members, {
      fields: [membershipHistory.memberId],
      references: [members.id],
    }),
  })
);

export const memberPaymentsRelations = relations(memberPayments, ({ one }) => ({
  owner: one(users, {
    fields: [memberPayments.ownerId],
    references: [users.id],
  }),
  member: one(members, {
    fields: [memberPayments.memberId],
    references: [members.id],
  }),
}));

export const whatsappLogsRelations = relations(whatsappLogs, ({ one }) => ({
  owner: one(users, {
    fields: [whatsappLogs.ownerId],
    references: [users.id],
  }),
  member: one(members, {
    fields: [whatsappLogs.memberId],
    references: [members.id],
  }),
}));

export const subscriptionPaymentsRelations = relations(
  subscriptionPayments,
  ({ one }) => ({
    owner: one(users, {
      fields: [subscriptionPayments.ownerId],
      references: [users.id],
    }),
  })
);
