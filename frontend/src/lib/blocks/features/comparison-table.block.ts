import type { BlockContext, BlockResult } from '../types';
import { createDesignTokens } from '../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);

  return {
    'src/components/ComparisonTable.tsx': `'use client';

import { useState } from 'react';
import { Check, X, Minus, ChevronDown, ChevronUp } from 'lucide-react';

interface ComparisonItem {
  name: string;
  features: Record<string, string | boolean | number>;
  highlight?: boolean;
}

interface ComparisonTableProps {
  items: ComparisonItem[];
  featureLabels?: Record<string, string>;
  title?: string;
}

export default function ComparisonTable({ items, featureLabels, title }: ComparisonTableProps) {
  const [expanded, setExpanded] = useState(true);

  if (items.length === 0) return null;

  const allFeatures = Array.from(
    new Set(items.flatMap(item => Object.keys(item.features)))
  );

  function renderCell(value: string | boolean | number | undefined) {
    if (value === true) return <Check className="w-5 h-5 mx-auto" style={{ color: '#22c55e' }} />;
    if (value === false) return <X className="w-5 h-5 mx-auto" style={{ color: '#ef4444' }} />;
    if (value === undefined || value === null) return <Minus className="w-4 h-4 mx-auto" style={{ color: '${t.text50}' }} />;
    return <span className="text-sm font-medium" style={{ color: '${t.text}' }}>{String(value)}</span>;
  }

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: '${t.primary40}' }}>
      {title && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between px-6 py-4"
          style={{ background: '${t.primary10}' }}
        >
          <h3 className="font-heading font-semibold" style={{ color: '${t.text}' }}>{title}</h3>
          {expanded ? <ChevronUp className="w-5 h-5" style={{ color: '${t.text70}' }} /> : <ChevronDown className="w-5 h-5" style={{ color: '${t.text70}' }} />}
        </button>
      )}

      {expanded && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '${t.primary10}' }}>
                <th className="px-4 py-3 text-left font-semibold min-w-[150px]" style={{ color: '${t.text}' }}>Характеристика</th>
                {items.map((item, i) => (
                  <th
                    key={i}
                    className="px-4 py-3 text-center font-semibold min-w-[120px]"
                    style={{
                      color: item.highlight ? '${t.primary}' : '${t.text}',
                      background: item.highlight ? '${t.primary20}' : 'transparent',
                    }}
                  >
                    {item.name}
                    {item.highlight && (
                      <span className="block text-xs font-normal mt-0.5" style={{ color: '${t.primary}' }}>Рекомендуется</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allFeatures.map((feature, fi) => (
                <tr key={feature} className="border-t" style={{ borderColor: '${t.primary20}' }}>
                  <td className="px-4 py-3 font-medium" style={{ color: '${t.text80}' }}>
                    {(featureLabels && featureLabels[feature]) || feature}
                  </td>
                  {items.map((item, ii) => (
                    <td
                      key={ii}
                      className="px-4 py-3 text-center"
                      style={{ background: item.highlight ? '${t.primary10}' : 'transparent' }}
                    >
                      {renderCell(item.features[feature])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
`,
  };
}
