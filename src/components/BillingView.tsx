import { useEffect, useState } from 'react';
import {
  Check,
  CreditCard,
  Lock,
  Receipt,
  ShieldCheck,
  Smartphone,
  X,
} from 'lucide-react';
import {
  apiFetch,
  formatDisplayDate,
  formatInr,
  OwnerProfile,
  SubscriptionPlan,
  SubscriptionTransaction,
} from '../lib/api';
import type { PrintableReceiptData } from './ReceiptModal';

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: (response: unknown) => void) => void;
    };
  }
}

interface BillingViewProps {
  owner: OwnerProfile;
  onOwnerUpdated: (owner: OwnerProfile) => void;
  onShowReceipt: (receipt: PrintableReceiptData) => void;
}

const PAYMENT_METHODS = [
  'UPI',
  'Google Pay',
  'PhonePe',
  'Debit Card',
  'Credit Card',
  'Net Banking',
] as const;

export function BillingView({
  owner,
  onOwnerUpdated,
  onShowReceipt,
}: BillingViewProps) {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [transactions, setTransactions] = useState<SubscriptionTransaction[]>([]);
  const [razorpayConfigured, setRazorpayConfigured] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('yearly');
  const [preferredMethod, setPreferredMethod] = useState<string>('UPI');
  const [loading, setLoading] = useState(true);
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadBilling = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{
        plans: SubscriptionPlan[];
        razorpayConfigured: boolean;
        transactions: SubscriptionTransaction[];
      }>('/api/billing/plans');
      setPlans(res.plans);
      setRazorpayConfigured(res.razorpayConfigured);
      setTransactions(res.transactions);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load billing plans.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBilling();
  }, []);

  const handlePayNow = async (plan: SubscriptionPlan) => {
    setError(null);
    setNotice(null);
    setProcessingPlan(plan.id);

    try {
      const order = await apiFetch<{
        orderId: string;
        amountPaise: number;
        amountInr: number;
        currency: string;
        keyId: string;
        receiptNumber: string;
        plan: SubscriptionPlan;
      }>('/api/billing/create-order', {
        method: 'POST',
        body: JSON.stringify({ planId: plan.id }),
      });

      if (!window.Razorpay) {
        throw new Error(
          'Razorpay Checkout script is still loading. Please try again in a moment.'
        );
      }

      const razorpayOptions = {
        key: order.keyId,
        amount: order.amountPaise,
        currency: order.currency,
        name: 'GymManager',
        description: `${order.plan.name} Owner Subscription (${order.plan.cadenceLabel})`,
        order_id: order.orderId,
        prefill: {
          name: owner.ownerName || '',
          email: owner.email || '',
          contact: owner.mobileNumber || '',
        },
        notes: {
          preferred_method: preferredMethod,
          gym_name: owner.gymName || '',
        },
        theme: {
          color: '#16A34A',
        },
        modal: {
          ondismiss: () => {
            setProcessingPlan(null);
          },
        },
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          try {
            const verified = await apiFetch<{
              verified: boolean;
              transaction: SubscriptionTransaction;
              owner: OwnerProfile;
            }>('/api/billing/verify-payment', {
              method: 'POST',
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                paymentMethod: preferredMethod,
              }),
            });

            if (verified.verified) {
              onOwnerUpdated(verified.owner);
              setNotice(
                `${order.plan.name} plan activated! Valid until ${formatDisplayDate(verified.owner.subscriptionExpiresAt)}.`
              );
              await loadBilling();
              onShowReceipt({
                receiptNumber: verified.transaction.receiptNumber,
                title: 'GymManager Subscription Receipt',
                gymName: 'GymManager SaaS Billing',
                recipientName: owner.gymName || owner.ownerName || 'Gym Owner',
                recipientMeta: `${owner.email} · ${owner.mobileNumber || ''}`,
                amount: verified.transaction.amountInr,
                paymentMethod:
                  verified.transaction.paymentMethod || preferredMethod,
                status: verified.transaction.status,
                date:
                  verified.transaction.verifiedAt ||
                  verified.transaction.createdAt,
                description: `${verified.transaction.planName} Plan Subscription`,
                referenceId: verified.transaction.razorpayPaymentId || undefined,
                validUntil: verified.transaction.periodEnd || undefined,
              });
            }
          } catch (verifyErr: unknown) {
            setError(
              verifyErr instanceof Error
                ? verifyErr.message
                : 'Backend payment verification failed.'
            );
          } finally {
            setProcessingPlan(null);
          }
        },
      };

      const rzp = new window.Razorpay(razorpayOptions);
      rzp.on('payment.failed', (failureResp: unknown) => {
        const msg =
          typeof failureResp === 'object' &&
          failureResp !== null &&
          'error' in failureResp
            ? String(
                (failureResp as { error?: { description?: string } }).error
                  ?.description || 'Payment failed.'
              )
            : 'Payment failed in Razorpay checkout.';
        setError(msg);
        setProcessingPlan(null);
      });
      rzp.open();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Unable to initiate Razorpay payment.'
      );
      setProcessingPlan(null);
    }
  };

  return (
    <div className="space-y-6">
      {!razorpayConfigured && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">
            Razorpay API keys required for live checkout
          </p>
          <p className="mt-1 text-xs leading-relaxed text-amber-800">
            Add <code className="font-mono font-semibold">RAZORPAY_KEY_ID</code>,{' '}
            <code className="font-mono font-semibold">RAZORPAY_KEY_SECRET</code>, and{' '}
            <code className="font-mono font-semibold">RAZORPAY_WEBHOOK_SECRET</code> in
            server Secrets. Subscriptions are never activated without server-side
            HMAC-SHA256 verification.
          </p>
        </div>
      )}

      {notice && (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Active Subscription Status Banner */}
      <div className="relative overflow-hidden flex flex-col justify-between gap-4 rounded-2xl bg-gradient-to-r from-neutral-950 via-[#0A2218] to-[#064E3B] p-6 text-white sm:flex-row sm:items-center">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-emerald-300">
            GymManager Owner Subscription
          </p>
          <h2 className="font-display text-xl font-bold">
            {owner.subscriptionStatus === 'active'
              ? `${owner.subscriptionPlan.replace('_', '-').toUpperCase()} Plan Active`
              : 'No Active Paid Subscription'}
          </h2>
          <p className="text-xs text-emerald-100/75">
            {owner.subscriptionExpiresAt
              ? `Subscription valid until ${formatDisplayDate(owner.subscriptionExpiresAt)}`
              : 'Select a plan below and verify payment via Razorpay to activate.'}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-emerald-400/25 bg-black/30 px-3.5 py-2 text-xs text-emerald-100">
          <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>Backend Signature & Webhook Verified</span>
        </div>
      </div>

      {/* Preferred Payment Method Selector */}
      <div className="rounded-xl border border-neutral-200 bg-white p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-neutral-950">
              Supported Razorpay Payment Methods
            </h3>
            <p className="text-xs text-neutral-500">
              Choose your preferred method before launching Razorpay Checkout
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs text-neutral-500">
            <Lock className="h-3.5 w-3.5 text-emerald-600" />
            256-bit Encrypted Checkout
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {PAYMENT_METHODS.map((method) => (
            <button
              key={method}
              type="button"
              onClick={() => setPreferredMethod(method)}
              className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                preferredMethod === method
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                  : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400'
              }`}
            >
              {method.includes('Card') ? (
                <CreditCard className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <Smartphone className="h-3.5 w-3.5 shrink-0" />
              )}
              {method}
            </button>
          ))}
        </div>
      </div>

      {/* 4 Subscription Plan Cards */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-64 animate-pulse rounded-xl border border-neutral-200 bg-white"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {plans.map((plan) => {
            const isSelected = selectedPlanId === plan.id;
            const isPaying = processingPlan === plan.id;
            return (
              <div
                key={plan.id}
                onClick={() => setSelectedPlanId(plan.id)}
                className={`flex cursor-pointer flex-col justify-between rounded-xl border p-6 transition-all ${
                  isSelected
                    ? 'border-emerald-600 bg-gradient-to-b from-emerald-50/70 to-white ring-2 ring-emerald-600/20'
                    : 'border-neutral-200 bg-white hover:border-emerald-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-display text-base font-bold text-neutral-950">
                      {plan.name}
                    </h3>
                    {plan.id === 'yearly' && (
                      <span className="text-xs font-semibold text-emerald-700">
                        Best Value
                      </span>
                    )}
                  </div>

                  <div className="mt-4 flex items-baseline gap-1.5">
                    <span className="font-mono text-3xl font-bold text-neutral-950 tabular-nums">
                      {formatInr(plan.amountInr)}
                    </span>
                    <span className="text-xs text-neutral-500">
                      {plan.cadenceLabel}
                    </span>
                  </div>

                  <p className="mt-3 text-xs leading-relaxed text-neutral-600">
                    {plan.summary}
                  </p>

                  <ul className="mt-4 space-y-2 border-t border-neutral-100 pt-4 text-xs text-neutral-700">
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      Unlimited member profiles & IDs
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      WhatsApp expiry automation
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      Payment receipts & analytics
                    </li>
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedPlanId(plan.id);
                    handlePayNow(plan);
                  }}
                  disabled={processingPlan !== null}
                  className={`mt-6 w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors whitespace-nowrap ${
                    isSelected
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                      : 'bg-neutral-950 text-white hover:bg-neutral-800'
                  } disabled:opacity-60`}
                >
                  {isPaying ? 'Opening Razorpay...' : 'Pay Now'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Transaction History */}
      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <div className="border-b border-neutral-200 px-5 py-4">
          <h3 className="text-sm font-semibold text-neutral-950">
            Subscription Transaction History
          </h3>
        </div>

        {transactions.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <p className="text-sm font-medium text-neutral-800">
              No subscription transactions yet
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              Verified Razorpay orders and receipts will appear here after checkout.
            </p>
          </div>
        ) : (
          <>
            {/* Mobile Card List */}
            <div className="divide-y divide-neutral-100 sm:hidden">
              {transactions.map((tx) => (
                <div key={tx.id} className="space-y-2.5 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-neutral-950">{tx.planName}</p>
                      <p className="mt-0.5 font-mono text-xs text-neutral-600 tabular-nums">
                        {tx.receiptNumber}
                      </p>
                    </div>
                    <div className="shrink-0 text-right font-mono tabular-nums">
                      <p className="text-sm font-bold text-neutral-950">
                        {formatInr(tx.amountInr)}
                      </p>
                      <p
                        className={`text-xs font-semibold ${
                          tx.status === 'verified'
                            ? 'text-emerald-700'
                            : tx.status === 'failed'
                            ? 'text-red-600'
                            : 'text-amber-700'
                        }`}
                      >
                        {tx.status === 'verified'
                          ? 'Verified'
                          : tx.status === 'failed'
                          ? 'Failed'
                          : 'Pending'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500">
                    <span>{tx.paymentMethod || 'Razorpay'}</span>
                    {tx.periodEnd && (
                      <span className="tabular-nums">
                        Until {formatDisplayDate(tx.periodEnd)}
                      </span>
                    )}
                  </div>

                  <p className="truncate font-mono text-[11px] text-neutral-400">
                    {tx.razorpayOrderId}
                    {tx.razorpayPaymentId ? ` · ${tx.razorpayPaymentId}` : ''}
                  </p>

                  {tx.status === 'verified' && (
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() =>
                          onShowReceipt({
                            receiptNumber: tx.receiptNumber,
                            title: 'GymManager Subscription Receipt',
                            gymName: 'GymManager SaaS Billing',
                            recipientName:
                              owner.gymName || owner.ownerName || 'Gym Owner',
                            recipientMeta: `${owner.email} · ${owner.mobileNumber || ''}`,
                            amount: tx.amountInr,
                            paymentMethod: tx.paymentMethod || 'Razorpay',
                            status: tx.status,
                            date: tx.verifiedAt || tx.createdAt,
                            description: `${tx.planName} Plan Subscription`,
                            referenceId: tx.razorpayPaymentId || tx.razorpayOrderId,
                            validUntil: tx.periodEnd || undefined,
                          })
                        }
                        className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-800 hover:bg-neutral-100"
                      >
                        <Receipt className="h-3.5 w-3.5" />
                        View Receipt
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop & Tablet Table */}
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50 text-xs font-semibold text-neutral-600">
                    <th className="px-4 py-3">Receipt</th>
                    <th className="px-4 py-3">Plan</th>
                    <th className="px-4 py-3">Razorpay Order / Payment</th>
                    <th className="px-4 py-3">Method</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3 text-right">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-neutral-50/70">
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-neutral-800 tabular-nums whitespace-nowrap">
                        {tx.receiptNumber}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-neutral-950">{tx.planName}</p>
                        {tx.periodEnd && (
                          <p className="text-xs text-neutral-500 tabular-nums">
                            Until {formatDisplayDate(tx.periodEnd)}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-neutral-600">
                        <p>{tx.razorpayOrderId}</p>
                        {tx.razorpayPaymentId && (
                          <p className="text-neutral-400">{tx.razorpayPaymentId}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-neutral-700 whitespace-nowrap">
                        {tx.paymentMethod || '—'}
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold whitespace-nowrap">
                        <span
                          className={
                            tx.status === 'verified'
                              ? 'text-emerald-700'
                              : tx.status === 'failed'
                              ? 'text-red-600'
                              : 'text-amber-700'
                          }
                        >
                          {tx.status === 'verified'
                            ? 'Verified'
                            : tx.status === 'failed'
                            ? 'Failed'
                            : 'Pending'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-neutral-950 tabular-nums whitespace-nowrap">
                        {formatInr(tx.amountInr)}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {tx.status === 'verified' ? (
                          <button
                            type="button"
                            onClick={() =>
                              onShowReceipt({
                                receiptNumber: tx.receiptNumber,
                                title: 'GymManager Subscription Receipt',
                                gymName: 'GymManager SaaS Billing',
                                recipientName:
                                  owner.gymName || owner.ownerName || 'Gym Owner',
                                recipientMeta: `${owner.email} · ${owner.mobileNumber || ''}`,
                                amount: tx.amountInr,
                                paymentMethod: tx.paymentMethod || 'Razorpay',
                                status: tx.status,
                                date: tx.verifiedAt || tx.createdAt,
                                description: `${tx.planName} Plan Subscription`,
                                referenceId: tx.razorpayPaymentId || tx.razorpayOrderId,
                                validUntil: tx.periodEnd || undefined,
                              })
                            }
                            className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs font-medium text-neutral-800 hover:bg-neutral-100"
                          >
                            <Receipt className="h-3.5 w-3.5" />
                            View
                          </button>
                        ) : (
                          <span className="text-xs text-neutral-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
