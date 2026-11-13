import { FormEvent, useState } from 'react';
import { ArrowRight, CheckCircle2, Dumbbell, ShieldCheck } from 'lucide-react';
import gymLoginHero from '../assets/images/gym_login_hero_1794584534701.jpg';
import { apiFetch, OwnerProfile } from '../lib/api';
import { signInWithGoogle, signOutOwner } from '../lib/firebase';
import { PhotoCaptureField } from './PhotoCaptureField';

interface AuthGateProps {
  mode: 'login' | 'onboarding';
  initialOwner?: OwnerProfile | null;
  onAuthenticated: () => Promise<void>;
  onOnboardingComplete: (owner: OwnerProfile) => void;
}

export function AuthGate({
  mode,
  initialOwner,
  onAuthenticated,
  onOnboardingComplete,
}: AuthGateProps) {
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [heroImgFailed, setHeroImgFailed] = useState(false);

  const [ownerName, setOwnerName] = useState(initialOwner?.ownerName || '');
  const [gymName, setGymName] = useState(initialOwner?.gymName || '');
  const [mobileNumber, setMobileNumber] = useState(initialOwner?.mobileNumber || '');
  const [email, setEmail] = useState(initialOwner?.email || '');
  const [profilePhoto, setProfilePhoto] = useState<string | null>(
    initialOwner?.profilePhoto || null
  );
  const [saving, setSaving] = useState(false);

  const handleGoogleSignIn = async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      await signInWithGoogle();
      await onAuthenticated();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Unable to complete Google sign-in.';
      setAuthError(msg);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleOnboardingSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!ownerName.trim() || !gymName.trim() || !mobileNumber.trim() || !email.trim()) {
      setAuthError('Please fill in all required gym owner registration fields.');
      return;
    }

    setSaving(true);
    try {
      const res = await apiFetch<{ owner: OwnerProfile }>('/api/owner/register', {
        method: 'POST',
        body: JSON.stringify({
          ownerName: ownerName.trim(),
          gymName: gymName.trim(),
          mobileNumber: mobileNumber.trim(),
          email: email.trim(),
          profilePhoto,
        }),
      });
      onOnboardingComplete(res.owner);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Failed to save gym registration.';
      setAuthError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-neutral-950 lg:grid lg:grid-cols-12 lg:items-stretch">
      {/* Left Form Panel */}
      <div className="flex flex-col justify-between px-6 py-8 sm:px-12 lg:col-span-7 lg:px-16 lg:py-12">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-950 text-emerald-400">
              <Dumbbell className="h-5 w-5" />
            </div>
            <span className="font-display text-lg font-bold tracking-tight text-neutral-950 whitespace-nowrap shrink-0">
              GymManager
            </span>
          </div>
          {mode === 'onboarding' && (
            <button
              type="button"
              onClick={() => signOutOwner()}
              className="text-sm font-medium text-neutral-600 transition-colors hover:text-neutral-950 whitespace-nowrap shrink-0"
            >
              Switch Account
            </button>
          )}
        </header>

        <main className="mx-auto my-10 w-full max-w-md">
          {mode === 'login' ? (
            <div className="space-y-6">
              <div className="space-y-3">
                <p className="text-xs font-semibold tracking-wide text-emerald-700">
                  Exclusively for Gym & Studio Owners
                </p>
                <h1 className="font-display text-3xl font-bold tracking-tight text-neutral-950 sm:text-4xl [text-wrap:balance]">
                  Run your gym floor without manual expiry spreadsheets.
                </h1>
                <p className="text-base leading-relaxed text-neutral-600">
                  Register your fitness club, issue digital member IDs, track renewal
                  dates, collect payments, and automate WhatsApp expiry reminders from one
                  private workspace.
                </p>
              </div>

              {authError && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                  {authError}
                </div>
              )}

              <div className="space-y-4 pt-2">
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={authLoading}
                  className="flex w-full items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-neutral-950 via-[#0A2218] to-[#064E3B] px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#EA4335"
                      d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.8-5.5 3.8-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.3 14.6 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12s4.3 9.6 9.6 9.6c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12z"
                    />
                  </svg>
                  <span className="whitespace-nowrap">
                    {authLoading
                      ? 'Verifying Owner Account...'
                      : 'Sign in or Register with Google'}
                  </span>
                </button>

                <p className="text-xs leading-relaxed text-neutral-500">
                  New gym owners will enter their Gym Name and Mobile Number right after
                  Google verification. Customers never have access to this dashboard.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 border-t border-neutral-200 pt-6 sm:grid-cols-2">
                <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-3.5 space-y-1">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-neutral-900">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    Gym-Wise Isolation
                  </p>
                  <p className="text-xs text-neutral-600">
                    Every owner gets an isolated database workspace scoped to their gym.
                  </p>
                </div>
                <div className="rounded-xl border border-teal-200/80 bg-teal-50/50 p-3.5 space-y-1">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-neutral-900">
                    <CheckCircle2 className="h-4 w-4 text-teal-600" />
                    WhatsApp Cloud Alerts
                  </p>
                  <p className="text-xs text-neutral-600">
                    Automated reminders at 7 days, 3 days, 1 day, and expiry day.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleOnboardingSubmit} className="space-y-5">
              <div className="space-y-2">
                <p className="text-xs font-semibold tracking-wide text-emerald-700">
                  Step 2 of 2 · Gym Owner Setup
                </p>
                <h1 className="font-display text-2xl font-bold tracking-tight text-neutral-950 sm:text-3xl">
                  Register your gym workspace
                </h1>
                <p className="text-sm text-neutral-600">
                  Complete your gym owner profile to generate digital member IDs and
                  personalized WhatsApp renewal notices.
                </p>
              </div>

              {authError && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                  {authError}
                </div>
              )}

              <div className="space-y-4">
                <PhotoCaptureField
                  value={profilePhoto}
                  onChange={setProfilePhoto}
                  label="Owner Profile Photo (Optional)"
                  readyLabel="Owner photo ready"
                  previewTitle={ownerName || 'Owner Profile Photo'}
                />

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-neutral-800">
                    Owner Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    placeholder="e.g. Vikram Deshmukh"
                    className="w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-950 outline-none transition-colors focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-neutral-800">
                    Gym / Fitness Studio Name
                  </label>
                  <input
                    type="text"
                    required
                    value={gymName}
                    onChange={(e) => setGymName(e.target.value)}
                    placeholder="e.g. IronCore Strength Club"
                    className="w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-950 outline-none transition-colors focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-neutral-800">
                      Mobile Number
                    </label>
                    <input
                      type="tel"
                      required
                      value={mobileNumber}
                      onChange={(e) => setMobileNumber(e.target.value)}
                      placeholder="9876543210"
                      className="w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 font-mono text-sm text-neutral-950 outline-none transition-colors focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-neutral-800">
                      Owner Email
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="owner@gym.com"
                      className="w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-950 outline-none transition-colors focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
              >
                <span>{saving ? 'Creating Workspace...' : 'Launch Gym Dashboard'}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          )}
        </main>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 pt-4 text-xs text-neutral-500">
          <span>GymManager Owner Platform</span>
          <span>Owner-Only Access · Private Gym Data Isolation</span>
        </footer>
      </div>

      {/* Right Visual Showcase */}
      <div className="relative hidden bg-neutral-950 lg:col-span-5 lg:block">
        {!heroImgFailed ? (
          <img
            src={gymLoginHero}
            alt="Modern strength and conditioning gym interior"
            referrerPolicy="no-referrer"
            onError={() => setHeroImgFailed(true)}
            className="h-full w-full object-cover opacity-85"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-neutral-900 via-neutral-950 to-emerald-950 p-12">
            <Dumbbell className="h-16 w-16 text-emerald-500" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
        <div className="absolute inset-x-8 bottom-8 space-y-3 text-white">
          <p className="text-xs font-semibold tracking-wide text-emerald-400">
            Automated Retention Engine
          </p>
          <p className="font-display text-xl font-semibold leading-snug">
            “Track every expiry, collect UPI and card payments, and renew memberships in
            one click.”
          </p>
          <div className="flex items-center gap-3 pt-1 text-xs text-neutral-300">
            <span>Digital Member IDs</span>
            <span aria-hidden="true">·</span>
            <span>WhatsApp Cloud API</span>
            <span aria-hidden="true">·</span>
            <span>Razorpay Verified</span>
          </div>
        </div>
      </div>
    </div>
  );
}
