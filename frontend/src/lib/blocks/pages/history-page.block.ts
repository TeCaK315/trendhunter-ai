import type { BlockContext, BlockResult } from '../types';
import { createDesignTokens } from '../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);
  const primaryOutput = ctx.safe.primaryOutput || 'Result';
  const primaryOutputCap = primaryOutput.charAt(0).toUpperCase() + primaryOutput.slice(1);
  const projectName = ctx.safe.projectName;

  return {
    'src/app/dashboard/history/page.tsx': `'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, FileText, Trash2, Edit3, Eye, Search, Filter,
  Plus, Clock, DollarSign, CheckCircle2, AlertCircle, Send,
  XCircle, Loader2,
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
  result?: any;
}

const STATUS_COLORS: Record<string, string> = {
  draft: '#94a3b8', sent: '#3b82f6', unpaid: '#f59e0b',
  paid: '#22c55e', overdue: '#ef4444', cancelled: '#6b7280',
};
const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft', sent: 'Sent', unpaid: 'Unpaid',
  paid: 'Paid', overdue: 'Overdue', cancelled: 'Cancelled',
};
const STATUS_ICONS: Record<string, any> = {
  draft: FileText, sent: Send, unpaid: AlertCircle,
  paid: CheckCircle2, overdue: Clock, cancelled: XCircle,
};

const HISTORY_KEY = '${projectName.replace(/'/g, '')}_history';

export default function HistoryPage() {
  const router = useRouter();
  const t = useT();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(HISTORY_KEY);
      if (stored) setItems(JSON.parse(stored));
    } catch {}
    setLoading(false);
  }, []);

  const filtered = items.filter(item => {
    const matchesSearch = !search ||
      (item.input || '').toLowerCase().includes(search.toLowerCase()) ||
      (item.doc_number || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === 'all' || item.payment_status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const handleDelete = (id: string) => {
    setDeleting(id);
    setTimeout(() => {
      const updated = items.filter(i => i.id !== id);
      setItems(updated);
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(updated)); } catch {}
      setDeleting(null);
    }, 300);
  };

  const updateStatus = (id: string, newStatus: string) => {
    const updated = items.map(i =>
      i.id === id ? { ...i, payment_status: newStatus, data: { ...i.data, payment_status: newStatus } } : i
    );
    setItems(updated);
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(updated)); } catch {}
  };

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

  // Stats
  const totalAmount = items.reduce((sum, i) => sum + (i.data?.total || 0), 0);
  const paidAmount = items.filter(i => i.payment_status === 'paid').reduce((sum, i) => sum + (i.data?.total || 0), 0);
  const unpaidAmount = items.filter(i => ['unpaid', 'sent', 'overdue'].includes(i.payment_status || '')).reduce((sum, i) => sum + (i.data?.total || 0), 0);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="p-2 rounded-xl transition-all hover:bg-white/[0.06]">
            <ArrowLeft className="w-5 h-5" style={{ color: '${t.text50}' }} />
          </Link>
          <div>
            <h1 className="text-xl font-bold" style={{ fontFamily: "'${t.headingFont}', sans-serif", color: '${t.text}' }}>
              {t('history.title')}
            </h1>
            <p className="text-xs mt-0.5" style={{ color: '${t.text40}' }}>
              {items.length} {t('dashboard.totalItems')}
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/create"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90"
          style={{ background: '${t.gradientPrimary}' }}
        >
          <Plus className="w-4 h-4" /> New
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl p-5" style={{ background: '${t.surface1}', boxShadow: '${t.shadowSm}', border: '1px solid ${t.primary}08' }}>
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4" style={{ color: '${t.primary}' }} />
            <span className="text-xs font-medium uppercase tracking-wider" style={{ color: '${t.text50}' }}>Total</span>
          </div>
          <p className="text-2xl font-bold" style={{ color: '${t.text}' }}>{formatCurrency(totalAmount)}</p>
        </div>
        <div className="rounded-2xl p-5" style={{ background: '${t.surface1}', boxShadow: '${t.shadowSm}', border: '1px solid ${t.primary}08' }}>
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4" style={{ color: '#22c55e' }} />
            <span className="text-xs font-medium uppercase tracking-wider" style={{ color: '${t.text50}' }}>Paid</span>
          </div>
          <p className="text-2xl font-bold" style={{ color: '#22c55e' }}>{formatCurrency(paidAmount)}</p>
        </div>
        <div className="rounded-2xl p-5" style={{ background: '${t.surface1}', boxShadow: '${t.shadowSm}', border: '1px solid ${t.primary}08' }}>
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4" style={{ color: '#f59e0b' }} />
            <span className="text-xs font-medium uppercase tracking-wider" style={{ color: '${t.text50}' }}>Outstanding</span>
          </div>
          <p className="text-2xl font-bold" style={{ color: '#f59e0b' }}>{formatCurrency(unpaidAmount)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '${t.text40}' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('history.searchPlaceholder')}
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 transition-all"
            style={{ background: '${t.bg}', borderColor: '${t.primary}15', color: '${t.text}' }}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Filter className="w-4 h-4" style={{ color: '${t.text40}' }} />
          {['all', 'draft', 'sent', 'unpaid', 'paid', 'overdue'].map(status => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: filterStatus === status ? '${t.primary}' : '${t.primary}08',
                color: filterStatus === status ? '#fff' : '${t.text50}',
              }}
            >
              {status === 'all' ? 'All' : STATUS_LABELS[status]}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-10 sm:py-20">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: '${t.primary}' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center" style={{ borderColor: '${t.primary20}' }}>
          <FileText className="w-12 h-12 mx-auto mb-3" style={{ color: '${t.text40}' }} />
          <p className="text-sm" style={{ color: '${t.text50}' }}>
            {search || filterStatus !== 'all' ? t('msg.noResults') : t('history.noItems')}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => {
            const StatusIcon = STATUS_ICONS[item.payment_status || 'draft'] || FileText;
            const statusColor = STATUS_COLORS[item.payment_status || 'draft'] || '#94a3b8';
            const total = item.data?.total;

            return (
              <div
                key={item.id}
                className="rounded-xl border p-4 transition-all duration-150 hover:border-opacity-60 group"
                style={{
                  background: deleting === item.id ? '#ef444410' : '${t.surface1}',
                  boxShadow: '${t.shadowSm}',
                  border: '1px solid ${t.primary}08',
                  opacity: deleting === item.id ? 0.5 : 1,
                }}
              >
                <div className="flex items-center gap-4">
                  {/* Status icon */}
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: statusColor + '15' }}
                  >
                    <StatusIcon className="w-5 h-5" style={{ color: statusColor }} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {item.doc_number && (
                        <span className="text-xs font-mono font-semibold" style={{ color: '${t.primary}' }}>
                          {item.doc_number}
                        </span>
                      )}
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                        style={{ background: statusColor + '20', color: statusColor }}
                      >
                        {STATUS_LABELS[item.payment_status || 'draft']}
                      </span>
                    </div>
                    <p className="text-sm font-medium truncate mt-0.5" style={{ color: '${t.text}' }}>
                      {item.input || 'Untitled'}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: '${t.text40}' }}>
                      {new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>

                  {/* Amount */}
                  {total !== undefined && total > 0 && (
                    <div className="text-right hidden sm:block">
                      <p className="text-lg font-bold" style={{ color: '${t.text}' }}>{formatCurrency(total)}</p>
                    </div>
                  )}

                  {/* Status dropdown */}
                  <select
                    value={item.payment_status || 'draft'}
                    onChange={(e) => updateStatus(item.id, e.target.value)}
                    className="hidden sm:block px-2 py-1 rounded-lg text-xs border cursor-pointer"
                    style={{ background: '${t.bg}', borderColor: '${t.primary}10', color: '${t.text70}' }}
                  >
                    {Object.entries(STATUS_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => router.push('/dashboard/analysis?id=' + item.id)}
                      className="p-2 rounded-lg transition-colors hover:bg-white/[0.06]"
                      title="View"
                    >
                      <Eye className="w-4 h-4" style={{ color: '${t.text50}' }} />
                    </button>
                    <button
                      onClick={() => router.push('/dashboard/create?edit=' + item.id)}
                      className="p-2 rounded-lg transition-colors hover:bg-white/[0.06]"
                      title="Edit"
                    >
                      <Edit3 className="w-4 h-4" style={{ color: '${t.text50}' }} />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-2 rounded-lg transition-colors hover:bg-red-500/10"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" style={{ color: '#ef4444' }} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
`,
  };
}
