import { FormEvent, useEffect, useState } from 'react';
import { Building2, Calendar, LogOut, Mail, Phone, ShieldCheck, User, X } from 'lucide-react';
import ownerDefaultAvatar from '../assets/images/owner_default_avatar_1794584534712.jpg';
import { apiFetch, formatDisplayDate, OwnerProfile } from '../lib/api';
import { PhotoCaptureField } from './PhotoCaptureField';
import { PhotoPreviewModal, PhotoPreviewTarget } from './PhotoPreviewModal';

interface OwnerProfileModalProps {
  open: boolean;
  owner: OwnerProfile;
  onClose: () => void;
  onOwnerUpdated: (updated: OwnerProfile) => void;
  onSignOut: () => void;
}

export function OwnerProfileModal({
  open,
  owner,
  onClose,
  onOwnerUpdated,
  onSignOut,
}: OwnerProfileModalProps) {
  const [ownerName, setOwnerName] = useState(owner.ownerName || '');
  const [gymName, setGymName] = useState(owner.gymName || '');
  const [mobileNumber, setMobileNumber] = useState(owner.mobileNumber || '');
  const [email, setEmail] = useState(owner.email || '');
  const [profilePhoto, setProfilePhoto] = useState<string | null>(owner.profilePhoto || null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<PhotoPreviewTarget | null>(null);

  useEffect(() => {
    if (!open) return;
    setOwnerName(owner.ownerName || '');
    setGymName(owner.gymName || '');
    setMobileNumber(owner.mobileNumber || '');
    setEmail(owner.email || '');
    setProfilePhoto(owner.profilePhoto || null);
    setError(null);
  }, [open, owner]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !previewPhoto) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, previewPhoto, onClose]);

  if (!open) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!ownerName.trim() || !gymName.trim() || !mobileNumber.trim()) {
      setError('Owner name, gym name, and mobile number are required.');
      return;
    }

    setSaving(true);
    try {
      const res = await apiFetch<{ owner: OwnerProfile }>('/api/owner/profile', {
        method: 'PUT',
        body: JSON.stringify({
          ownerName: ownerName.trim(),
          gymName: gymName.trim(),
          mobileNumber: mobileNumber.trim(),
          email: email.trim() || owner.email,
          profilePhoto,
        }),
      });
      onOwnerUpdated(res.owner);
      onClose();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Could not update owner profile.'
      );
    } finally {
      setSaving(false);
    }
  };

  const planLabel =
    owner.subscriptionPlan === 'none'
      ? 'Free Trial / No Active Plan'
      : `${owner.subscriptionPlan.replace('_', ' ')} (${owner.subscriptionStatus})`;

  const displayAvatar = profilePhoto || ownerDefaultAvatar;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Gym Owner Login Details"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-contain bg-black/60 p-3 sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="my-auto flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl"
      >
        {/* Dark Emerald Header Summary (pinned at top so close button & identity are always reachable) */}
        <div className="relative shrink-0 bg-gradient-to-br from-neutral-950 via-[#0A2218] to-[#064E3B] px-5 py-4 text-white sm:px-6 sm:py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <button
                type="button"
                onClick={() =>
                  setPreviewPhoto({
                    src: displayAvatar,
                    name: ownerName || owner.ownerName || 'Gym Owner',
                    subtitle: `${gymName || owner.gymName || 'GymManager'} · ${email || owner.email}`,
                  })
                }
                title="Click to view full photo"
                className="shrink-0 cursor-zoom-in rounded-xl transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              >
                <img
                  src={displayAvatar}
                  alt={ownerName || 'Gym Owner'}
                  referrerPolicy="no-referrer"
                  className="h-14 w-14 rounded-xl border-2 border-emerald-400/70 bg-neutral-900 object-cover sm:h-16 sm:w-16"
                />
              </button>
              <div className="min-w-0">
                <p className="text-xs font-semibold tracking-wide text-emerald-300">
                  Owner Login Account
                </p>
                <h2 className="truncate font-display text-lg font-bold text-white sm:text-xl">
                  {owner.ownerName || 'Gym Owner'}
                </h2>
                <p className="truncate text-xs text-emerald-100/80">
                  {owner.gymName || 'GymManager'} · {owner.email}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close owner details"
              className="rounded-lg p-1.5 text-neutral-300 transition-colors hover:bg-white/10 hover:text-white shrink-0"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Details & Photo Editor (scrolls cleanly up/down on tablets and phones) */}
        <form
          onSubmit={handleSubmit}
          className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-5 touch-pan-y [-webkit-overflow-scrolling:touch] sm:p-6"
        >
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Account Metadata Summary */}
            <div className="grid grid-cols-1 gap-3 rounded-xl border border-neutral-200 bg-neutral-50/70 p-4 sm:grid-cols-2">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-600 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-neutral-500">
                    Subscription Plan
                  </p>
                  <p className="truncate text-xs font-semibold capitalize text-neutral-950">
                    {planLabel}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Calendar className="mt-0.5 h-4 w-4 text-emerald-600 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-neutral-500">
                    Account Created
                  </p>
                  <p className="font-mono text-xs font-semibold text-neutral-950 tabular-nums">
                    {formatDisplayDate(owner.createdAt)}
                    {owner.subscriptionExpiresAt
                      ? ` · Plan ends ${formatDisplayDate(owner.subscriptionExpiresAt)}`
                      : ''}
                  </p>
                </div>
              </div>
            </div>

            {/* Upload or Take Owner Photo */}
            <PhotoCaptureField
              value={profilePhoto}
              onChange={setProfilePhoto}
              label="Owner Profile Photo"
              readyLabel="Owner photo ready for your profile"
              previewTitle={ownerName || 'Owner Profile Photo'}
            />

            {/* Editable Owner & Gym Details */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-neutral-700">
                  <User className="h-3.5 w-3.5 text-emerald-600" />
                  Owner Full Name
                </label>
                <input
                  type="text"
                  required
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="Owner full name"
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-950 outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-neutral-700">
                  <Building2 className="h-3.5 w-3.5 text-emerald-600" />
                  Gym / Studio Name
                </label>
                <input
                  type="text"
                  required
                  value={gymName}
                  onChange={(e) => setGymName(e.target.value)}
                  placeholder="Gym name"
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-950 outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-neutral-700">
                  <Phone className="h-3.5 w-3.5 text-emerald-600" />
                  Mobile Number
                </label>
                <input
                  type="tel"
                  required
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                  placeholder="9876543210"
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 font-mono text-sm text-neutral-950 outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-neutral-700">
                  <Mail className="h-3.5 w-3.5 text-emerald-600" />
                  Owner Login Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="owner@gym.com"
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-950 outline-none focus:border-emerald-600"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 pt-4">
              <button
                type="button"
                onClick={onSignOut}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign Out
              </button>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-neutral-300 px-4 py-2 text-xs font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-emerald-600 px-5 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
                >
                  {saving ? 'Saving...' : 'Save Owner Details'}
                </button>
              </div>
            </div>
          </form>
      </div>

      <PhotoPreviewModal
        photo={previewPhoto}
        onClose={() => setPreviewPhoto(null)}
      />
    </div>
  );
}
