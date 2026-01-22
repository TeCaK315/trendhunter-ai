'use client';

import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

/**
 * Base skeleton component for loading states
 */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-zinc-800/50",
        className
      )}
    />
  );
}

/**
 * Skeleton for trend cards
 */
export function TrendCardSkeleton() {
  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5 space-y-4">
      {/* Category pill */}
      <Skeleton className="h-6 w-24 rounded-full" />

      {/* Title */}
      <div className="space-y-2">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2">
        <Skeleton className="h-8 w-20 rounded-full" />
        <Skeleton className="h-4 w-24" />
      </div>
    </div>
  );
}

/**
 * Grid of trend card skeletons
 */
export function TrendGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <TrendCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Skeleton for analysis sections
 */
export function AnalysisSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-12 w-12 rounded-full" />
      </div>

      {/* Content blocks */}
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 space-y-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton for chat messages
 */
export function ChatMessageSkeleton() {
  return (
    <div className="flex gap-3 p-4">
      <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  );
}

/**
 * Loading spinner component
 */
export function LoadingSpinner({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-6 h-6 border-2',
    lg: 'w-10 h-10 border-3',
  };

  return (
    <div
      className={cn(
        "animate-spin rounded-full border-indigo-500 border-t-transparent",
        sizeClasses[size],
        className
      )}
    />
  );
}

/**
 * Full page loading state
 */
export function PageLoadingSkeleton() {
  return (
    <div className="min-h-screen p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-5 w-96" />
        </div>
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>

      {/* Grid */}
      <TrendGridSkeleton count={6} />
    </div>
  );
}

/**
 * Loading overlay for forms/modals
 */
export function LoadingOverlay({ message }: { message?: string }) {
  return (
    <div className="absolute inset-0 bg-zinc-900/80 backdrop-blur-sm flex items-center justify-center z-50 rounded-xl">
      <div className="text-center space-y-4">
        <LoadingSpinner size="lg" />
        {message && (
          <p className="text-zinc-400 text-sm">{message}</p>
        )}
      </div>
    </div>
  );
}

/**
 * Inline loading indicator
 */
export function InlineLoading({ text }: { text?: string }) {
  return (
    <div className="flex items-center gap-2 text-zinc-400">
      <LoadingSpinner size="sm" />
      {text && <span className="text-sm">{text}</span>}
    </div>
  );
}
