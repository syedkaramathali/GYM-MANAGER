import { useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  IndianRupee,
  MessageSquare,
  RefreshCw,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
  UserX,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  DashboardData,
  formatDisplayDate,
  formatInr,
  GymMember,
} from '../lib/api';
import { PhotoPreviewModal, PhotoPreviewTarget } from './PhotoPreviewModal';

interface DashboardViewProps {
  ownerName: string;
  gymName: string;
  data: DashboardData | null;
  loading: boolean;
  error: string | null;
  onAddMember: () => void;
  onNavigateMembers: (filter: 'all' | 'active' | 'expiring_soon' | 'expired') => void;
  onNavigateWhatsapp: () => void;
  onQuickRenew: (member: GymMember) => void;
  onQuickRemind: (member: GymMember) => void;
  onRetry: () => void;
}

export function DashboardView({
  ownerName,
  gymName,
  data,
  loading,
  error,
  onAddMember,
  onNavigateMembers,
  onNavigateWhatsapp,
  onQuickRenew,
  onQuickRemind,
  onRetry,
}: DashboardViewProps) {
  const [previewPhoto, setPreviewPhoto] = useState<PhotoPreviewTarget | null>(null);

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <div className="h-36 animate-pulse rounded-2xl bg-neutral-900" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-xl border border-neutral-200 bg-white p-5"
            />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="h-72 animate-pulse rounded-xl border border-neutral-200 bg-white lg:col-span-2" />
          <div className="h-72 animate-pulse rounded-xl border border-neutral-200 bg-white" />
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        <p className="font-semibold">Could not load dashboard metrics</p>
        <p className="mt-1">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-lg bg-neutral-950 px-4 py-2 text-xs font-semibold text-white hover:bg-neutral-800"
        >
          Retry
        </button>
      </div>
    );
  }

  const stats = data?.stats || {
    totalMembers: 0,
    activeMembers: 0,
    healthyActiveMembers: 0,
    expiringSoonMembers: 0,
    expiredMembers: 0,
    monthlyRevenue: 0,
    totalRevenue: 0,
    pendingAmount: 0,
  };

  const retentionRate =
    stats.totalMembers > 0
      ? Math.round((stats.activeMembers / stats.totalMembers) * 100)
      : 100;

  const kpis = [
    {
      label: 'Total Members',
      value: String(stats.totalMembers),
      meta: 'Registered profiles',
      icon: Users,
      cardClass: 'border-neutral-200 bg-gradient-to-br from-white to-neutral-100/70',
      iconBg: 'bg-neutral-950 text-emerald-400',
      accent: 'text-neutral-950',
      onClick: () => onNavigateMembers('all'),
    },
    {
      label: 'Active Members',
      value: String(stats.activeMembers),
      meta: 'Valid memberships',
      icon: UserCheck,
      cardClass: 'border-emerald-200/80 bg-gradient-to-br from-white to-emerald-50/80',
      iconBg: 'bg-emerald-600 text-white',
      accent: 'text-emerald-700',
      onClick: () => onNavigateMembers('active'),
    },
    {
      label: 'Expiring Soon',
      value: String(stats.expiringSoonMembers),
      meta: 'Within next 7 days',
      icon: AlertTriangle,
      cardClass: 'border-amber-200/80 bg-gradient-to-br from-white to-amber-50/80',
      iconBg: 'bg-amber-500 text-white',
      accent: 'text-amber-700',
      onClick: () => onNavigateMembers('expiring_soon'),
    },
    {
      label: 'Expired Memberships',
      value: String(stats.expiredMembers),
      meta: 'Need renewal follow-up',
      icon: UserX,
      cardClass: 'border-rose-200/80 bg-gradient-to-br from-white to-rose-50/80',
      iconBg: 'bg-rose-600 text-white',
      accent: 'text-rose-600',
      onClick: () => onNavigateMembers('expired'),
    },
    {
      label: 'Monthly Revenue',
      value: formatInr(stats.monthlyRevenue),
      meta:
        stats.pendingAmount > 0
          ? `Pending ${formatInr(stats.pendingAmount)} · Total ${formatInr(stats.totalRevenue)}`
          : `Total collected ${formatInr(stats.totalRevenue)}`,
      icon: IndianRupee,
      cardClass: 'border-teal-200/80 bg-gradient-to-br from-white to-teal-50/80',
      iconBg: 'bg-teal-600 text-white',
      accent: 'text-teal-700',
      onClick: () => onNavigateMembers('all'),
    },
  ];

  const hasPieData = (data?.statusBreakdown || []).some((item) => item.value > 0);

  return (
    <div className="space-y-6">
      {/* High-Contrast Black & Emerald Command Banner */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-neutral-950 via-[#0A2218] to-[#064E3B] p-6 text-white sm:p-7">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-12 -top-20 h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-teal-400/15 blur-3xl"
        />
        <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-wide text-emerald-300">
              {gymName} · Daily Operations
            </p>
            <h2 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Welcome back, {ownerName.split(' ')[0] || 'Owner'}
            </h2>
            <p className="max-w-xl text-sm text-emerald-50/85">
              {stats.expiringSoonMembers > 0
                ? `${stats.expiringSoonMembers} member${stats.expiringSoonMembers === 1 ? ' is' : 's are'} expiring within 7 days. Send a quick WhatsApp reminder or renew in one click.`
                : 'All active memberships are in good standing. Automated WhatsApp expiry checks run daily at 8:00 AM.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div className="rounded-xl border border-emerald-400/30 bg-black/35 px-4 py-2.5 backdrop-blur-xs">
              <p className="text-xs text-emerald-200/80">Active Retention</p>
              <p className="mt-0.5 flex items-center gap-1.5 font-mono text-lg font-bold text-emerald-300 tabular-nums">
                <TrendingUp className="h-4 w-4" />
                {retentionRate}%
              </p>
            </div>

            <button
              type="button"
              onClick={() => onNavigateMembers('all')}
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-xs font-semibold text-white transition-colors hover:bg-white/20 whitespace-nowrap"
            >
              <Users className="h-4 w-4 text-emerald-300" />
              Members
            </button>

            <button
              type="button"
              onClick={onNavigateWhatsapp}
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-xs font-semibold text-white transition-colors hover:bg-white/20 whitespace-nowrap"
            >
              <MessageSquare className="h-4 w-4 text-emerald-300" />
              WhatsApp Alerts
            </button>

            <button
              type="button"
              onClick={onAddMember}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-xs font-semibold text-neutral-950 transition-colors hover:bg-emerald-400 whitespace-nowrap"
            >
              <UserPlus className="h-4 w-4" />
              Add Member
            </button>
          </div>
        </div>
      </section>

      {/* Quick Members Options Bar */}
      <section
        aria-label="Member Directory Options"
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 sm:px-5"
      >
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-emerald-600 shrink-0" />
          <span className="text-xs font-semibold text-neutral-900">
            Members Options
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigateMembers('all')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-semibold text-neutral-800 transition-colors hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-800 whitespace-nowrap"
          >
            All Members
            <span className="font-mono text-neutral-500 tabular-nums">
              ({stats.totalMembers})
            </span>
          </button>
          <button
            type="button"
            onClick={() => onNavigateMembers('active')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-semibold text-neutral-800 transition-colors hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-800 whitespace-nowrap"
          >
            Active
            <span className="font-mono text-emerald-700 tabular-nums">
              ({stats.activeMembers})
            </span>
          </button>
          <button
            type="button"
            onClick={() => onNavigateMembers('expiring_soon')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-semibold text-neutral-800 transition-colors hover:border-amber-500 hover:bg-amber-50 hover:text-amber-800 whitespace-nowrap"
          >
            Expiring Soon
            <span className="font-mono text-amber-700 tabular-nums">
              ({stats.expiringSoonMembers})
            </span>
          </button>
          <button
            type="button"
            onClick={() => onNavigateMembers('expired')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-semibold text-neutral-800 transition-colors hover:border-rose-500 hover:bg-rose-50 hover:text-rose-700 whitespace-nowrap"
          >
            Expired
            <span className="font-mono text-rose-600 tabular-nums">
              ({stats.expiredMembers})
            </span>
          </button>
        </div>
      </section>

      {/* KPI Grid */}
      <section aria-label="Key Performance Metrics">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {kpis.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <button
                key={kpi.label}
                type="button"
                onClick={kpi.onClick}
                className={`group flex flex-col justify-between rounded-xl border p-5 text-left transition-all duration-150 hover:-translate-y-0.5 hover:shadow-sm ${kpi.cardClass}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-neutral-600">
                    {kpi.label}
                  </span>
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-lg shadow-xs ${kpi.iconBg}`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                </div>
                <div className="mt-3">
                  <p
                    className={`font-mono text-2xl font-bold tracking-tight tabular-nums ${kpi.accent}`}
                  >
                    {kpi.value}
                  </p>
                  <p className="mt-1 text-xs text-neutral-500 tabular-nums">
                    {kpi.meta}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Charts Row */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="min-w-0 rounded-xl border border-neutral-200 bg-white p-6 lg:col-span-2">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-neutral-950">
                Monthly Revenue Trend
              </h2>
              <p className="text-xs text-neutral-500">
                Collected membership fees across the last 6 months
              </p>
            </div>
            <span className="font-mono text-xs font-semibold text-amber-700 tabular-nums">
              Pending Dues: {formatInr(stats.pendingAmount)}
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data?.revenueChart || []}
                margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="emeraldRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16A34A" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#16A34A" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fill: '#737373', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#737373', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `₹${v}`}
                />
                <Tooltip
                  formatter={(value: unknown) => [formatInr(Number(value || 0)), 'Revenue']}
                  contentStyle={{
                    borderRadius: '10px',
                    border: '1px solid #E5E5E5',
                    fontSize: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#16A34A"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#emeraldRev)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="min-w-0 flex flex-col justify-between rounded-xl border border-neutral-200 bg-white p-6">
          <div>
            <h2 className="text-base font-semibold text-neutral-950">
              Membership Status Breakdown
            </h2>
            <p className="text-xs text-neutral-500">
              Live member health across your gym
            </p>
          </div>

          {hasPieData ? (
            <div className="my-2 h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data?.statusBreakdown || []}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={76}
                    paddingAngle={3}
                  >
                    {(data?.statusBreakdown || []).map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="my-6 flex flex-col items-center justify-center rounded-lg border border-dashed border-neutral-200 py-8 text-center">
              <p className="text-sm font-medium text-neutral-700">No members added yet</p>
              <p className="mt-1 text-xs text-neutral-500">
                Add your first member to view status distribution.
              </p>
            </div>
          )}

          <div className="space-y-2.5 border-t border-neutral-100 pt-4 text-xs">
            {(data?.statusBreakdown || []).map((item) => (
              <div key={item.name} className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-neutral-700">
                  <span
                    className="h-2.5 w-2.5 rounded-sm"
                    style={{ backgroundColor: item.color }}
                  />
                  {item.name}
                </span>
                <span className="font-mono font-semibold text-neutral-950 tabular-nums">
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom Split: Expiring Soon Action Queue + Recently Added Members */}
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        {/* Expiring Soon Queue */}
        <div className="min-w-0 rounded-xl border border-neutral-200 bg-white p-6 xl:col-span-2">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-neutral-950">
                Expiring Soon Queue
              </h2>
              <p className="text-xs text-neutral-500">
                Members expiring within 7 days
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateMembers('expiring_soon')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 whitespace-nowrap shrink-0"
            >
              View all <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {!data?.expiringSoonList.length ? (
            <div className="rounded-lg border border-dashed border-neutral-200 px-4 py-8 text-center">
              <p className="text-sm font-medium text-neutral-700">
                No upcoming expiries in the next 7 days
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                Automated WhatsApp reminders run daily at 8:00 AM.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-100">
              {data.expiringSoonList.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {member.profilePhoto ? (
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewPhoto({
                            src: member.profilePhoto!,
                            name: member.fullName,
                            subtitle: `${member.memberCode} · ${member.mobileNumber}`,
                          })
                        }
                        title={`View ${member.fullName}'s photo`}
                        aria-label={`View ${member.fullName}'s profile photo`}
                        className="shrink-0 cursor-zoom-in rounded-lg transition-all hover:ring-2 hover:ring-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <img
                          src={member.profilePhoto}
                          alt={member.fullName}
                          className="h-9 w-9 rounded-lg border border-neutral-200 object-cover"
                        />
                      </button>
                    ) : (
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-900 text-xs font-semibold text-white shrink-0">
                        {member.fullName
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-neutral-950">
                        {member.fullName}
                      </p>
                      <p className="mt-0.5 text-xs text-amber-700 tabular-nums">
                        {member.daysRemaining === 0
                          ? 'Expires today'
                          : `Expires in ${member.daysRemaining} day${member.daysRemaining === 1 ? '' : 's'}`}
                        {' · '}
                        <span className="text-neutral-500">{member.mobileNumber}</span>
                        {member.paymentStatus === 'Pending' && (
                          <>
                            {' · '}
                            <span className="font-semibold text-amber-700">
                              Pending {formatInr(member.membershipAmount)}
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onQuickRemind(member)}
                      title="Send WhatsApp Reminder"
                      className="rounded-lg border border-neutral-200 p-2 text-neutral-700 transition-colors hover:border-emerald-600 hover:text-emerald-700"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onQuickRenew(member)}
                      className="inline-flex items-center gap-1 rounded-lg bg-neutral-950 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-neutral-800 whitespace-nowrap"
                    >
                      <RefreshCw className="h-3 w-3" />
                      Renew
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recently Added Members */}
        <div className="min-w-0 rounded-xl border border-neutral-200 bg-white p-6 xl:col-span-3">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-neutral-950">
                Recently Added Members
              </h2>
              <p className="text-xs text-neutral-500">
                Latest digital membership IDs issued at your gym
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onNavigateMembers('all')}
                className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-800 transition-colors hover:border-emerald-500 hover:text-emerald-700 whitespace-nowrap shrink-0"
              >
                All Members <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={onAddMember}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 whitespace-nowrap shrink-0"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Add Member
              </button>
            </div>
          </div>

          {!data?.recentMembers.length ? (
            <div className="rounded-lg border border-dashed border-neutral-200 px-4 py-10 text-center">
              <p className="text-sm font-medium text-neutral-800">
                Your member directory is empty
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                Add your first gym member to generate a digital membership ID and expiry
                tracker.
              </p>
              <button
                type="button"
                onClick={onAddMember}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-neutral-950 px-4 py-2 text-xs font-semibold text-white hover:bg-neutral-800"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Add First Member
              </button>
            </div>
          ) : (
            <>
              {/* Mobile Card List */}
              <div className="divide-y divide-neutral-100 sm:hidden">
                {data.recentMembers.map((m) => (
                  <div key={m.id} className="space-y-2 py-3 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 items-center gap-3">
                        {m.profilePhoto ? (
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewPhoto({
                                src: m.profilePhoto!,
                                name: m.fullName,
                                subtitle: `${m.memberCode} · ${m.mobileNumber}`,
                              })
                            }
                            title={`View ${m.fullName}'s photo`}
                            aria-label={`View ${m.fullName}'s profile photo`}
                            className="shrink-0 cursor-zoom-in rounded-lg transition-all hover:ring-2 hover:ring-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          >
                            <img
                              src={m.profilePhoto}
                              alt={m.fullName}
                              className="h-9 w-9 rounded-lg border border-neutral-200 object-cover"
                            />
                          </button>
                        ) : (
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-900 text-xs font-semibold text-white shrink-0">
                            {m.fullName
                              .split(' ')
                              .map((n) => n[0])
                              .join('')
                              .slice(0, 2)
                              .toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-neutral-950">
                            {m.fullName}
                          </p>
                          <p className="font-mono text-xs text-neutral-500 tabular-nums">
                            {m.mobileNumber}
                          </p>
                        </div>
                      </div>

                      <span className="shrink-0 font-mono text-xs font-semibold text-neutral-700 tabular-nums whitespace-nowrap">
                        {m.memberCode}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pl-12 text-xs">
                      <div className="text-neutral-600">
                        <span>{m.durationLabel}</span>
                        {' · '}
                        <span
                          className={
                            m.membershipState === 'expired'
                              ? 'font-medium text-red-600'
                              : m.membershipState === 'expiring_soon'
                              ? 'font-medium text-amber-700'
                              : 'font-medium text-emerald-700'
                          }
                        >
                          {formatDisplayDate(m.expiryDate)}
                        </span>
                      </div>

                      <div className="font-mono tabular-nums text-right">
                        <span className="font-semibold text-neutral-950">
                          {formatInr(m.membershipAmount)}
                        </span>
                        {m.paymentStatus === 'Pending' ? (
                          <span className="ml-1.5 font-semibold text-amber-700">
                            (Pending)
                          </span>
                        ) : (
                          <span className="ml-1.5 text-emerald-700">Paid</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-1.5 pl-12">
                      <button
                        type="button"
                        onClick={() => onQuickRemind(m)}
                        title="Send WhatsApp Reminder"
                        className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:border-emerald-600 hover:text-emerald-700 whitespace-nowrap"
                      >
                        <MessageSquare className="h-3 w-3" />
                        Remind
                      </button>
                      <button
                        type="button"
                        onClick={() => onQuickRenew(m)}
                        className="inline-flex items-center gap-1 rounded-lg bg-neutral-950 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-neutral-800 whitespace-nowrap"
                      >
                        <RefreshCw className="h-3 w-3" />
                        Renew
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop & Tablet Table */}
              <div className="hidden overflow-x-auto sm:block">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-neutral-200 text-xs font-medium text-neutral-500">
                      <th className="min-w-[200px] pb-2.5 pr-6">Member</th>
                      <th className="min-w-[130px] pb-2.5 pr-6 whitespace-nowrap">Member ID</th>
                      <th className="pb-2.5 pr-4">Plan</th>
                      <th className="pb-2.5 pr-4">Expiry</th>
                      <th className="pb-2.5 pr-4 text-right">Amount</th>
                      <th className="pb-2.5 text-right">Options</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {data.recentMembers.map((m) => (
                      <tr key={m.id} className="hover:bg-neutral-50/70">
                        <td className="min-w-[200px] py-3 pr-6">
                          <div className="flex items-center gap-3">
                            {m.profilePhoto ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewPhoto({
                                    src: m.profilePhoto!,
                                    name: m.fullName,
                                    subtitle: `${m.memberCode} · ${m.mobileNumber}`,
                                  })
                                }
                                title={`View ${m.fullName}'s photo`}
                                aria-label={`View ${m.fullName}'s profile photo`}
                                className="shrink-0 cursor-zoom-in rounded-lg transition-all hover:ring-2 hover:ring-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                              >
                                <img
                                  src={m.profilePhoto}
                                  alt={m.fullName}
                                  className="h-8 w-8 rounded-lg border border-neutral-200 object-cover"
                                />
                              </button>
                            ) : (
                              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-900 text-xs font-semibold text-white shrink-0">
                                {m.fullName
                                  .split(' ')
                                  .map((n) => n[0])
                                  .join('')
                                  .slice(0, 2)
                                  .toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="truncate font-medium text-neutral-950">{m.fullName}</p>
                              <p className="font-mono text-xs text-neutral-500 tabular-nums">
                                {m.mobileNumber}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="min-w-[130px] py-3 pr-6 font-mono text-xs font-medium text-neutral-700 tabular-nums whitespace-nowrap">
                          {m.memberCode}
                        </td>
                        <td className="py-3 pr-4 text-xs text-neutral-600 whitespace-nowrap">
                          {m.durationLabel}
                        </td>
                        <td className="py-3 pr-4 text-xs tabular-nums whitespace-nowrap">
                          <span
                            className={
                              m.membershipState === 'expired'
                                ? 'font-medium text-red-600'
                                : m.membershipState === 'expiring_soon'
                                ? 'font-medium text-amber-700'
                                : 'font-medium text-emerald-700'
                            }
                          >
                            {formatDisplayDate(m.expiryDate)}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-right font-mono text-xs tabular-nums whitespace-nowrap">
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
                        <td className="py-3 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onQuickRemind(m)}
                              title="Send WhatsApp Reminder"
                              className="rounded-lg border border-neutral-200 p-1.5 text-neutral-700 transition-colors hover:border-emerald-600 hover:text-emerald-700"
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onQuickRenew(m)}
                              className="inline-flex items-center gap-1 rounded-lg bg-neutral-950 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-neutral-800 whitespace-nowrap"
                            >
                              <RefreshCw className="h-3 w-3" />
                              Renew
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
      </section>

      <PhotoPreviewModal
        photo={previewPhoto}
        onClose={() => setPreviewPhoto(null)}
      />
    </div>
  );
}
