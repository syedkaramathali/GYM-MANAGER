import { auth } from './firebase';

export interface OwnerProfile {
  id: number;
  uid: string;
  email: string;
  ownerName: string | null;
  gymName: string | null;
  mobileNumber: string | null;
  profilePhoto: string | null;
  isOnboarded: boolean;
  subscriptionPlan: string;
  subscriptionStatus: string;
  subscriptionExpiresAt: string | null;
  createdAt: string;
}

export interface IntegrationsStatus {
  whatsappConfigured: boolean;
  razorpayConfigured: boolean;
}

export interface GymMember {
  id: number;
  ownerId: number;
  memberCode: string;
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
  profilePhoto: string | null;
  daysRemaining: number;
  membershipState: 'active' | 'expiring_soon' | 'expired';
  createdAt: string;
  updatedAt: string;
}

export interface MembershipHistoryItem {
  id: number;
  memberId: number;
  actionType: string;
  startDate: string;
  expiryDate: string;
  durationMonths: number;
  durationLabel: string;
  amount: number;
  paymentStatus: string;
  paymentMethod: string;
  createdAt: string;
}

export interface MemberPayment {
  id: number;
  memberId: number;
  receiptNumber: string;
  amount: number;
  paymentMethod: string;
  paymentStatus: string;
  notes: string | null;
  paidAt: string;
  memberName?: string;
  memberCode?: string;
  memberMobile?: string;
}

export interface WhatsappLog {
  id: number;
  memberId: number;
  recipientPhone: string;
  triggerType: string;
  targetExpiryDate: string;
  messageBody: string;
  deliveryStatus: string;
  providerMessageId: string | null;
  errorMessage: string | null;
  sentAt: string;
  memberName?: string;
  memberCode?: string;
}

export interface SubscriptionPlan {
  id: 'monthly' | 'quarterly' | 'half_yearly' | 'yearly';
  name: string;
  amountInr: number;
  months: number;
  cadenceLabel: string;
  summary: string;
}

export interface SubscriptionTransaction {
  id: number;
  planId: string;
  planName: string;
  amountInr: number;
  currency: string;
  razorpayOrderId: string;
  razorpayPaymentId: string | null;
  paymentMethod: string | null;
  status: string;
  receiptNumber: string;
  verifiedVia: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  createdAt: string;
  verifiedAt: string | null;
}

export interface DashboardData {
  stats: {
    totalMembers: number;
    activeMembers: number;
    healthyActiveMembers: number;
    expiringSoonMembers: number;
    expiredMembers: number;
    monthlyRevenue: number;
    totalRevenue: number;
    pendingAmount: number;
  };
  recentMembers: GymMember[];
  expiringSoonList: GymMember[];
  revenueChart: { month: string; revenue: number; signups: number }[];
  statusBreakdown: { name: string; value: number; color: string }[];
}

export async function apiFetch<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Authentication required. Please sign in.');
  }

  const executeRequest = async (forceRefresh: boolean) => {
    const token = await user.getIdToken(forceRefresh);
    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${token}`);
    if (options.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    return fetch(url, {
      ...options,
      headers,
    });
  };

  let response = await executeRequest(false);
  if (response.status === 401) {
    response = await executeRequest(true);
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(payload.error || `Request failed (${response.status})`);
    (err as Error & { code?: string }).code = payload.code;
    throw err;
  }

  return payload as T;
}

export function formatInr(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDisplayDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const parsed = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return parsed.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function computeExpiryPreview(startDate: string, durationMonths: number): string {
  if (!startDate || !durationMonths) return '';
  const [y, m, d] = startDate.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setMonth(dt.getMonth() + durationMonths);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}
