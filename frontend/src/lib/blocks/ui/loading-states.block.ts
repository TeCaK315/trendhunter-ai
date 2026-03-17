import type { BlockContext, BlockResult } from '../types';
import { createDesignTokens } from '../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);

  return {
    'src/components/LoadingStates.tsx': `import { type LucideIcon, Inbox } from 'lucide-react';

/* ─── Spinner ─────────────────────────────── */

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  const sizeMap = { sm: 'w-4 h-4', md: 'w-8 h-8', lg: 'w-12 h-12' };

  return (
    <div className={\`flex items-center justify-center \${className}\`}>
      <svg
        className={\`animate-spin \${sizeMap[size]}\`}
        viewBox="0 0 24 24"
        fill="none"
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          style={{ color: '${t.primary20}' }}
        />
        <path
          d="M12 2a10 10 0 0 1 10 10"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          style={{ color: '${t.primary}' }}
        />
      </svg>
    </div>
  );
}

/* ─── Skeleton ────────────────────────────── */

interface SkeletonProps {
  lines?: number;
  className?: string;
}

export function Skeleton({ lines = 3, className = '' }: SkeletonProps) {
  const widths = ['100%', '85%', '70%', '90%', '60%'];

  return (
    <div className={\`space-y-3 \${className}\`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 rounded-lg animate-pulse"
          style={{
            width: widths[i % widths.length],
            background: '${t.primary10}',
          }}
        />
      ))}
    </div>
  );
}

/* ─── EmptyState ──────────────────────────── */

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={\`flex flex-col items-center justify-center py-16 px-4 text-center \${className}\`}>
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
        style={{ background: '${t.primary10}' }}
      >
        <Icon className="w-8 h-8" style={{ color: '${t.primary}' }} />
      </div>
      <h3
        className="text-lg font-heading font-semibold mb-2"
        style={{ color: '${t.text}' }}
      >
        {title}
      </h3>
      {description && (
        <p
          className="text-sm max-w-sm mb-6"
          style={{ color: '${t.text50}' }}
        >
          {description}
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors hover:opacity-90"
          style={{ background: '${t.primary}', color: 'white' }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
`,
  };
}
