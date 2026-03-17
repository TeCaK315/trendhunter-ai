import type { BlockContext, BlockResult } from '../types';
import { createDesignTokens } from '../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);
  const projectName = ctx.safe.projectName;
  const primaryOutput = ctx.safe.primaryOutput || 'result';

  return {
    'src/app/dashboard/reports/page.tsx': `'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, BarChart3, DollarSign, Users, Download, Calendar,
  TrendingUp, Percent, FileText, ChevronDown,
} from 'lucide-react';
import { useT } from '@/lib/i18n';

const HISTORY_KEY = '${projectName.replace(/'/g, '')}_history';
const CLIENTS_KEY = '${projectName.replace(/'/g, '')}_clients';

type Period = '7d' | '30d' | '90d' | '12m' | 'all';

export default function ReportsPage() {
  const t = useT();
  const [history, setHistory] = useState<any[]>([]);
  const [period, setPeriod] = useState<Period>('30d');
  const [activeTab, setActiveTab] = useState<'income' | 'tax' | 'clients'>('income');

  useEffect(() => {
    try {
      const stored = localStorage.getItem(HISTORY_KEY);
      if (stored) setHistory(JSON.parse(stored));
    } catch {}
  }, []);

  // Filter by period
  const filtered = useMemo(() => {
    const now = Date.now();
    const ms: Record<Period, number> = {
      '7d': 7 * 86400000,
      '30d': 30 * 86400000,
      '90d': 90 * 86400000,
      '12m': 365 * 86400000,
      'all': Infinity,
    };
    const cutoff = now - ms[period];
    return history.filter(h => new Date(h.created_at).getTime() >= cutoff);
  }, [history, period]);

  // Income stats
  const incomeStats = useMemo(() => {
    let totalBilled = 0, totalPaid = 0, totalTax = 0;
    const monthlyData: Record<string, { billed: number; paid: number }> = {};

    filtered.forEach(item => {
      const total = item.data?.total || 0;
      const tax = item.data?.tax_amount || 0;
      const status = item.payment_status || item.data?.payment_status || 'draft';
      const month = new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

      totalBilled += total;
      totalTax += tax;
      if (status === 'paid') totalPaid += total;

      if (!monthlyData[month]) monthlyData[month] = { billed: 0, paid: 0 };
      monthlyData[month].billed += total;
      if (status === 'paid') monthlyData[month].paid += total;
    });

    return { totalBilled, totalPaid, totalTax, unpaid: totalBilled - totalPaid, monthlyData };
  }, [filtered]);

  // Client stats
  const clientStats = useMemo(() => {
    const byClient: Record<string, { name: string; total: number; paid: number; count: number }> = {};
    filtered.forEach(item => {
      const name = item.data?.recipient?.name || item.input || 'Unknown';
      const total = item.data?.total || 0;
      const status = item.payment_status || item.data?.payment_status || 'draft';
      if (!byClient[name]) byClient[name] = { name, total: 0, paid: 0, count: 0 };
      byClient[name].total += total;
      byClient[name].count++;
      if (status === 'paid') byClient[name].paid += total;
    });
    return Object.values(byClient).sort((a, b) => b.total - a.total);
  }, [filtered]);

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

  // CSV Export
  const exportCSV = () => {
    const headers = ['Date', 'Number', 'Client', 'Status', 'Subtotal', 'Tax', 'Total'];
    const rows = filtered.map(item => [
      new Date(item.created_at).toLocaleDateString(),
      item.doc_number || '',
      item.data?.recipient?.name || item.input || '',
      item.payment_status || item.data?.payment_status || 'draft',
      (item.data?.subtotal || 0).toFixed(2),
      (item.data?.tax_amount || 0).toFixed(2),
      (item.data?.total || 0).toFixed(2),
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'report-' + period + '-' + new Date().toISOString().split('T')[0] + '.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const months = Object.entries(incomeStats.monthlyData);
  const maxMonthly = Math.max(...months.map(([, d]) => d.billed), 1);

  const tabs = [
    { id: 'income' as const, label: t('reports.income'), icon: DollarSign },
    { id: 'tax' as const, label: t('label.tax'), icon: Percent },
    { id: 'clients' as const, label: t('reports.byClient'), icon: Users },
  ];

  const periods: { value: Period; label: string }[] = [
    { value: '7d', label: '7 days' },
    { value: '30d', label: '30 days' },
    { value: '90d', label: '90 days' },
    { value: '12m', label: '12 months' },
    { value: 'all', label: 'All time' },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="p-2 rounded-xl transition-all hover:bg-white/[0.06]">
            <ArrowLeft className="w-5 h-5" style={{ color: '${t.text50}' }} />
          </Link>
          <h1 className="text-xl font-bold" style={{ fontFamily: "'${t.headingFont}', sans-serif", color: '${t.text}' }}>{t('reports.title')}</h1>
        </div>
        <div className="flex items-center gap-2">
          <select value={period} onChange={e => setPeriod(e.target.value as Period)}
            className="px-3 py-2 rounded-xl border text-sm cursor-pointer"
            style={{ background: '${t.bg}', borderColor: '${t.primary}15', color: '${t.text}' }}>
            {periods.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <button onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all hover:bg-white/[0.04]"
            style={{ borderColor: '${t.primary}15', color: '${t.text}' }}>
            <Download className="w-4 h-4" /> CSV
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl p-5" style={{ background: '${t.surface1}', boxShadow: '${t.shadowSm}', border: '1px solid ${t.primary}08' }}>
          <p className="text-[11px] font-medium uppercase tracking-wider mb-1" style={{ color: '${t.text40}' }}>{t('reports.totalBilled')}</p>
          <p className="text-xl font-bold" style={{ color: '${t.text}' }}>{formatCurrency(incomeStats.totalBilled)}</p>
        </div>
        <div className="rounded-2xl p-5" style={{ background: '${t.surface1}', boxShadow: '${t.shadowSm}', border: '1px solid ${t.primary}08' }}>
          <p className="text-[11px] font-medium uppercase tracking-wider mb-1" style={{ color: '${t.text40}' }}>{t('reports.collected')}</p>
          <p className="text-xl font-bold" style={{ color: '#22c55e' }}>{formatCurrency(incomeStats.totalPaid)}</p>
        </div>
        <div className="rounded-2xl p-5" style={{ background: '${t.surface1}', boxShadow: '${t.shadowSm}', border: '1px solid ${t.primary}08' }}>
          <p className="text-[11px] font-medium uppercase tracking-wider mb-1" style={{ color: '${t.text40}' }}>{t('reports.unpaid')}</p>
          <p className="text-xl font-bold" style={{ color: '#f59e0b' }}>{formatCurrency(incomeStats.unpaid)}</p>
        </div>
        <div className="rounded-2xl p-5" style={{ background: '${t.surface1}', boxShadow: '${t.shadowSm}', border: '1px solid ${t.primary}08' }}>
          <p className="text-[11px] font-medium uppercase tracking-wider mb-1" style={{ color: '${t.text40}' }}>{t('reports.totalTax')}</p>
          <p className="text-xl font-bold" style={{ color: '${t.text}' }}>{formatCurrency(incomeStats.totalTax)}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: '${t.surface1}' }}>
        {tabs.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all"
              style={{ background: active ? '${t.primary}' : 'transparent', color: active ? '#fff' : '${t.text50}' }}>
              <Icon className="w-4 h-4" /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* Income Tab */}
      {activeTab === 'income' && (
        <div className="rounded-2xl p-5" style={{ background: '${t.surface1}', boxShadow: '${t.shadowSm}', border: '1px solid ${t.primary}08' }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: '${t.text}' }}>{t('reports.monthlyBreakdown')}</h3>
          {months.length === 0 ? (
            <p className="text-sm py-8 text-center" style={{ color: '${t.text50}' }}>{t('reports.noData')}</p>
          ) : (
            <div className="space-y-3">
              {months.map(([month, data]) => (
                <div key={month}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span style={{ color: '${t.text}' }}>{month}</span>
                    <div className="flex gap-4">
                      <span style={{ color: '${t.text50}' }}>Billed: {formatCurrency(data.billed)}</span>
                      <span style={{ color: '#22c55e' }}>Paid: {formatCurrency(data.paid)}</span>
                    </div>
                  </div>
                  <div className="h-3 rounded-full overflow-hidden" style={{ background: '${t.primary}10' }}>
                    <div className="h-full rounded-full transition-all" style={{
                      width: (data.billed / maxMonthly * 100) + '%',
                      background: '${t.gradientPrimary}',
                    }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tax Tab */}
      {activeTab === 'tax' && (
        <div className="rounded-2xl p-5" style={{ background: '${t.surface1}', boxShadow: '${t.shadowSm}', border: '1px solid ${t.primary}08' }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: '${t.text}' }}>{t('reports.taxSummary')}</h3>
          <div className="space-y-2">
            {filtered.filter(h => h.data?.tax_amount > 0).length === 0 ? (
              <p className="text-sm py-8 text-center" style={{ color: '${t.text50}' }}>{t('reports.noData')}</p>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-4 py-2 border-b text-xs font-semibold" style={{ borderColor: '${t.primary}10', color: '${t.text50}' }}>
                  <span>Invoice</span><span className="text-right">Subtotal</span><span className="text-right">Tax</span>
                </div>
                {filtered.filter(h => h.data?.tax_amount > 0).map(item => (
                  <div key={item.id} className="grid grid-cols-3 gap-4 py-2 text-xs" style={{ borderBottom: '1px solid ${t.primary}06' }}>
                    <span style={{ color: '${t.text}' }}>{item.doc_number || '#' + item.id.substring(0, 6)}</span>
                    <span className="text-right" style={{ color: '${t.text70}' }}>{formatCurrency(item.data?.subtotal || 0)}</span>
                    <span className="text-right font-semibold" style={{ color: '${t.text}' }}>{formatCurrency(item.data?.tax_amount || 0)}</span>
                  </div>
                ))}
                <div className="grid grid-cols-3 gap-4 py-3 border-t text-sm font-bold" style={{ borderColor: '${t.primary}20' }}>
                  <span style={{ color: '${t.text}' }}>Total</span>
                  <span className="text-right" style={{ color: '${t.text}' }}>{formatCurrency(incomeStats.totalBilled - incomeStats.totalTax)}</span>
                  <span className="text-right" style={{ color: '${t.primary}' }}>{formatCurrency(incomeStats.totalTax)}</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Clients Tab */}
      {activeTab === 'clients' && (
        <div className="rounded-2xl p-5" style={{ background: '${t.surface1}', boxShadow: '${t.shadowSm}', border: '1px solid ${t.primary}08' }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: '${t.text}' }}>{t('reports.revenueByClient')}</h3>
          {clientStats.length === 0 ? (
            <p className="text-sm py-8 text-center" style={{ color: '${t.text50}' }}>{t('reports.noData')}</p>
          ) : (
            <div className="space-y-3">
              {clientStats.map((client, i) => {
                const pct = incomeStats.totalBilled > 0 ? (client.total / incomeStats.totalBilled * 100) : 0;
                return (
                  <div key={client.name} className="flex items-center gap-4">
                    <span className="w-6 text-xs font-mono text-right" style={{ color: '${t.text40}' }}>{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium truncate" style={{ color: '${t.text}' }}>{client.name}</span>
                        <span className="text-sm font-semibold ml-2" style={{ color: '${t.text}' }}>{formatCurrency(client.total)}</span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: '${t.primary}10' }}>
                        <div className="h-full rounded-full" style={{ width: pct + '%', background: '${t.primary}' }} />
                      </div>
                      <div className="flex justify-between mt-0.5 text-[10px]" style={{ color: '${t.text40}' }}>
                        <span>{client.count} invoices</span>
                        <span>{pct.toFixed(0)}% of total</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
`,
  };
}
