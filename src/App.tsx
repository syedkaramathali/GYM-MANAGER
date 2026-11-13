import { onAuthStateChanged } from 'firebase/auth';
import {
  ChevronRight,
  CreditCard,
  Dumbbell,
  IndianRupee,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import ownerDefaultAvatar from './assets/images/owner_default_avatar_1794584534712.jpg';
import { AuthGate } from './components/AuthGate';
import { BillingView } from './components/BillingView';
import { DashboardView } from './components/DashboardView';
import { MemberFilterTab, MembersView } from './components/MembersView';
import { OwnerProfileModal } from './components/OwnerProfileModal';
import { PaymentsView } from './components/PaymentsView';
import { PrintableReceiptData, ReceiptModal } from './components/ReceiptModal';
import { WhatsappView } from './components/WhatsappView';
import { apiFetch, DashboardData, GymMember, OwnerProfile } from './lib/api';
import { auth, completeRedirectSignIn, signOutOwner } from './lib/firebase';

type NavSection = 'dashboard' | 'members' | 'payments' | 'whatsapp' | 'billing';

export default function App() {
  const [authInitialized, setAuthInitialized] = useState(false);
  const [firebaseSignedIn, setFirebaseSignedIn] = useState(false);
  const [owner, setOwner] = useState<OwnerProfile | null>(null);
  const [loadingOwner, setLoadingOwner] = useState(false);
  const [ownerError, setOwnerError] = useState<string | null>(null);

  const [section, setSection] = useState<NavSection>('dashboard');
  const [memberTab, setMemberTab] = useState<MemberFilterTab>('all');
  const [openAddMemberCount, setOpenAddMemberCount] = useState(0);
  const [quickRenewMember, setQuickRenewMember] = useState<GymMember | null>(null);

  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeReceipt, setActiveReceipt] = useState<PrintableReceiptData | null>(
    null
  );
  const [showOwnerProfile, setShowOwnerProfile] = useState(false);
  const [avatarImgFailed, setAvatarImgFailed] = useState(false);
  const mainScrollRef = useRef<HTMLElement | null>(null);

  const fetchOwnerProfile = useCallback(async () => {
    setLoadingOwner(true);
    setOwnerError(null);
    try {
      const res = await apiFetch<{ owner: OwnerProfile }>('/api/owner/me');
      setOwner(res.owner);
    } catch (err: unknown) {
      console.error('Owner profile sync failed:', err);
      setOwner(null);
      setOwnerError(
        err instanceof Error
          ? err.message
          : 'Unable to connect to your gym workspace. Please retry.'
      );
    } finally {
      setLoadingOwner(false);
    }
  }, []);

  const fetchDashboard = useCallback(async () => {
    setDashboardLoading(true);
    setDashboardError(null);
    try {
      const data = await apiFetch<DashboardData>('/api/dashboard');
      setDashboardData(data);
    } catch (err: unknown) {
      setDashboardError(
        err instanceof Error ? err.message : 'Unable to load dashboard.'
      );
    } finally {
      setDashboardLoading(false);
    }
  }, []);

  useEffect(() => {
    completeRedirectSignIn();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseSignedIn(Boolean(user));
      if (user) {
        await fetchOwnerProfile();
      } else {
        setOwner(null);
        setOwnerError(null);
        setDashboardData(null);
      }
      setAuthInitialized(true);
    });
    return () => unsubscribe();
  }, [fetchOwnerProfile]);

  useEffect(() => {
    if (owner?.isOnboarded) {
      fetchDashboard();
    }
  }, [owner?.isOnboarded, fetchDashboard]);

  if (!authInitialized || (firebaseSignedIn && loadingOwner && !owner)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50">
        <div className="space-y-3 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-neutral-950 text-emerald-400">
            <Dumbbell className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium text-neutral-600">
            Loading GymManager workspace...
          </p>
        </div>
      </div>
    );
  }

  if (!firebaseSignedIn) {
    return (
      <AuthGate
        mode="login"
        onAuthenticated={fetchOwnerProfile}
        onOnboardingComplete={(updated) => setOwner(updated)}
      />
    );
  }

  if (firebaseSignedIn && !owner) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4f7f5] p-4">
        <div className="w-full max-w-md space-y-4 rounded-2xl border border-neutral-200 bg-white p-6 text-center shadow-sm">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-neutral-950 text-emerald-400">
            <Dumbbell className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-neutral-950">
              Connection Interrupted
            </h2>
            <p className="mt-1 text-xs text-neutral-600">
              {ownerError || 'Could not load your gym owner profile on this device.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
            <button
              type="button"
              onClick={fetchOwnerProfile}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              Retry Connection
            </button>
            <button
              type="button"
              onClick={() => signOutOwner()}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
            >
              Switch Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (owner && !owner.isOnboarded) {
    return (
      <AuthGate
        mode="onboarding"
        initialOwner={owner}
        onAuthenticated={fetchOwnerProfile}
        onOnboardingComplete={(updated) => setOwner(updated)}
      />
    );
  }

  const navItems: { id: NavSection; label: string; icon: typeof LayoutDashboard }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'members', label: 'Members', icon: Users },
    { id: 'payments', label: 'Payments', icon: IndianRupee },
    { id: 'whatsapp', label: 'WhatsApp Alerts', icon: MessageSquare },
    { id: 'billing', label: 'Subscription', icon: CreditCard },
  ];

  const sectionTitles: Record<Exclude<NavSection, 'dashboard'>, string> = {
    members: 'Membership Management',
    payments: 'Payment Ledger & Receipts',
    whatsapp: 'WhatsApp Business Automation',
    billing: 'GymManager Plan & Razorpay Billing',
  };

  const scrollMainToTop = () => {
    mainScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleQuickAddMember = () => {
    setSection('members');
    setMemberTab('all');
    setOpenAddMemberCount((c) => c + 1);
    setMobileMenuOpen(false);
  };

  const handleQuickRemind = async (member: GymMember) => {
    try {
      await apiFetch('/api/whatsapp/send-manual', {
        method: 'POST',
        body: JSON.stringify({ memberId: member.id }),
      });
      setSection('whatsapp');
    } catch (err) {
      console.error('Quick reminder failed:', err);
    }
  };

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between overflow-y-auto overscroll-contain bg-gradient-to-b from-neutral-950 via-[#0B120E] to-[#071A12] px-4 py-6 text-white">
      <div className="space-y-8">
        {/* Brand */}
        <div className="flex items-center justify-between px-2">
          <button
            type="button"
            onClick={() => {
              setSection('dashboard');
              setMobileMenuOpen(false);
              scrollMainToTop();
            }}
            title="Go to Dashboard"
            aria-label="GymManager Home - Go to Dashboard"
            className="group flex min-w-0 items-center gap-2.5 rounded-lg text-left transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm transition-transform group-hover:scale-105 shrink-0">
              <Dumbbell className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="font-display text-base font-bold tracking-tight text-white whitespace-nowrap group-hover:text-emerald-300 transition-colors">
                GymManager
              </p>
              <p className="truncate text-xs text-emerald-300/80">
                {owner?.gymName || 'Owner Console'}
              </p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-900 hover:text-white lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="space-y-1.5" aria-label="Primary Sidebar Navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setSection(item.id);
                  setMobileMenuOpen(false);
                  scrollMainToTop();
                }}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all whitespace-nowrap ${
                  active
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm'
                    : 'text-neutral-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-white' : 'text-emerald-400/80'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Owner Profile & Logout */}
      <div className="space-y-3 border-t border-neutral-800 pt-5">
        <button
          type="button"
          onClick={() => {
            setShowOwnerProfile(true);
            setMobileMenuOpen(false);
          }}
          title="View Owner Login Details & Update Photo"
          aria-label="Open owner profile details and photo settings"
          className="group flex w-full items-center justify-between gap-2.5 rounded-xl px-2 py-2 text-left transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          <div className="flex min-w-0 items-center gap-3">
            {owner?.profilePhoto ? (
              <img
                src={owner.profilePhoto}
                alt={owner.ownerName || 'Gym owner'}
                referrerPolicy="no-referrer"
                className="h-9 w-9 rounded-lg object-cover border border-emerald-500/60 shrink-0"
              />
            ) : !avatarImgFailed ? (
              <img
                src={ownerDefaultAvatar}
                alt={owner?.ownerName || 'Gym owner'}
                referrerPolicy="no-referrer"
                onError={() => setAvatarImgFailed(true)}
                className="h-9 w-9 rounded-lg object-cover border border-neutral-800 shrink-0"
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-800 text-xs font-bold text-emerald-400 shrink-0">
                {(owner?.ownerName || 'GO').slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white group-hover:text-emerald-300 transition-colors">
                {owner?.ownerName || 'Gym Owner'}
              </p>
              <p className="truncate text-xs text-neutral-400">{owner?.email}</p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-neutral-500 group-hover:text-emerald-300 shrink-0" />
        </button>

        <button
          type="button"
          onClick={() => signOutOwner()}
          className="flex w-full items-center gap-2.5 rounded-lg border border-neutral-800 px-3 py-2 text-xs font-medium text-neutral-300 transition-colors hover:bg-neutral-900 hover:text-white"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[#f4f7f5] text-neutral-950 lg:flex-row print:h-auto print:overflow-visible">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block lg:h-full lg:w-64 lg:shrink-0">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Sidebar */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/60"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative z-10 h-full w-64 max-w-[80vw]">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* Top Bar Contract (Pinned — never scrolls with page content) */}
        <header className="z-30 flex shrink-0 items-center justify-between gap-4 border-b border-neutral-200/80 bg-white/95 px-4 py-3 backdrop-blur-xs sm:px-8">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="rounded-lg border border-neutral-200 p-2 text-neutral-700 hover:bg-neutral-50 lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              {section === 'dashboard' ? (
                <button
                  type="button"
                  onClick={() => {
                    setSection('dashboard');
                    scrollMainToTop();
                  }}
                  title="Go to Dashboard"
                  className="block max-w-full truncate text-left font-display text-lg font-bold text-neutral-950 transition-colors hover:text-emerald-700 focus:outline-none"
                >
                  {owner?.gymName || 'GymManager'}
                </button>
              ) : (
                <>
                  <p className="truncate text-xs font-medium text-emerald-700">
                    <button
                      type="button"
                      onClick={() => {
                        setSection('dashboard');
                        scrollMainToTop();
                      }}
                      className="hover:underline focus:outline-none"
                    >
                      {owner?.gymName || 'GymManager'}
                    </button>
                  </p>
                  <h1 className="truncate font-display text-lg font-bold text-neutral-950">
                    {sectionTitles[section]}
                  </h1>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {owner && (
              <button
                type="button"
                onClick={() => setShowOwnerProfile(true)}
                title="View Owner Login Details & Photo"
                className="hidden sm:inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-800 transition-colors hover:border-emerald-500 hover:bg-emerald-50/40 whitespace-nowrap shrink-0"
              >
                {owner.profilePhoto ? (
                  <img
                    src={owner.profilePhoto}
                    alt={owner.ownerName || 'Owner'}
                    referrerPolicy="no-referrer"
                    className="h-5 w-5 rounded object-cover"
                  />
                ) : (
                  <span className="flex h-5 w-5 items-center justify-center rounded bg-neutral-900 text-[10px] font-bold text-emerald-400">
                    {(owner.ownerName || 'GO').slice(0, 2).toUpperCase()}
                  </span>
                )}
                <span className="max-w-[130px] truncate">
                  {owner.ownerName || 'Owner Profile'}
                </span>
              </button>
            )}
            <button
              type="button"
              onClick={handleQuickAddMember}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-3.5 py-2 text-xs font-semibold text-white transition-all hover:from-emerald-700 hover:to-teal-700 whitespace-nowrap shrink-0"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Add Member
            </button>
          </div>
        </header>

        {/* Viewport Content */}
        <main
          ref={mainScrollRef}
          className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain touch-pan-y [-webkit-overflow-scrolling:touch]"
        >
          <div className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
          {section === 'dashboard' && (
            <DashboardView
              ownerName={owner?.ownerName || 'Gym Owner'}
              gymName={owner?.gymName || 'GymManager'}
              data={dashboardData}
              loading={dashboardLoading}
              error={dashboardError}
              onAddMember={handleQuickAddMember}
              onNavigateMembers={(tab) => {
                setMemberTab(tab);
                setSection('members');
                scrollMainToTop();
              }}
              onNavigateWhatsapp={() => {
                setSection('whatsapp');
                scrollMainToTop();
              }}
              onQuickRenew={(member) => {
                setQuickRenewMember(member);
                setSection('members');
                scrollMainToTop();
              }}
              onQuickRemind={handleQuickRemind}
              onRetry={fetchDashboard}
            />
          )}

          {section === 'members' && (
            <MembersView
              gymName={owner?.gymName || 'GymManager'}
              activeTab={memberTab}
              onTabChange={setMemberTab}
              openAddTrigger={openAddMemberCount}
              quickRenewMember={quickRenewMember}
              onClearQuickRenew={() => setQuickRenewMember(null)}
              onShowReceipt={setActiveReceipt}
              onDataChanged={fetchDashboard}
            />
          )}

          {section === 'payments' && (
            <PaymentsView
              gymName={owner?.gymName || 'GymManager'}
              onShowReceipt={setActiveReceipt}
              onDataChanged={fetchDashboard}
            />
          )}

          {section === 'whatsapp' && (
            <WhatsappView onDataChanged={fetchDashboard} />
          )}

          {section === 'billing' && owner && (
            <BillingView
              owner={owner}
              onOwnerUpdated={(updated) => setOwner(updated)}
              onShowReceipt={setActiveReceipt}
            />
          )}
          </div>
        </main>
      </div>

      <ReceiptModal
        receipt={activeReceipt}
        onClose={() => setActiveReceipt(null)}
      />

      {owner && (
        <OwnerProfileModal
          open={showOwnerProfile}
          owner={owner}
          onClose={() => setShowOwnerProfile(false)}
          onOwnerUpdated={(updated) => setOwner(updated)}
          onSignOut={() => {
            setShowOwnerProfile(false);
            signOutOwner();
          }}
        />
      )}
    </div>
  );
}
