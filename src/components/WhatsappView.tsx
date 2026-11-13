import { FormEvent, useEffect, useState } from 'react';
import { BellRing, Clock, Play, Send, X } from 'lucide-react';
import {
  apiFetch,
  formatDisplayDate,
  GymMember,
  WhatsappLog,
} from '../lib/api';

interface WhatsappViewProps {
  onDataChanged: () => void;
}

const REMINDER_RULES = [
  {
    timing: '7 Days Before Expiry',
    trigger: '7_days',
    template:
      '“Hello Rahul! Your gym membership will expire in 7 days. Please renew your membership to continue enjoying our gym facilities.”',
  },
  {
    timing: '3 Days Before Expiry',
    trigger: '3_days',
    template:
      '“Hello Rahul! Your gym membership will expire in 3 days. Please renew your membership to continue enjoying our gym facilities.”',
  },
  {
    timing: '1 Day Before Expiry',
    trigger: '1_day',
    template:
      '“Hello Rahul! Your gym membership will expire tomorrow (in 1 day). Please renew your membership to continue enjoying our gym facilities.”',
  },
  {
    timing: 'On Expiry Date',
    trigger: 'expiry_day',
    template:
      '“Hello Rahul! Your gym membership has expired today. Please renew your membership. Thank you!”',
  },
];

