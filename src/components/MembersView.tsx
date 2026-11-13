import { FormEvent, useEffect, useState } from 'react';
import {
  CreditCard,
  Edit3,
  History,
  MessageSquare,
  RefreshCw,
  Search,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import {
  apiFetch,
  computeExpiryPreview,
  formatDisplayDate,
  formatInr,
  GymMember,
  MemberPayment,
  MembershipHistoryItem,
  WhatsappLog,
} from '../lib/api';
import { PhotoCaptureField } from './PhotoCaptureField';
import { PhotoPreviewModal, PhotoPreviewTarget } from './PhotoPreviewModal';
import type { PrintableReceiptData } from './ReceiptModal';

export type MemberFilterTab = 'all' | 'active' | 'expiring_soon' | 'expired';

interface MembersViewProps {
  gymName: string;
  activeTab: MemberFilterTab;
  onTabChange: (tab: MemberFilterTab) => void;
  openAddTrigger: number;
  quickRenewMember: GymMember | null;
  onClearQuickRenew: () => void;
  onShowReceipt: (receipt: PrintableReceiptData) => void;
  onDataChanged: () => void;
}

const DURATION_OPTIONS = [
  { label: '1 Month', months: 1 },
  { label: '3 Months', months: 3 },
  { label: '6 Months', months: 6 },
  { label: '1 Year', months: 12 },
];

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function MembersView({
  gymName,
  activeTab,
  onTabChange,
  openAddTrigger,
  quickRenewMember,
  onClearQuickRenew,
  onShowReceipt,
  onDataChanged,
}: MembersViewProps) {
  const [members, setMembers] = useState<GymMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<PhotoPreviewTarget | null>(null);

  // Add / Edit Member Modal
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [editingMember, setEditingMember] = useState<GymMember | null>(null);
  const [savingMember, setSavingMember] = useState(false);

  const [fullName, setFullName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [sameAsMobile, setSameAsMobile] = useState(true);
  const [age, setAge] = useState('25');
  const [gender, setGender] = useState('Male');
  const [startDate, setStartDate] = useState(todayIso());
  const [durationMonths, setDurationMonths] = useState(1);
  const [durationLabel, setDurationLabel] = useState('1 Month');
  const [expiryDate, setExpiryDate] = useState(computeExpiryPreview(todayIso(), 1));
  const [membershipAmount, setMembershipAmount] = useState('1500');
  const [paymentStatus, setPaymentStatus] = useState('Paid');
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);

  // Renewal Modal
  const [renewTarget, setRenewTarget] = useState<GymMember | null>(null);
  const [renewMonths, setRenewMonths] = useState(1);
  const [renewLabel, setRenewLabel] = useState('1 Month');
  const [renewAmount, setRenewAmount] = useState('1500');
  const [renewMethod, setRenewMethod] = useState('UPI');
  const [renewStatus, setRenewStatus] = useState('Paid');
  const [renewing, setRenewing] = useState(false);

  // Delete Confirmation Modal
  const [deleteTarget, setDeleteTarget] = useState<GymMember | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Member History & Digital ID Drawer
  const [historyData, setHistoryData] = useState<{
    member: GymMember;
    history: MembershipHistoryItem[];
    payments: MemberPayment[];
    notifications: WhatsappLog[];
  } | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadMembers = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('status', 'all');
      if (search.trim()) params.set('search', search.trim());
      const res = await apiFetch<{ members: GymMember[] }>(
        `/api/members?${params.toString()}`
      );
      setMembers(res.members);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load members.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMembers();
  }, [search]);

  useEffect(() => {
    if (openAddTrigger > 0) {
      openCreateModal();
    }
  }, [openAddTrigger]);

  useEffect(() => {
    if (quickRenewMember) {
      openRenewModal(quickRenewMember);
      onClearQuickRenew();
    }
  }, [quickRenewMember]);

  const openCreateModal = () => {
    setEditingMember(null);
    setFullName('');
    setMobileNumber('');
    setWhatsappNumber('');
    setSameAsMobile(true);
    setAge('25');
    setGender('Male');
    const today = todayIso();
    setStartDate(today);
    setDurationMonths(1);
    setDurationLabel('1 Month');
    setExpiryDate(computeExpiryPreview(today, 1));
    setMembershipAmount('1500');
    setPaymentStatus('Paid');
    setPaymentMethod('UPI');
    setProfilePhoto(null);
    setShowMemberModal(true);
  };

  const openEditModal = (m: GymMember) => {
    setEditingMember(m);
    setFullName(m.fullName);
    setMobileNumber(m.mobileNumber);
    setWhatsappNumber(m.whatsappNumber);
    setSameAsMobile(m.mobileNumber === m.whatsappNumber);
    setAge(String(m.age));
    setGender(m.gender);
    setStartDate(m.startDate);
    setDurationMonths(m.durationMonths);
    setDurationLabel(m.durationLabel);
    setExpiryDate(m.expiryDate);
    setMembershipAmount(String(m.membershipAmount));
    setPaymentStatus(m.paymentStatus);
    setProfilePhoto(m.profilePhoto);
    setShowMemberModal(true);
  };

  const openRenewModal = (m: GymMember) => {
    setRenewTarget(m);
    setRenewMonths(m.durationMonths || 1);
    setRenewLabel(m.durationLabel || '1 Month');
    setRenewAmount(String(m.membershipAmount || 1500));
    setRenewMethod('UPI');
    setRenewStatus('Paid');
  };

  const handleDurationSelect = (months: number, label: string) => {
    setDurationMonths(months);
    setDurationLabel(label);
    setExpiryDate(computeExpiryPreview(startDate, months));
  };

  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    setExpiryDate(computeExpiryPreview(val, durationMonths));
  };

  const handleSaveMember = async (e: FormEvent) => {
    e.preventDefault();
    setSavingMember(true);
    setError(null);

    const payload = {
      fullName,
      mobileNumber,
      whatsappNumber: sameAsMobile ? mobileNumber : whatsappNumber,
      age: Number(age || 25),
      gender,
      startDate,
      durationMonths,
      durationLabel,
      expiryDate,
      membershipAmount: Number(membershipAmount || 0),
      paymentStatus,
      paymentMethod,
      profilePhoto,
    };

    try {
      if (editingMember) {
        const res = await apiFetch<{
          member: GymMember;
          autoWhatsapp?: WhatsappLog | null;
        }>(`/api/members/${editingMember.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        const waNote = res.autoWhatsapp
          ? ` Automatic WhatsApp expiry alert triggered (${res.autoWhatsapp.deliveryStatus}).`
          : '';
        setNotice(`Updated member profile for ${fullName}.${waNote}`);
      } else {
        const res = await apiFetch<{
          member: GymMember;
          autoWhatsapp?: WhatsappLog | null;
        }>('/api/members', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        const waNote = res.autoWhatsapp
          ? ` Automatic WhatsApp expiry alert triggered (${res.autoWhatsapp.deliveryStatus}).`
          : '';
        setNotice(
          `Added ${res.member.fullName} with Digital ID ${res.member.memberCode}.${waNote}`
        );
      }
      setShowMemberModal(false);
      await loadMembers();
      onDataChanged();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save member.');
    } finally {
      setSavingMember(false);
    }
  };

  const handleConfirmRenew = async (e: FormEvent) => {
    e.preventDefault();
    if (!renewTarget) return;
    setRenewing(true);
    setError(null);
    try {
      const res = await apiFetch<{
        member: GymMember;
        receipt: MemberPayment;
        whatsappLog: WhatsappLog;
      }>(`/api/members/${renewTarget.id}/renew`, {
        method: 'POST',
        body: JSON.stringify({
          durationMonths: renewMonths,
          durationLabel: renewLabel,
          amount: Number(renewAmount || 0),
          paymentStatus: renewStatus,
          paymentMethod: renewMethod,
        }),
      });
      setRenewTarget(null);
      setNotice(
        `Renewed ${res.member.fullName} until ${formatDisplayDate(res.member.expiryDate)}. WhatsApp status: ${res.whatsappLog.deliveryStatus}.`
      );
      await loadMembers();
      onDataChanged();
      onShowReceipt({
        receiptNumber: res.receipt.receiptNumber,
        title: 'Membership Renewal Receipt',
        gymName,
        recipientName: res.member.fullName,
        recipientMeta: `${res.member.memberCode} · ${res.member.mobileNumber}`,
        amount: res.receipt.amount,
        paymentMethod: res.receipt.paymentMethod,
        status: res.receipt.paymentStatus,
        date: res.receipt.paidAt,
        description: `${renewLabel} Renewal`,
        validUntil: res.member.expiryDate,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Membership renewal failed.');
    } finally {
      setRenewing(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/members/${deleteTarget.id}`, { method: 'DELETE' });
      setNotice(`Removed member ${deleteTarget.fullName} (${deleteTarget.memberCode}).`);
      setDeleteTarget(null);
      await loadMembers();
      onDataChanged();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete member.');
    } finally {
      setDeleting(false);
    }
  };

  const openHistory = async (m: GymMember) => {
    setHistoryLoading(true);
    setHistoryData(null);
    try {
      const res = await apiFetch<{
        member: GymMember;
        history: MembershipHistoryItem[];
        payments: MemberPayment[];
        notifications: WhatsappLog[];
      }>(`/api/members/${m.id}/history`);
      setHistoryData(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load member history.');
    } finally {
      setHistoryLoading(false);
    }
  };

  const sendQuickWhatsapp = async (m: GymMember) => {
    try {
      const res = await apiFetch<{ log: WhatsappLog }>('/api/whatsapp/send-manual', {
        method: 'POST',
        body: JSON.stringify({ memberId: m.id }),
      });
      setNotice(
        res.log.deliveryStatus === 'sent'
          ? `WhatsApp reminder sent to ${m.fullName}.`
          : `WhatsApp message queued/logged (${res.log.deliveryStatus}). Check WhatsApp tab for API credentials.`
      );
      onDataChanged();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send reminder.');
    }
  };

  const counts = {
    all: members.length,
    active: members.filter(
      (m) => m.membershipState === 'active' || m.membershipState === 'expiring_soon'
    ).length,
    expiring_soon: members.filter((m) => m.membershipState === 'expiring_soon').length,
    expired: members.filter((m) => m.membershipState === 'expired').length,
  };

  const visibleMembers = members.filter((m) => {
    if (activeTab === 'active') {
      return m.membershipState === 'active' || m.membershipState === 'expiring_soon';
    }
    if (activeTab === 'expiring_soon') {
      return m.membershipState === 'expiring_soon';
    }
    if (activeTab === 'expired') {
      return m.membershipState === 'expired';
    }
    return true;
  });

  const tabs: { id: MemberFilterTab; label: string; count: number }[] = [
    { id: 'all', label: 'All Members', count: counts.all },
    { id: 'active', label: 'Active Members', count: counts.active },
    { id: 'expiring_soon', label: 'Expiring Soon', count: counts.expiring_soon },
    { id: 'expired', label: 'Expired Members', count: counts.expired },
  ];

  const pendingMembers = visibleMembers.filter((m) => m.paymentStatus === 'Pending');
  const totalPendingVisible = pendingMembers.reduce(
    (sum, m) => sum + m.membershipAmount,
    0
  );

  return (
    <div className="space-y-5">
      {notice && (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-emerald-700 hover:text-emerald-950"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-600 hover:text-red-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Toolbar: Segmented Filter Tabs + Search + Add */}
      <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-neutral-100 p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                activeTab === tab.id
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-950'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, mobile or ID..."
              className="w-full rounded-lg border border-neutral-300 bg-white py-2 pl-9 pr-3 text-sm text-neutral-950 outline-none focus:border-emerald-600"
            />
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 whitespace-nowrap shrink-0"
          >
            <UserPlus className="h-4 w-4" />
            Add New Member
          </button>
        </div>
      </div>

      {pendingMembers.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-2.5 text-xs text-amber-900">
          <span className="font-medium">
            {pendingMembers.length} member{pendingMembers.length === 1 ? ' has' : 's have'} a pending plan payment in this view
          </span>
          <span className="font-mono font-bold text-amber-800 tabular-nums">
            Total Pending Amount: {formatInr(totalPendingVisible)}
          </span>
        </div>
      )}

      {/* Members Data Table */}
      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        {loading ? (
          <div className="space-y-3 p-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-neutral-100" />
            ))}
          </div>
        ) : visibleMembers.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="text-base font-semibold text-neutral-900">
              No members match this view
            </p>
            <p className="mt-1 text-sm text-neutral-500">
              {search
                ? 'Try clearing your search filter or check another tab.'
                : 'Register a gym member to issue their digital membership ID.'}
            </p>
            {!search && (
              <button
                type="button"
                onClick={openCreateModal}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-neutral-950 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
              >
                <UserPlus className="h-4 w-4" />
                Add First Member
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Mobile Card Layout (prevents Member Name & Member ID crowding on phone) */}
            <div className="divide-y divide-neutral-100 md:hidden">
              {visibleMembers.map((m) => {
                const initials = m.fullName
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase();

                return (
                  <div key={m.id} className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 items-center gap-3">
                        {m.profilePhoto ? (
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewPhoto({
                                src: m.profilePhoto!,
                                name: m.fullName,
                                subtitle: `${m.memberCode} · ${m.mobileNumber} · ${m.durationLabel}`,
                              })
                            }
                            title={`View ${m.fullName}'s photo`}
                            aria-label={`View ${m.fullName}'s profile photo`}
                            className="shrink-0 cursor-zoom-in rounded-lg transition-all hover:ring-2 hover:ring-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          >
                            <img
                              src={m.profilePhoto}
                              alt={m.fullName}
                              className="h-11 w-11 rounded-lg border border-neutral-200 object-cover"
                            />
                          </button>
                        ) : (
                          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-neutral-900 text-xs font-semibold text-white shrink-0">
                            {initials}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-neutral-950">
                            {m.fullName}
                          </p>
                          <p className="mt-0.5 text-xs text-neutral-500">
                            {m.age} yrs · {m.gender}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <p className="text-[11px] font-medium text-neutral-400">
                          Member ID
                        </p>
                        <p className="font-mono text-xs font-semibold text-neutral-900 tabular-nums whitespace-nowrap">
                          {m.memberCode}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg bg-neutral-50/80 p-3 text-xs">
                      <div>
                        <p className="text-neutral-500">Mobile / WhatsApp</p>
                        <p className="mt-0.5 font-mono font-medium text-neutral-900 tabular-nums">
                          {m.mobileNumber}
                        </p>
                        {m.whatsappNumber !== m.mobileNumber && (
                          <p className="font-mono text-neutral-500 tabular-nums">
                            WA: {m.whatsappNumber}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-neutral-500">Plan & Expiry</p>
                        <p className="mt-0.5 font-medium text-neutral-900">
                          {m.durationLabel}
                        </p>
                        <p className="font-mono text-neutral-600 tabular-nums">
                          {formatDisplayDate(m.expiryDate)}
                        </p>
                      </div>
                      <div>
                        <p className="text-neutral-500">Membership Status</p>
                        <p className="mt-0.5">
                          {m.membershipState === 'expired' ? (
                            <span className="font-semibold text-red-600">
                              Expired ({Math.abs(m.daysRemaining)}d ago)
                            </span>
                          ) : m.membershipState === 'expiring_soon' ? (
                            <span className="font-semibold text-amber-700">
                              {m.daysRemaining === 0
                                ? 'Expires Today'
                                : `Expiring in ${m.daysRemaining}d`}
                            </span>
                          ) : (
                            <span className="font-semibold text-emerald-700">
                              Active ({m.daysRemaining}d left)
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="text-right font-mono tabular-nums">
                        <p className="font-sans text-neutral-500">Fee</p>
                        <p className="mt-0.5 font-semibold text-neutral-950">
                          {formatInr(m.membershipAmount)}
                        </p>
                        {m.paymentStatus === 'Pending' ? (
                          <p className="font-semibold text-amber-700">
                            Pending: {formatInr(m.membershipAmount)}
                          </p>
                        ) : (
                          <p className="text-emerald-700">Paid</p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => openRenewModal(m)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Renew
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openHistory(m)}
                          title="Digital ID & Full History"
                          className="rounded-lg border border-neutral-200 p-2 text-neutral-700 hover:bg-neutral-100"
                        >
                          <History className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => sendQuickWhatsapp(m)}
                          title="Send WhatsApp Reminder"
                          className="rounded-lg border border-neutral-200 p-2 text-neutral-700 hover:border-emerald-600 hover:text-emerald-700"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(m)}
                          title="Edit Member"
                          className="rounded-lg border border-neutral-200 p-2 text-neutral-700 hover:bg-neutral-100"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(m)}
                          title="Delete Member"
                          className="rounded-lg border border-neutral-200 p-2 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50 text-xs font-semibold text-neutral-600">
                    <th className="min-w-[220px] py-3 pl-4 pr-6">Member</th>
                    <th className="min-w-[140px] py-3 pl-2 pr-6 whitespace-nowrap">Member ID</th>
                    <th className="px-4 py-3">Contact</th>
                    <th className="px-4 py-3">Duration</th>
                    <th className="px-4 py-3">Expiry Date</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Fee</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {visibleMembers.map((m) => {
                    const initials = m.fullName
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase();

                    return (
                      <tr key={m.id} className="hover:bg-neutral-50/75">
                        <td className="min-w-[220px] py-3 pl-4 pr-6">
                          <div className="flex items-center gap-3">
                            {m.profilePhoto ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewPhoto({
                                    src: m.profilePhoto!,
                                    name: m.fullName,
                                    subtitle: `${m.memberCode} · ${m.mobileNumber} · ${m.durationLabel}`,
                                  })
                                }
                                title={`View ${m.fullName}'s photo`}
                                aria-label={`View ${m.fullName}'s profile photo`}
                                className="shrink-0 cursor-zoom-in rounded-lg transition-all hover:ring-2 hover:ring-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                              >
                                <img
                                  src={m.profilePhoto}
                                  alt={m.fullName}
                                  className="h-9 w-9 rounded-lg object-cover border border-neutral-200"
                                />
                              </button>
                            ) : (
                              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-900 text-xs font-semibold text-white shrink-0">
                                {initials}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-neutral-950">
                                {m.fullName}
                              </p>
                              <p className="text-xs text-neutral-500">
                                {m.age} yrs · {m.gender}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="min-w-[140px] py-3 pl-2 pr-6 font-mono text-xs font-semibold text-neutral-800 tabular-nums whitespace-nowrap">
                          {m.memberCode}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <p className="font-mono text-xs text-neutral-900 tabular-nums">
                            {m.mobileNumber}
                          </p>
                          <p className="font-mono text-xs text-neutral-500 tabular-nums">
                            WA: {m.whatsappNumber}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-xs text-neutral-700 whitespace-nowrap">
                          <p className="font-medium">{m.durationLabel}</p>
                          <p className="text-neutral-500 tabular-nums">
                            From {formatDisplayDate(m.startDate)}
                          </p>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-neutral-900 tabular-nums whitespace-nowrap">
                          {formatDisplayDate(m.expiryDate)}
                        </td>
                        <td className="px-4 py-3 text-xs whitespace-nowrap">
                          {m.membershipState === 'expired' ? (
                            <span className="font-semibold text-red-600">
                              Expired ({Math.abs(m.daysRemaining)}d ago)
                            </span>
                          ) : m.membershipState === 'expiring_soon' ? (
                            <span className="font-semibold text-amber-700">
                              {m.daysRemaining === 0
                                ? 'Expires Today'
                                : `Expiring in ${m.daysRemaining}d`}
                            </span>
                          ) : (
                            <span className="font-semibold text-emerald-700">
                              Active ({m.daysRemaining}d left)
                            </span>
                          )}
                          {m.paymentStatus === 'Pending' ? (
                            <span className="block font-semibold text-amber-700 tabular-nums">
                              Pending: {formatInr(m.membershipAmount)}
                            </span>
                          ) : (
                            <span className="block text-neutral-500">
                              Fee: Paid
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs tabular-nums whitespace-nowrap">
                          <p className="font-semibold text-neutral-950">
                            {formatInr(m.membershipAmount)}
                          </p>
                          {m.paymentStatus === 'Pending' ? (
                            <p className="font-semibold text-amber-700">
                              Pending: {formatInr(m.membershipAmount)}
                            </p>
                          ) : (
                            <p className="text-emerald-700">Paid</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openRenewModal(m)}
                              title="One-click Renew"
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
                            >
                              <RefreshCw className="h-3 w-3" />
                              Renew
                            </button>
                            <button
                              type="button"
                              onClick={() => openHistory(m)}
                              title="Digital ID & Full History"
                              className="rounded-lg border border-neutral-200 p-1.5 text-neutral-700 hover:bg-neutral-100"
                            >
                              <History className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => sendQuickWhatsapp(m)}
                              title="Send WhatsApp Reminder"
                              className="rounded-lg border border-neutral-200 p-1.5 text-neutral-700 hover:border-emerald-600 hover:text-emerald-700"
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditModal(m)}
                              title="Edit Member"
                              className="rounded-lg border border-neutral-200 p-1.5 text-neutral-700 hover:bg-neutral-100"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(m)}
                              title="Delete Member"
                              className="rounded-lg border border-neutral-200 p-1.5 text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Add / Edit Member Modal */}
      {showMemberModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/60 p-3 sm:p-4">
          <div className="my-auto flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl">
            <div className="flex shrink-0 items-center justify-between border-b border-neutral-200 px-5 py-4 sm:px-6">
              <div>
                <h3 className="text-base font-bold text-neutral-950">
                  {editingMember
                    ? `Edit Member · ${editingMember.memberCode}`
                    : 'Add New Gym Member'}
                </h3>
                <p className="text-xs text-neutral-500">
                  {editingMember
                    ? 'Update customer membership and contact information'
                    : 'Member ID is generated automatically upon registration'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowMemberModal(false)}
                className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              onSubmit={handleSaveMember}
              className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-5 touch-pan-y [-webkit-overflow-scrolling:touch] sm:p-6"
            >
              <PhotoCaptureField
                value={profilePhoto}
                onChange={setProfilePhoto}
              />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-neutral-700">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-neutral-700">
                    Mobile Number
                  </label>
                  <input
                    type="tel"
                    required
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value)}
                    placeholder="9876543210"
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 font-mono text-sm outline-none focus:border-emerald-600"
                  />
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="text-xs font-semibold text-neutral-700">
                      WhatsApp Number
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-neutral-600">
                      <input
                        type="checkbox"
                        checked={sameAsMobile}
                        onChange={(e) => setSameAsMobile(e.target.checked)}
                        className="rounded border-neutral-300 text-emerald-600"
                      />
                      Same as mobile
                    </label>
                  </div>
                  <input
                    type="tel"
                    required={!sameAsMobile}
                    disabled={sameAsMobile}
                    value={sameAsMobile ? mobileNumber : whatsappNumber}
                    onChange={(e) => setWhatsappNumber(e.target.value)}
                    placeholder="9876543210"
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 font-mono text-sm outline-none focus:border-emerald-600 disabled:bg-neutral-50 disabled:text-neutral-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-neutral-700">
                    Age
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={100}
                    required
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 font-mono text-sm outline-none focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-neutral-700">
                    Gender
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-600"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-neutral-700">
                    Membership Start Date
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 font-mono text-sm outline-none focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-neutral-700">
                    Membership Duration
                  </label>
                  <select
                    value={durationMonths}
                    onChange={(e) => {
                      const months = Number(e.target.value);
                      const opt = DURATION_OPTIONS.find((o) => o.months === months);
                      handleDurationSelect(
                        months,
                        opt?.label || `${months} Months`
                      );
                    }}
                    className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-600"
                  >
                    {DURATION_OPTIONS.map((opt) => (
                      <option key={opt.months} value={opt.months}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-neutral-700">
                    Membership Expiry Date (Auto-calculated)
                  </label>
                  <input
                    type="date"
                    required
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full rounded-lg border border-neutral-300 bg-emerald-50/40 px-3 py-2 font-mono text-sm font-medium text-neutral-950 outline-none focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-neutral-700">
                    Membership Amount (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={membershipAmount}
                    onChange={(e) => setMembershipAmount(e.target.value)}
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 font-mono text-sm outline-none focus:border-emerald-600"
                  />
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

                {!editingMember && (
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-neutral-700">
                      Payment Method
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-600"
                    >
                      <option value="UPI">UPI</option>
                      <option value="Cash">Cash</option>
                      <option value="Online">Online</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-neutral-200 pt-4">
                <button
                  type="button"
                  onClick={() => setShowMemberModal(false)}
                  className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingMember}
                  className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {savingMember
                    ? 'Saving...'
                    : editingMember
                    ? 'Save Changes'
                    : 'Create Member & ID'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* One-Click Renewal Modal */}
      {renewTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/60 p-3 sm:p-4">
          <div className="my-auto flex max-h-full w-full max-w-md flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl">
            <div className="flex shrink-0 items-center justify-between border-b border-neutral-200 px-5 py-4 sm:px-6">
              <div>
                <h3 className="text-base font-bold text-neutral-950">
                  Renew Membership
                </h3>
                <p className="text-xs text-neutral-500">
                  {renewTarget.fullName} · {renewTarget.memberCode}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRenewTarget(null)}
                className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              onSubmit={handleConfirmRenew}
              className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-5 touch-pan-y [-webkit-overflow-scrolling:touch] sm:p-6"
            >
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-700">
                Current Expiry:{' '}
                <span className="font-mono font-semibold text-neutral-950">
                  {formatDisplayDate(renewTarget.expiryDate)}
                </span>
                <span className="mx-1.5">·</span>
                New expiry will automatically extend from{' '}
                {renewTarget.daysRemaining >= 0 ? 'current expiry' : 'today'}.
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-neutral-700">
                  Renewal Duration
                </label>
                <select
                  value={renewMonths}
                  onChange={(e) => {
                    const m = Number(e.target.value);
                    const opt = DURATION_OPTIONS.find((o) => o.months === m);
                    setRenewMonths(m);
                    setRenewLabel(opt?.label || `${m} Months`);
                  }}
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-600"
                >
                  {DURATION_OPTIONS.map((opt) => (
                    <option key={opt.months} value={opt.months}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-neutral-700">
                    Renewal Fee (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={renewAmount}
                    onChange={(e) => setRenewAmount(e.target.value)}
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 font-mono text-sm outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-neutral-700">
                    Method
                  </label>
                  <select
                    value={renewMethod}
                    onChange={(e) => setRenewMethod(e.target.value)}
                    className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-600"
                  >
                    <option value="UPI">UPI</option>
                    <option value="Cash">Cash</option>
                    <option value="Online">Online</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-neutral-700">
                  Payment Status
                </label>
                <select
                  value={renewStatus}
                  onChange={(e) => setRenewStatus(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-600"
                >
                  <option value="Paid">Paid</option>
                  <option value="Pending">Pending</option>
                </select>
              </div>

              <p className="text-xs text-neutral-500">
                A payment receipt and WhatsApp renewal confirmation will be triggered
                automatically.
              </p>

              <div className="flex items-center justify-end gap-3 border-t border-neutral-200 pt-4">
                <button
                  type="button"
                  onClick={() => setRenewTarget(null)}
                  className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={renewing}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {renewing ? 'Renewing...' : 'Confirm Renewal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-6 shadow-xl">
            <h3 className="text-base font-bold text-neutral-950">Delete Member Record</h3>
            <p className="mt-2 text-sm text-neutral-600">
              Are you sure you want to permanently remove{' '}
              <span className="font-semibold text-neutral-950">
                {deleteTarget.fullName}
              </span>{' '}
              ({deleteTarget.memberCode}) and their history?
            </p>
            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deleting ? 'Deleting...' : 'Delete Record'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Member Digital ID Card & Complete History Modal */}
      {(historyLoading || historyData) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/60 p-3 sm:p-4">
          <div className="my-auto flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl">
            <div className="flex shrink-0 items-center justify-between border-b border-neutral-200 px-5 py-4 sm:px-6">
              <h3 className="text-base font-bold text-neutral-950">
                Digital Member ID & Complete History
              </h3>
              <button
                type="button"
                onClick={() => setHistoryData(null)}
                className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {historyLoading || !historyData ? (
              <div className="p-8 text-center text-sm text-neutral-500">
                Loading member history...
              </div>
            ) : (
              <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain p-5 touch-pan-y [-webkit-overflow-scrolling:touch] sm:p-6">
                {/* Digital Membership ID Pass */}
                <div className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-neutral-950 via-[#0A2218] to-[#064E3B] p-6 text-white">
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-emerald-500/20 blur-2xl"
                  />
                  <div className="relative flex flex-wrap items-start justify-between gap-5">
                    <div className="flex items-center gap-4">
                      {historyData.member.profilePhoto ? (
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewPhoto({
                              src: historyData.member.profilePhoto!,
                              name: historyData.member.fullName,
                              subtitle: `${historyData.member.memberCode} · ${historyData.member.mobileNumber}`,
                            })
                          }
                          title={`View ${historyData.member.fullName}'s photo`}
                          aria-label={`View ${historyData.member.fullName}'s profile photo`}
                          className="shrink-0 cursor-zoom-in rounded-xl transition-all hover:ring-2 hover:ring-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                        >
                          <img
                            src={historyData.member.profilePhoto}
                            alt={historyData.member.fullName}
                            className="h-20 w-20 rounded-xl border border-neutral-700 object-cover"
                          />
                        </button>
                      ) : (
                        <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-emerald-600 text-xl font-bold text-white">
                          {historyData.member.fullName
                            .split(' ')
                            .map((n) => n[0])
                            .join('')
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-semibold tracking-wide text-emerald-400">
                          {gymName} · Digital Member Pass
                        </p>
                        <p className="mt-0.5 font-display text-xl font-bold">
                          {historyData.member.fullName}
                        </p>
                        <p className="mt-1 font-mono text-xs text-neutral-300">
                          {historyData.member.memberCode} · {historyData.member.mobileNumber}
                        </p>
                        <p className="mt-0.5 text-xs text-neutral-400">
                          Age {historyData.member.age} · {historyData.member.gender}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-xs text-neutral-400">Valid Through</p>
                      <p className="mt-0.5 font-mono text-lg font-bold text-emerald-400 tabular-nums">
                        {formatDisplayDate(historyData.member.expiryDate)}
                      </p>
                      <p className="mt-1 text-xs font-medium text-neutral-200">
                        {historyData.member.durationLabel}
                      </p>
                      <p className="mt-0.5 text-xs text-neutral-400">
                        {historyData.member.membershipState === 'expired'
                          ? 'Expired'
                          : historyData.member.membershipState === 'expiring_soon'
                          ? 'Expiring Soon'
                          : 'Active'}
                      </p>
                      {historyData.member.paymentStatus === 'Pending' && (
                        <p className="mt-1 font-mono text-xs font-semibold text-amber-300 tabular-nums">
                          Pending: {formatInr(historyData.member.membershipAmount)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Membership Timeline */}
                <div>
                  <h4 className="mb-2.5 flex items-center gap-2 text-sm font-semibold text-neutral-950">
                    <CreditCard className="h-4 w-4 text-emerald-600" />
                    Membership & Renewal History
                  </h4>
                  <div className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
                    {historyData.history.map((h) => (
                      <div
                        key={h.id}
                        className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-xs"
                      >
                        <div>
                          <span className="font-semibold text-neutral-950">
                            {h.actionType}
                          </span>{' '}
                          <span className="text-neutral-500">· {h.durationLabel}</span>
                          <p className="mt-0.5 font-mono text-neutral-500 tabular-nums">
                            {formatDisplayDate(h.startDate)} to{' '}
                            {formatDisplayDate(h.expiryDate)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono font-semibold text-neutral-950 tabular-nums">
                            {formatInr(h.amount)}
                          </p>
                          <p className="text-neutral-500">
                            {h.paymentMethod} · {h.paymentStatus}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* WhatsApp Notifications for this member */}
                <div>
                  <h4 className="mb-2.5 flex items-center gap-2 text-sm font-semibold text-neutral-950">
                    <MessageSquare className="h-4 w-4 text-emerald-600" />
                    WhatsApp Notification History
                  </h4>
                  {historyData.notifications.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-neutral-200 px-4 py-4 text-xs text-neutral-500">
                      No WhatsApp messages sent to this member yet.
                    </p>
                  ) : (
                    <div className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
                      {historyData.notifications.map((n) => (
                        <div key={n.id} className="px-4 py-2.5 text-xs">
                          <div className="flex items-center justify-between text-neutral-500">
                            <span className="font-medium text-neutral-800">
                              {n.triggerType}
                            </span>
                            <span className="tabular-nums">
                              {formatDisplayDate(n.sentAt)} · {n.deliveryStatus}
                            </span>
                          </div>
                          <p className="mt-1 text-neutral-700">{n.messageBody}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <PhotoPreviewModal
        photo={previewPhoto}
        onClose={() => setPreviewPhoto(null)}
      />
    </div>
  );
}
