import { Printer, X } from 'lucide-react';
import { formatDisplayDate, formatInr } from '../lib/api';

export interface PrintableReceiptData {
  receiptNumber: string;
  title: string;
  gymName: string;
  recipientName: string;
  recipientMeta: string;
  amount: number;
  paymentMethod: string;
  status: string;
  date: string;
  description: string;
  referenceId?: string;
  validUntil?: string;
}

interface ReceiptModalProps {
  receipt: PrintableReceiptData | null;
  onClose: () => void;
}

export function ReceiptModal({ receipt, onClose }: ReceiptModalProps) {
  if (!receipt) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/60 p-3 sm:p-4">
      <div className="my-auto flex max-h-full w-full max-w-md flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl">
        <div className="flex shrink-0 items-center justify-between border-b border-neutral-200 px-5 py-4 sm:px-6">
          <h3 className="text-base font-semibold text-neutral-950">Payment Receipt</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
            aria-label="Close receipt"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div
          id="printable-receipt"
          className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-5 touch-pan-y [-webkit-overflow-scrolling:touch] sm:p-6"
        >
          <div className="flex items-start justify-between border-b border-neutral-200 pb-4">
            <div>
              <p className="text-xs font-medium text-neutral-500">Issued by</p>
              <p className="mt-0.5 text-lg font-bold text-neutral-950">{receipt.gymName}</p>
              <p className="text-xs text-neutral-500">{receipt.title}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-medium text-neutral-500">Receipt No.</p>
              <p className="mt-0.5 font-mono text-sm font-semibold text-neutral-950 tabular-nums">
                {receipt.receiptNumber}
              </p>
              <p className="mt-0.5 text-xs text-neutral-500 tabular-nums">
                {formatDisplayDate(receipt.date)}
              </p>
            </div>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-neutral-500">Billed To</span>
              <span className="text-right font-medium text-neutral-950">
                {receipt.recipientName}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-neutral-500">Details</span>
              <span className="text-right font-mono text-xs text-neutral-700">
                {receipt.recipientMeta}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-neutral-500">Description</span>
              <span className="text-right text-neutral-900">{receipt.description}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-neutral-500">Payment Method</span>
              <span className="text-right font-medium text-neutral-900">
                {receipt.paymentMethod}
              </span>
            </div>
            {receipt.referenceId && (
              <div className="flex justify-between gap-4">
                <span className="text-neutral-500">Transaction ID</span>
                <span className="text-right font-mono text-xs text-neutral-700">
                  {receipt.referenceId}
                </span>
              </div>
            )}
            {receipt.validUntil && (
              <div className="flex justify-between gap-4">
                <span className="text-neutral-500">Valid Until</span>
                <span className="text-right font-medium text-emerald-700 tabular-nums">
                  {formatDisplayDate(receipt.validUntil)}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-neutral-200 pt-4">
            <div>
              <p className="text-xs text-neutral-500">Status</p>
              <p
                className={`text-sm font-semibold ${
                  receipt.status === 'Paid' || receipt.status === 'verified'
                    ? 'text-emerald-700'
                    : 'text-amber-700'
                }`}
              >
                {receipt.status === 'verified' ? 'Verified & Paid' : receipt.status}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-neutral-500">Total Amount</p>
              <p className="font-mono text-2xl font-bold text-neutral-950 tabular-nums">
                {formatInr(receipt.amount)}
              </p>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-neutral-200 px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 whitespace-nowrap shrink-0"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg bg-neutral-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-800 whitespace-nowrap shrink-0"
          >
            <Printer className="h-4 w-4" />
            Print Receipt
          </button>
        </div>
      </div>
    </div>
  );
}
