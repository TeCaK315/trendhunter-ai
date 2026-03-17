'use client';

/* ─── Bar Chart (CSS-only) ─── */
interface BarChartProps {
  data: { label: string; value: number }[];
  title?: string;
  maxVal?: number;
}

export function BarChart({ data, title, maxVal }: BarChartProps) {
  const max = maxVal || Math.max(...data.map(d => d.value), 1);

  return (
    <div>
      {title && (
        <h3 className="font-heading font-semibold mb-4" style={{ color: '#e2e8f0' }}>{title}</h3>
      )}
      <div className="space-y-3">
        {data.map((item, i) => (
          <div key={i}>
            <div className="flex justify-between mb-1">
              <span className="text-sm truncate" style={{ color: '#e2e8f080' }}>{item.label}</span>
              <span className="text-sm font-bold ml-2" style={{ color: '#6366f1' }}>{item.value}</span>
            </div>
            <div className="w-full h-5 rounded-lg" style={{ background: '#6366f120' }}>
              <div
                className="h-5 rounded-lg transition-all duration-700"
                style={{ width: `${Math.max((item.value / max) * 100, 2)}%`, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Pie Chart (CSS conic-gradient) ─── */
interface PieChartProps {
  data: { label: string; value: number; color?: string }[];
  title?: string;
  size?: number;
}

const PIE_COLORS = ['#6366f1', '#8b5cf6', '#f59e0b', '#f59e0b', '#ef4444', '#22c55e', '#6366f1', '#ec4899'];

export function PieChart({ data, title, size = 180 }: PieChartProps) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  let accumulated = 0;

  const segments = data.map((d, i) => {
    const start = accumulated;
    const percent = (d.value / total) * 100;
    accumulated += percent;
    return {
      ...d,
      percent,
      start,
      color: d.color || PIE_COLORS[i % PIE_COLORS.length],
    };
  });

  const gradient = segments
    .map(s => `${s.color} ${s.start}% ${s.start + s.percent}%`)
    .join(', ');

  return (
    <div>
      {title && (
        <h3 className="font-heading font-semibold mb-4" style={{ color: '#e2e8f0' }}>{title}</h3>
      )}
      <div className="flex items-center gap-6 flex-wrap">
        <div
          className="rounded-full flex-shrink-0"
          style={{
            width: size,
            height: size,
            background: `conic-gradient(${gradient})`,
          }}
        />
        <div className="space-y-2">
          {segments.map((s, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: s.color }} />
              <span style={{ color: '#e2e8f080' }}>{s.label}</span>
              <span className="font-bold" style={{ color: '#e2e8f0' }}>{Math.round(s.percent)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Stat Card ─── */
interface StatCardProps {
  label: string;
  value: string | number;
  change?: number; // percent change, e.g. +12 or -5
  icon?: React.ReactNode;
}

export function StatCard({ label, value, change, icon }: StatCardProps) {
  return (
    <div className="rounded-2xl border p-5" style={{ background: '#6366f110', borderColor: '#6366f140' }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm" style={{ color: '#e2e8f070' }}>{label}</span>
        {icon && <span style={{ color: '#6366f1' }}>{icon}</span>}
      </div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold" style={{ color: '#e2e8f0' }}>{value}</span>
        {change != null && (
          <span
            className="text-sm font-medium mb-0.5"
            style={{ color: change >= 0 ? '#22c55e' : '#ef4444' }}
          >
            {change >= 0 ? '+' : ''}{change}%
          </span>
        )}
      </div>
    </div>
  );
}

/* ─── Data Table ─── */
interface DataTableProps {
  headers: string[];
  rows: (string | number)[][];
  title?: string;
}

export function DataTable({ headers, rows, title }: DataTableProps) {
  return (
    <div>
      {title && (
        <h3 className="font-heading font-semibold mb-4" style={{ color: '#e2e8f0' }}>{title}</h3>
      )}
      <div className="overflow-x-auto rounded-xl border" style={{ borderColor: '#6366f140' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: '#6366f110' }}>
              {headers.map((h, i) => (
                <th key={i} className="px-4 py-3 text-left font-semibold" style={{ color: '#e2e8f0' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className="border-t" style={{ borderColor: '#6366f120' }}>
                {row.map((cell, ci) => (
                  <td key={ci} className="px-4 py-3" style={{ color: '#e2e8f080' }}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
