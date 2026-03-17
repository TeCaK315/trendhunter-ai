import type { BlockContext, BlockResult } from '../types';
import { createDesignTokens, escapeJsx } from '../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);
  const spec = ctx.product_spec;

  const projectName = ctx.safe.projectName;

  return {
    'src/app/dashboard/page.tsx': `'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Plus, Clock, ArrowRight, FileText, TrendingUp, DollarSign,
  AlertCircle, CheckCircle2, Users, BarChart3, ArrowUpRight,
  ArrowDownRight, Loader2, Copy,
} from 'lucide-react';
import { useT } from '@/lib/i18n';

interface HistoryItem {
  id: string;
  doc_number?: string;
  input: string;
  created_at: string;
  status: string;
  payment_status?: string;
  data?: any;
}

const HISTORY_KEY = '${projectName.replace(/'/g, '')}_history';
const CLIENTS_KEY = '${projectName.replace(/'/g, '')}_clients';

const STATUS_COLORS: Record<string, string> = {
  draft: '#94a3b8', sent: '#3b82f6', unpaid: '#f59e0b',
  paid: '#22c55e', overdue: '#ef4444', cancelled: '#6b7280',
};

export default function DashboardPage() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const t = useT();

  useEffect(() => {
    try {
      const stored = localStorage.getItem(HISTORY_KEY);
      if (stored) setHistory(JSON.parse(stored));
    } catch {}
    setLoading(false);
  }, []);

  // ─── Financial Calculations ───
  const stats = useMemo(() => {
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
    const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear;

    let totalRevenue = 0;
    let paidAmount = 0;
    let outstandingAmount = 0;
    let overdueCount = 0;
    let thisMonthRevenue = 0;
    let lastMonthRevenue = 0;

    const last30Days: number[] = new Array(30).fill(0);

    history.forEach(item => {
      const total = item.data?.total || 0;
      const status = item.payment_status || item.data?.payment_status || 'draft';
      const created = new Date(item.created_at);

      totalRevenue += total;

      if (status === 'paid') {
        paidAmount += total;
        if (created.getMonth() === thisMonth && created.getFullYear() === thisYear) {
          thisMonthRevenue += total;
        }
        if (created.getMonth() === lastMonth && created.getFullYear() === lastMonthYear) {
          lastMonthRevenue += total;
        }
      }

      if (['unpaid', 'sent', 'overdue'].includes(status)) {
        outstandingAmount += total;
      }
      if (status === 'overdue') overdueCount++;

      // Chart data: last 30 days
      const daysDiff = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff >= 0 && daysDiff < 30 && status === 'paid') {
        last30Days[29 - daysDiff] += total;
      }
    });

    const revenueChange = lastMonthRevenue > 0
      ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue * 100).toFixed(0)
      : thisMonthRevenue > 0 ? '+100' : '0';

    let clientCount = 0;
    try {
      const clients = JSON.parse(localStorage.getItem(CLIENTS_KEY) || '[]');
      clientCount = clients.length;
    } catch {}

    return {
      totalRevenue, paidAmount, outstandingAmount, overdueCount,
      thisMonthRevenue, revenueChange, clientCount, last30Days,
      totalInvoices: history.length,
    };
  }, [history]);

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

  // Mini chart
  const chartMax = Math.max(...stats.last30Days, 1);

  // Recent items
  const recent = history.slice(0, 5);
  const overdue = history.filter(h => (h.payment_status || h.data?.payment_status) === 'overdue').slice(0, 3);

  const handleDuplicate = (item: HistoryItem) => {
    if (!item.data) return;
    const params = new URLSearchParams();
    params.set('duplicate', 'true');
    params.set('client_name', item.data.recipient?.name || '');
    params.set('client_email', item.data.recipient?.email || '');
    params.set('client_address', item.data.recipient?.address || '');
    router.push('/dashboard/create?' + params.toString());
  };

  return (
    <div className="space-y-6">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: '${t.headingFont}, sans-serif', color: '${t.text}' }}>
            {t('dashboard.title')}
          </h1>
        </div>
        <Link href="/dashboard/create"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90"
          style={{ background: '${t.gradientPrimary}' }}>
          <Plus className="w-4 h-4" /> {t('dashboard.newItem')}
        </Link>
      </div>

      {/* ─── Financial Stats ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Revenue this month */}
        <div className="rounded-2xl p-5" style={{ background: '${t.surface1}', boxShadow: '${t.shadowSm}', border: '1px solid ${t.primary}08' }}>
          <div className="flex items-center justify-between mb-3">
            <DollarSign className="w-4 h-4" style={{ color: '${t.primary}' }} />
            {Number(stats.revenueChange) !== 0 && (
              <span className="flex items-center gap-0.5 text-[11px] font-semibold"
                style={{ color: Number(stats.revenueChange) > 0 ? '#22c55e' : '#ef4444' }}>
                {Number(stats.revenueChange) > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {stats.revenueChange}%
              </span>
            )}
          </div>
          <p className="text-2xl font-bold" style={{ color: '${t.text}' }}>{formatCurrency(stats.thisMonthRevenue)}</p>
          <p className="text-[11px] mt-1" style={{ color: '${t.text40}' }}>{t('dashboard.revenueThisMonth')}</p>
        </div>

        {/* Outstanding */}
        <div className="rounded-2xl p-5" style={{ background: '${t.surface1}', boxShadow: '${t.shadowSm}', border: '1px solid ${t.primary}08' }}>
          <div className="flex items-center justify-between mb-3">
            <AlertCircle className="w-4 h-4" style={{ color: '#f59e0b' }} />
          </div>
          <p className="text-2xl font-bold" style={{ color: stats.outstandingAmount > 0 ? '#f59e0b' : '${t.text}' }}>
            {formatCurrency(stats.outstandingAmount)}
          </p>
          <p className="text-[11px] mt-1" style={{ color: '${t.text40}' }}>{t('dashboard.outstanding')}</p>
        </div>

        {/* Total invoices */}
        <div className="rounded-2xl p-5" style={{ background: '${t.surface1}', boxShadow: '${t.shadowSm}', border: '1px solid ${t.primary}08' }}>
          <div className="flex items-center justify-between mb-3">
            <FileText className="w-4 h-4" style={{ color: '${t.secondary}' }} />
          </div>
          <p className="text-2xl font-bold" style={{ color: '${t.text}' }}>{stats.totalInvoices}</p>
          <p className="text-[11px] mt-1" style={{ color: '${t.text40}' }}>{t('dashboard.totalItems')}</p>
        </div>

        {/* Clients */}
        <div className="rounded-2xl p-5" style={{ background: '${t.surface1}', boxShadow: '${t.shadowSm}', border: '1px solid ${t.primary}08' }}>
          <div className="flex items-center justify-between mb-3">
            <Users className="w-4 h-4" style={{ color: '${t.accent}' }} />
          </div>
          <p className="text-2xl font-bold" style={{ color: '${t.text}' }}>{stats.clientCount}</p>
          <p className="text-[11px] mt-1" style={{ color: '${t.text40}' }}>{t('dashboard.totalClients')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ─── Revenue Chart (left 2 cols) ─── */}
        <div className="lg:col-span-2 rounded-2xl p-5" style={{ background: '${t.surface1}', boxShadow: '${t.shadowSm}', border: '1px solid ${t.primary}08' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" style={{ color: '${t.primary}' }} />
              <h2 className="text-sm font-semibold" style={{ color: '${t.text}' }}>{t('dashboard.last30Days')}</h2>
            </div>
            <span className="text-lg font-bold" style={{ color: '${t.primary}' }}>{formatCurrency(stats.paidAmount)}</span>
          </div>
          {/* CSS bar chart */}
          <div className="flex items-end gap-[2px] h-24">
            {stats.last30Days.map((val, i) => (
              <div key={i} className="flex-1 rounded-t-sm transition-all hover:opacity-80"
                style={{
                  height: chartMax > 0 ? Math.max((val / chartMax) * 100, val > 0 ? 4 : 1) + '%' : '1%',
                  background: val > 0 ? '${t.primary}' : '${t.primary}15',
                }}
                title={val > 0 ? '$' + val.toFixed(0) : ''}
              />
            ))}
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-[10px]" style={{ color: '${t.text40}' }}>30d</span>
            <span className="text-[10px]" style={{ color: '${t.text40}' }}>{t('label.date')}</span>
          </div>
        </div>

        {/* ─── Quick Actions (right col) ─── */}
        <div className="rounded-2xl p-5" style={{ background: '${t.surface1}', boxShadow: '${t.shadowSm}', border: '1px solid ${t.primary}08' }}>
          <h2 className="text-sm font-semibold mb-4" style={{ color: '${t.text}' }}>{t('dashboard.quickActions')}</h2>
          <div className="space-y-2">
            <Link href="/dashboard/create"
              className="flex items-center gap-3 p-3 rounded-xl transition-all hover:bg-white/[0.04] group"
              style={{ border: '1px solid ${t.primary}08' }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '${t.primary}15' }}>
                <Plus className="w-4 h-4" style={{ color: '${t.primary}' }} />
              </div>
              <span className="text-sm font-medium flex-1" style={{ color: '${t.text}' }}>{t('dashboard.newItem')}</span>
              <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100" style={{ color: '${t.text40}' }} />
            </Link>
            <Link href="/dashboard/clients"
              className="flex items-center gap-3 p-3 rounded-xl transition-all hover:bg-white/[0.04] group"
              style={{ border: '1px solid ${t.primary}08' }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '${t.accent}15' }}>
                <Users className="w-4 h-4" style={{ color: '${t.accent}' }} />
              </div>
              <span className="text-sm font-medium flex-1" style={{ color: '${t.text}' }}>{t('nav.clients')}</span>
              <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100" style={{ color: '${t.text40}' }} />
            </Link>
            <Link href="/dashboard/reports"
              className="flex items-center gap-3 p-3 rounded-xl transition-all hover:bg-white/[0.04] group"
              style={{ border: '1px solid ${t.primary}08' }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '${t.secondary}15' }}>
                <BarChart3 className="w-4 h-4" style={{ color: '${t.secondary}' }} />
              </div>
              <span className="text-sm font-medium flex-1" style={{ color: '${t.text}' }}>{t('nav.reports')}</span>
              <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100" style={{ color: '${t.text40}' }} />
            </Link>
            <Link href="/dashboard/history"
              className="flex items-center gap-3 p-3 rounded-xl transition-all hover:bg-white/[0.04] group"
              style={{ border: '1px solid ${t.primary}08' }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#f59e0b15' }}>
                <Clock className="w-4 h-4" style={{ color: '#f59e0b' }} />
              </div>
              <span className="text-sm font-medium flex-1" style={{ color: '${t.text}' }}>{t('nav.history')}</span>
              <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100" style={{ color: '${t.text40}' }} />
            </Link>
          </div>
        </div>
      </div>

      {/* ─── Overdue Alert ─── */}
      {overdue.length > 0 && (
        <div className="rounded-2xl p-4" style={{ background: '#ef444410', border: '1px solid #ef444420' }}>
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-4 h-4" style={{ color: '#ef4444' }} />
            <h3 className="text-sm font-semibold" style={{ color: '#ef4444' }}>
              {overdue.length} {t('dashboard.overdue')}
            </h3>
          </div>
          <div className="space-y-2">
            {overdue.map(item => (
              <Link key={item.id} href={'/dashboard/analysis?id=' + item.id}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-white/[0.04]">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono" style={{ color: '${t.text}' }}>{item.doc_number || '#' + item.id.substring(0, 6)}</span>
                  <span className="text-xs" style={{ color: '${t.text50}' }}>{item.input}</span>
                </div>
                <span className="text-xs font-semibold" style={{ color: '#ef4444' }}>
                  {item.data?.total ? formatCurrency(item.data.total) : ''}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ─── Recent Items ─── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold" style={{ color: '${t.text}' }}>{t('dashboard.recentItems')}</h2>
          {history.length > 5 && (
            <Link href="/dashboard/history" className="text-xs font-medium flex items-center gap-1" style={{ color: '${t.primary}' }}>
              {t('dashboard.viewAll')} <ArrowRight className="w-3 h-3" />
            </Link>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: '${t.primary}' }} />
          </div>
        ) : recent.length === 0 ? (
          <div className="rounded-xl border border-dashed p-10 text-center" style={{ borderColor: '${t.primary20}' }}>
            <FileText className="w-12 h-12 mx-auto mb-3" style={{ color: '${t.text40}' }} />
            <h3 className="text-base font-semibold mb-1" style={{ color: '${t.text}' }}>{t('dashboard.noItems')}</h3>
            <Link href="/dashboard/create"
              className="inline-flex items-center gap-2 px-4 py-2 mt-3 rounded-xl text-sm font-medium text-white"
              style={{ background: '${t.primary}' }}>
              <Plus className="w-4 h-4" /> {t('dashboard.newItem')}
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {recent.map((item) => {
              const status = item.payment_status || item.data?.payment_status || 'draft';
              const statusColor = STATUS_COLORS[status] || '#94a3b8';
              return (
                <div key={item.id}
                  className="flex items-center gap-4 p-4 rounded-xl border transition-all duration-150 group"
                  style={{ background: '${t.surface1}', boxShadow: '${t.shadowSm}', border: '1px solid ${t.primary}08' }}>
                  {/* Status dot */}
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: statusColor }} />

                  {/* Info */}
                  <Link href={'/dashboard/analysis?id=' + item.id} className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {item.doc_number && (
                        <span className="text-xs font-mono font-semibold" style={{ color: '${t.primary}' }}>{item.doc_number}</span>
                      )}
                      <span className="text-sm font-medium truncate" style={{ color: '${t.text}' }}>
                        {item.input || 'Untitled'}
                      </span>
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: '${t.text40}' }}>
                      {new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                  </Link>

                  {/* Amount */}
                  {item.data?.total > 0 && (
                    <span className="text-sm font-semibold hidden sm:block" style={{ color: '${t.text}' }}>
                      {formatCurrency(item.data.total)}
                    </span>
                  )}

                  {/* Duplicate button */}
                  <button onClick={() => handleDuplicate(item)} title={t('action.duplicate')}
                    className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/[0.06]">
                    <Copy className="w-3.5 h-3.5" style={{ color: '${t.text50}' }} />
                  </button>

                  <Link href={'/dashboard/analysis?id=' + item.id}>
                    <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: '${t.primary}' }} />
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
`,
  };
}
