import type { BlockContext, BlockResult } from '../types';
import { createDesignTokens } from '../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);

  return {
    'src/components/DataTableAdvanced.tsx': `'use client';

import { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight, Search, Trash2, Check } from 'lucide-react';

interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (value: any, row: T) => React.ReactNode;
  width?: string;
}

interface DataTableProps<T extends Record<string, any>> {
  data: T[];
  columns: Column<T>[];
  pageSize?: number;
  searchable?: boolean;
  selectable?: boolean;
  onBulkAction?: (selectedIds: string[], action: string) => void;
  idKey?: string;
}

export default function DataTableAdvanced<T extends Record<string, any>>({
  data,
  columns,
  pageSize = 10,
  searchable = true,
  selectable = false,
  onBulkAction,
  idKey = 'id',
}: DataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    let result = [...data];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(row =>
        columns.some(col => String(row[col.key] ?? '').toLowerCase().includes(q))
      );
    }
    if (sortKey) {
      result.sort((a, b) => {
        const aVal = a[sortKey] ?? '';
        const bVal = b[sortKey] ?? '';
        const cmp = typeof aVal === 'number' && typeof bVal === 'number'
          ? aVal - bVal
          : String(aVal).localeCompare(String(bVal));
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return result;
  }, [data, search, sortKey, sortDir, columns]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const pageData = filtered.slice(page * pageSize, (page + 1) * pageSize);

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === pageData.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(pageData.map(r => String(r[idKey]))));
    }
  }

  return (
    <div className="space-y-3">
      {/* Search + bulk actions */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {searchable && (
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '${t.text50}' }} />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
              placeholder="Поиск..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border text-sm"
              style={{ borderColor: '${t.primary40}', background: '${t.bg}', color: '${t.text}' }} />
          </div>
        )}
        {selectable && selected.size > 0 && onBulkAction && (
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: '${t.text50}' }}>Выбрано: {selected.size}</span>
            <button onClick={() => onBulkAction(Array.from(selected), 'delete')}
              className="px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 text-white"
              style={{ background: '#ef4444' }}>
              <Trash2 className="w-3 h-3" /> Удалить
            </button>
          </div>
        )}
        <span className="text-xs" style={{ color: '${t.text50}' }}>
          Всего: {filtered.length}
        </span>
      </div>

      {/* Table */}
      <div className="rounded-xl border overflow-x-auto" style={{ borderColor: '${t.primary40}' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: '${t.primary10}' }}>
              {selectable && (
                <th className="w-10 px-3 py-3">
                  <button onClick={toggleAll} className="w-4 h-4 rounded border flex items-center justify-center"
                    style={{ borderColor: '${t.primary40}', background: selected.size === pageData.length && pageData.length > 0 ? '${t.primary}' : 'transparent' }}>
                    {selected.size === pageData.length && pageData.length > 0 && <Check className="w-3 h-3 text-white" />}
                  </button>
                </th>
              )}
              {columns.map(col => (
                <th key={col.key} className="px-4 py-3 text-left font-medium" style={{ color: '${t.text70}', width: col.width }}>
                  {col.sortable !== false ? (
                    <button onClick={() => toggleSort(col.key)} className="flex items-center gap-1 hover:opacity-70">
                      {col.label}
                      {sortKey === col.key ? (
                        sortDir === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronsUpDown className="w-3.5 h-3.5 opacity-30" />
                      )}
                    </button>
                  ) : col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageData.map((row, i) => {
              const rowId = String(row[idKey]);
              const isSelected = selected.has(rowId);
              return (
                <tr key={rowId || i} className="border-t hover:opacity-80 transition-all"
                  style={{ borderColor: '${t.primary40}', background: isSelected ? '${t.primary10}' : 'transparent' }}>
                  {selectable && (
                    <td className="px-3 py-3">
                      <button onClick={() => toggleSelect(rowId)} className="w-4 h-4 rounded border flex items-center justify-center"
                        style={{ borderColor: '${t.primary40}', background: isSelected ? '${t.primary}' : 'transparent' }}>
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </button>
                    </td>
                  )}
                  {columns.map(col => (
                    <td key={col.key} className="px-4 py-3" style={{ color: '${t.text}' }}>
                      {col.render ? col.render(row[col.key], row) : String(row[col.key] ?? '')}
                    </td>
                  ))}
                </tr>
              );
            })}
            {pageData.length === 0 && (
              <tr><td colSpan={columns.length + (selectable ? 1 : 0)} className="py-12 text-center text-sm" style={{ color: '${t.text50}' }}>Нет данных</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: '${t.text50}' }}>
            {page * pageSize + 1}—{Math.min((page + 1) * pageSize, filtered.length)} из {filtered.length}
          </span>
          <div className="flex gap-1">
            <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}
              className="p-2 rounded-lg border disabled:opacity-30"
              style={{ borderColor: '${t.primary40}', color: '${t.text70}' }}>
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const p = totalPages <= 5 ? i : Math.max(0, Math.min(page - 2, totalPages - 5)) + i;
              return (
                <button key={p} onClick={() => setPage(p)}
                  className="w-8 h-8 rounded-lg text-xs font-medium"
                  style={{
                    background: p === page ? '${t.primary}' : 'transparent',
                    color: p === page ? '#fff' : '${t.text70}',
                  }}>
                  {p + 1}
                </button>
              );
            })}
            <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1}
              className="p-2 rounded-lg border disabled:opacity-30"
              style={{ borderColor: '${t.primary40}', color: '${t.text70}' }}>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
`,
  };
}
