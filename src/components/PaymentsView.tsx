import { FormEvent, useEffect, useState } from 'react';
import { CheckCircle2, Plus, Receipt, X } from 'lucide-react';
import {
  apiFetch,
  formatDisplayDate,
  formatInr,
  GymMember,
  MemberPayment,
} from '../lib/api';
import type { PrintableReceiptData } from './ReceiptModal';

interface PaymentsViewProps {
  gymName: string;
  onShowReceipt: (receipt: PrintableReceiptData) => void;
  onDataChanged: () => void;
}

export function PaymentsView({
  gymName,
  onShowReceipt,
  onDataChanged,
}: PaymentsViewProps) {
  const [payments, setPayments] = useState<MemberPayment[]>([]);
  const [members, setMembers] = useState<GymMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'Paid' | 'Pending'>('all');

  const [showRecordModal, setShowRecordModal] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [amount, setAmount] = useState('1500');
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [paymentStatus, setPaymentStatus] = useState('Paid');
  const [notes, setNotes] = useState('Monthly membership fee');
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [payRes, memRes] = await Promise.all([
        apiFetch<{ payments: MemberPayment[] }>('/api/payments'),
        apiFetch<{ members: GymMember[] }>('/api/members'),
      ]);
      setPayments(payRes.payments);
      setMembers(memRes.members);
      if (memRes.members.length > 0 && !selectedMemberId) {
        setSelectedMemberId(String(memRes.members[0].id));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load payments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRecordPayment = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedMemberId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch<{ payment: MemberPayment }>('/api/payments', {
        method: 'POST',
        body: JSON.stringify({
          memberId: Number(selectedMemberId),
          amount: Number(amount),
          paymentMethod,
          paymentStatus,
          notes,
        }),
      });
      setShowRecordModal(false);
      await loadData();
      onDataChanged();
      onShowReceipt({
        receiptNumber: res.payment.receiptNumber,
        title: 'Member Payment Receipt',
        gymName,
        recipientName: res.payment.memberName || 'Member',
        recipientMeta: `${res.payment.memberCode || ''} · ${res.payment.memberMobile || ''}`,
        amount: res.payment.amount,
        paymentMethod: res.payment.paymentMethod,
        status: res.payment.paymentStatus,
        date: res.payment.paidAt,
        description: res.payment.notes || 'Gym Membership Fee',
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to record payment.');
    } finally {
      setSaving(false);
    }
  };

  const handleMarkPaid = async (p: MemberPayment) => {
    try {
      await apiFetch(`/api/payments/${p.id}/mark-paid`, { method: 'PATCH' });
      await loadData();
      onDataChanged();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not update payment.');
    }
  };

  const totalPaid = payments
    .filter((p) => p.paymentStatus === 'Paid')
    .reduce((sum, p) => sum + p.amount, 0);
  const totalPending = payments
    .filter((p) => p.paymentStatus === 'Pending')
    .reduce((sum, p) => sum + p.amount, 0);

  const visiblePayments = payments.filter((p) =>
    filterStatus === 'all' ? true : p.paymentStatus === filterStatus
  );

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-emerald-200/80 bg-gradient-to-br from-white to-emerald-50/75 p-5">
          <p className="text-xs font-semibold text-neutral-600">Total Collected Revenue</p>
          <p className="mt-2 font-mono text-2xl font-bold text-emerald-700 tabular-nums">
            {formatInr(totalPaid)}
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            Cash, UPI & online member fees
          </p>
        </div>

        <div className="rounded-xl border border-amber-200/80 bg-gradient-to-br from-white to-amber-50/75 p-5">
          <p className="text-xs font-semibold text-neutral-600">Pending Collections</p>
          <p className="mt-2 font-mono text-2xl font-bold text-amber-700 tabular-nums">
            {formatInr(totalPending)}
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            Unpaid invoices awaiting settlement
          </p>
        </div>

        <div className="rounded-xl border border-teal-200/80 bg-gradient-to-br from-white to-teal-50/75 p-5">
          <p className="text-xs font-semibold text-neutral-600">Total Receipts Issued</p>
          <p className="mt-2 font-mono text-2xl font-bold text-teal-800 tabular-nums">
            {payments.length}
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            Printable GST-ready fee receipts
          </p>
        </div>
      </div>

      {/* Filter & Record Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white p-4">
        <div className="flex items-center gap-1 rounded-lg bg-neutral-100 p-1">
          {(['all', 'Paid', 'Pending'] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setFilterStatus(status)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                filterStatus === status
                  ? 'bg-white text-neutral-950 shadow-sm'
                  : 'text-neutral-600 hover:text-neutral-950'
              }`}
            >
              {status === 'all' ? 'All Payments' : `${status} Payments`}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setShowRecordModal(true)}
          disabled={members.length === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" />
          Record Payment
        </button>
      </div>

      {/* Payments Table */}
      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        {loading ? (
          <div className="space-y-3 p-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-neutral-100" />
            ))}
          </div>
        ) : visiblePayments.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="text-base font-semibold text-neutral-900">
              No payment records found
            </p>
            <p className="mt-1 text-sm text-neutral-500">
              {members.length === 0
                ? 'Add a gym member first to start recording membership fees.'
                : 'Record cash, UPI, or online payments to generate member receipts.'}
            </p>
          </div>
        ) : (
          <>
            {/* Mobile Card List */}
            <div className="divide-y divide-neutral-100 sm:hidden">
              {visiblePayments.map((p) => (
                <div key={p.id} className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-neutral-950">
                        {p.memberName}
                      </p>
                      <p className="mt-0.5 font-mono text-xs text-neutral-500">
                        {p.memberCode} · {p.receiptNumber}
                      </p>
                    </div>
                    <div className="shrink-0 text-right font-mono tabular-nums">
                      <p className="text-sm font-bold text-neutral-950">
                        {formatInr(p.amount)}
                      </p>
                      <p
                        className={`text-xs font-semibold ${
                          p.paymentStatus === 'Paid'
                            ? 'text-emerald-700'
                            : 'text-amber-700'
                        }`}
                      >
                        {p.paymentStatus}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-neutral-500">
                    <span>{p.paymentMethod}</span>
                    <span className="font-mono tabular-nums">
                      {formatDisplayDate(p.paidAt)}
                    </span>
                  </div>

                  {p.notes && (
                    <p className="text-xs text-neutral-600">{p.notes}</p>
                  )}

                  <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                    {p.paymentStatus === 'Pending' && (
                      <button
                        type="button"
                        onClick={() => handleMarkPaid(p)}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Mark Paid
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        onShowReceipt({
                          receiptNumber: p.receiptNumber,
                          title: 'Member Payment Receipt',
                          gymName,
                          recipientName: p.memberName || 'Member',
                          recipientMeta: `${p.memberCode || ''} · ${p.memberMobile || ''}`,
                          amount: p.amount,
                          paymentMethod: p.paymentMethod,
                          status: p.paymentStatus,
                          date: p.paidAt,
                          description: p.notes || 'Gym Membership Fee',
                        })
                      }
                      className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-800 hover:bg-neutral-100"
                    >
                      <Receipt className="h-3.5 w-3.5" />
                      Receipt
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop & Tablet Table */}
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50 text-xs font-semibold text-neutral-600">
                    <th className="px-4 py-3">Receipt No.</th>
                    <th className="px-4 py-3">Member</th>
                    <th className="px-4 py-3">Method</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {visiblePayments.map((p) => (
                    <tr key={p.id} className="hover:bg-neutral-50/70">
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-neutral-800 tabular-nums whitespace-nowrap">
                        {p.receiptNumber}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-neutral-950">{p.memberName}</p>
                        <p className="font-mono text-xs text-neutral-500">
                          {p.memberCode} · {p.notes || 'Membership fee'}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-xs font-medium text-neutral-700 whitespace-nowrap">
                        {p.paymentMethod}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-neutral-600 tabular-nums whitespace-nowrap">
                        {formatDisplayDate(p.paidAt)}
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap">
                        <span
                          className={`font-semibold ${
                            p.paymentStatus === 'Paid'
                              ? 'text-emerald-700'
                              : 'text-amber-700'
                          }`}
                        >
                          {p.paymentStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-neutral-950 tabular-nums whitespace-nowrap">
                        {formatInr(p.amount)}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          {p.paymentStatus === 'Pending' && (
                            <button
                              type="button"
                              onClick={() => handleMarkPaid(p)}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Mark Paid
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              onShowReceipt({
                                receiptNumber: p.receiptNumber,
                                title: 'Member Payment Receipt',
                                gymName,
                                recipientName: p.memberName || 'Member',
                                recipientMeta: `${p.memberCode || ''} · ${p.memberMobile || ''}`,
                                amount: p.amount,
                                paymentMethod: p.paymentMethod,
                                status: p.paymentStatus,
                                date: p.paidAt,
                                description: p.notes || 'Gym Membership Fee',
                              })
                            }
                            className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs font-medium text-neutral-800 hover:bg-neutral-100"
                          >
                            <Receipt className="h-3.5 w-3.5" />
                            Receipt
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Record Payment Modal */}
      {showRecordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/60 p-3 sm:p-4">
          <div className="my-auto flex max-h-full w-full max-w-md flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl">
            <div className="flex shrink-0 items-center justify-between border-b border-neutral-200 px-5 py-4 sm:px-6">
              <h3 className="text-base font-bold text-neutral-950">
                Record Member Payment
              </h3>
              <button
                type="button"
                onClick={() => setShowRecordModal(false)}
                className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form
              onSubmit={handleRecordPayment}
              className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-5 touch-pan-y [-webkit-overflow-scrolling:touch] sm:p-6"
            >
              <div>
                <label className="mb-1 block text-xs font-semibold text-neutral-700">
                  Select Member
                </label>
                <select
                  required
                  value={selectedMemberId}
                  onChange={(e) => setSelectedMemberId(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-600"
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.fullName} ({m.memberCode})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-neutral-700">
                    Amount (₹)
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 font-mono text-sm outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-neutral-700">
                    Method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-600"
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="Online">Online</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-neutral-700">
                  Payment Status
                </label>
                <select
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-600"
                >
                  <option value="Paid">Paid</option>
                  <option value="Pending">Pending</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-neutral-700">
                  Description / Notes
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Monthly membership fee"
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
                />
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-neutral-200 pt-4">
                <button
                  type="button"
                  onClick={() => setShowRecordModal(false)}
                  className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {saving ? 'Recording...' : 'Save & Issue Receipt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