export function WhatsappView({ onDataChanged }: WhatsappViewProps) {
  const [logs, setLogs] = useState<WhatsappLog[]>([]);
  const [members, setMembers] = useState<GymMember[]>([]);
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [showSendModal, setShowSendModal] = useState(false);
  const [targetMemberId, setTargetMemberId] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [sendingManual, setSendingManual] = useState(false);

  const loadLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const [logRes, memRes] = await Promise.all([
        apiFetch<{ logs: WhatsappLog[]; configured: boolean }>('/api/whatsapp/logs'),
        apiFetch<{ members: GymMember[] }>('/api/members'),
      ]);
      setLogs(logRes.logs);
      setConfigured(logRes.configured);
      setMembers(memRes.members);
      if (memRes.members.length > 0 && !targetMemberId) {
        setTargetMemberId(String(memRes.members[0].id));
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Failed to load WhatsApp logs.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const handleRunDailyCheck = async () => {
    setRunning(true);
    setBanner(null);
    setError(null);
    try {
      const res = await apiFetch<{
        summary: {
          checked: number;
          triggered: number;
          sent: number;
          skippedDuplicates: number;
          notConfigured: number;
          failed: number;
        };
      }>('/api/whatsapp/run-reminders', { method: 'POST' });

      const s = res.summary;
      setBanner(
        `Checked ${s.checked} member(s): ${s.triggered} matched reminder window (${s.sent} sent, ${s.skippedDuplicates} already notified, ${s.notConfigured} awaiting API token, ${s.failed} failed).`
      );
      await loadLogs();
      onDataChanged();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Reminder check failed.');
    } finally {
      setRunning(false);
    }
  };

  const handleSendManual = async (e: FormEvent) => {
    e.preventDefault();
    if (!targetMemberId) return;
    setSendingManual(true);
    setError(null);
    try {
      const res = await apiFetch<{ log: WhatsappLog }>('/api/whatsapp/send-manual', {
        method: 'POST',
        body: JSON.stringify({
          memberId: Number(targetMemberId),
          messageBody: customMessage,
        }),
      });
      setShowSendModal(false);
      setCustomMessage('');
      setBanner(
        res.log.deliveryStatus === 'sent'
          ? 'WhatsApp message delivered via Meta Cloud API.'
          : `Message logged with status: ${res.log.deliveryStatus}.`
      );
      await loadLogs();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send message.');
    } finally {
      setSendingManual(false);
    }
  };

  return (
    <div className="space-y-6">
      {!configured && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">
            WhatsApp Business Cloud API credentials required for live delivery
          </p>
          <p className="mt-1 text-xs leading-relaxed text-amber-800">
            Configure <code className="font-mono font-semibold">WHATSAPP_ACCESS_TOKEN</code> and{' '}
            <code className="font-mono font-semibold">WHATSAPP_PHONE_NUMBER_ID</code> in
            server secrets to dispatch real WhatsApp messages via Meta Graph API. Automated
            triggers still evaluate and log all due reminders below.
          </p>
        </div>
      )}

      {banner && (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <span>{banner}</span>
          <button type="button" onClick={() => setBanner(null)}>
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

      {/* Action Header */}
      <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-neutral-950">
            Automated WhatsApp Expiry Schedule
          </h2>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-neutral-500">
            <Clock className="h-3.5 w-3.5 text-emerald-600" />
            Automated expiry check runs hourly, on dashboard load, and when members are saved
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowSendModal(true)}
            disabled={members.length === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3.5 py-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-50 disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <Send className="h-3.5 w-3.5" />
            Send Custom Message
          </button>
          <button
            type="button"
            onClick={handleRunDailyCheck}
            disabled={running}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 whitespace-nowrap shrink-0"
          >
            <Play className="h-3.5 w-3.5" />
            {running ? 'Checking Expiries...' : 'Run Expiry Check Now'}
          </button>
        </div>
      </div>

      {/* Automated Rules Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {REMINDER_RULES.map((rule, index) => {
          const cardStyles = [
            'border-teal-200/80 bg-gradient-to-br from-white to-teal-50/70',
            'border-emerald-200/80 bg-gradient-to-br from-white to-emerald-50/70',
            'border-amber-200/80 bg-gradient-to-br from-white to-amber-50/70',
            'border-rose-200/80 bg-gradient-to-br from-white to-rose-50/70',
          ][index % 4];
          const textColor = [
            'text-teal-700',
            'text-emerald-700',
            'text-amber-700',
            'text-rose-600',
          ][index % 4];

          return (
            <div
              key={rule.trigger}
              className={`rounded-xl border p-5 ${cardStyles}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${textColor}`}>
                  <BellRing className="h-3.5 w-3.5" />
                  {rule.timing}
                </span>
                <span className="font-mono text-xs text-neutral-500">{rule.trigger}</span>
              </div>
              <p className="mt-2.5 text-sm leading-relaxed text-neutral-700">
                {rule.template}
              </p>
            </div>
          );
        })}
      </div>

      {/* Dispatch Log Table */}
      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <div className="border-b border-neutral-200 px-5 py-4">
          <h3 className="text-sm font-semibold text-neutral-950">
            WhatsApp Notification Logs
          </h3>
        </div>

        {loading ? (
          <div className="space-y-3 p-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-neutral-100" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-semibold text-neutral-800">
              No WhatsApp notifications dispatched yet
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              Reminders appear here automatically when members reach 7, 3, 1, or 0 days
              before expiry, or when a membership is renewed.
            </p>
          </div>
        ) : (
          <>
            {/* Mobile Card List */}
            <div className="divide-y divide-neutral-100 sm:hidden">
              {logs.map((log) => (
                <div key={log.id} className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-neutral-950">
                        {log.memberName}
                      </p>
                      <p className="font-mono text-xs text-neutral-500 tabular-nums">
                        +{log.recipientPhone}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p
                        className={`text-xs font-semibold ${
                          log.deliveryStatus === 'sent'
                            ? 'text-emerald-700'
                            : log.deliveryStatus === 'failed'
                            ? 'text-red-600'
                            : 'text-amber-700'
                        }`}
                      >
                        {log.deliveryStatus === 'sent'
                          ? 'Delivered'
                          : log.deliveryStatus === 'not_configured'
                          ? 'Awaiting API Key'
                          : 'Failed'}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-neutral-500 tabular-nums">
                        {formatDisplayDate(log.sentAt)}
                      </p>
                    </div>
                  </div>
                  <p className="font-mono text-[11px] font-medium text-neutral-500">
                    Trigger: {log.triggerType}
                  </p>
                  <p className="text-xs leading-relaxed text-neutral-700">
                    {log.messageBody}
                  </p>
                  {log.errorMessage && (
                    <p className="text-xs text-amber-700">{log.errorMessage}</p>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop & Tablet Table */}
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50 text-xs font-semibold text-neutral-600">
                    <th className="px-4 py-3">Member</th>
                    <th className="px-4 py-3">Trigger</th>
                    <th className="px-4 py-3">Message</th>
                    <th className="px-4 py-3">Delivery</th>
                    <th className="px-4 py-3 text-right">Sent At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-neutral-50/70">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="font-medium text-neutral-950">{log.memberName}</p>
                        <p className="font-mono text-xs text-neutral-500 tabular-nums">
                          +{log.recipientPhone}
                        </p>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-neutral-700 whitespace-nowrap">
                        {log.triggerType}
                      </td>
                      <td className="max-w-md px-4 py-3 text-xs text-neutral-700">
                        <p className="line-clamp-2">{log.messageBody}</p>
                        {log.errorMessage && (
                          <p className="mt-0.5 text-xs text-amber-700">
                            {log.errorMessage}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold whitespace-nowrap">
                        <span
                          className={
                            log.deliveryStatus === 'sent'
                              ? 'text-emerald-700'
                              : log.deliveryStatus === 'failed'
                              ? 'text-red-600'
                              : 'text-amber-700'
                          }
                        >
                          {log.deliveryStatus === 'sent'
                            ? 'Delivered'
                            : log.deliveryStatus === 'not_configured'
                            ? 'Awaiting API Key'
                            : 'Failed'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-neutral-500 tabular-nums whitespace-nowrap">
                        {formatDisplayDate(log.sentAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Send Manual Message Modal */}
      {showSendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/60 p-3 sm:p-4">
          <div className="my-auto flex max-h-full w-full max-w-md flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl">
            <div className="flex shrink-0 items-center justify-between border-b border-neutral-200 px-5 py-4 sm:px-6">
              <h3 className="text-base font-bold text-neutral-950">
                Send WhatsApp Reminder
              </h3>
              <button
                type="button"
                onClick={() => setShowSendModal(false)}
                className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form
              onSubmit={handleSendManual}
              className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-5 touch-pan-y [-webkit-overflow-scrolling:touch] sm:p-6"
            >
              <div>
                <label className="mb-1 block text-xs font-semibold text-neutral-700">
                  Member
                </label>
                <select
                  value={targetMemberId}
                  onChange={(e) => setTargetMemberId(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-600"
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.fullName} ({m.whatsappNumber})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-neutral-700">
                  Message (Leave blank for automatic expiry reminder)
                </label>
                <textarea
                  rows={4}
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  placeholder="Hello! Your gym membership is coming up for renewal..."
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
                />
              </div>
              <div className="flex items-center justify-end gap-3 border-t border-neutral-200 pt-4">
                <button
                  type="button"
                  onClick={() => setShowSendModal(false)}
                  className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sendingManual}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {sendingManual ? 'Sending...' : 'Send via WhatsApp'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
