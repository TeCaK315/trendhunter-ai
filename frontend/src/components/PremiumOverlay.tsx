'use client';

import React from 'react';

interface Props {
  isLocked: boolean;
  cost: number;
  coinBalance: number | null;
  onUnlock: () => void;
  children: React.ReactNode;
  label?: string;
}

export default function PremiumOverlay({ isLocked, cost, coinBalance, onUnlock, children, label }: Props) {
  if (!isLocked) {
    return <>{children}</>;
  }

  const canAfford = (coinBalance ?? 0) >= cost;

  return (
    <div className="relative">
      {/* Blurred content */}
      <div className="blur-sm select-none pointer-events-none opacity-60">
        {children}
      </div>

      {/* Overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900/60 rounded-xl backdrop-blur-[2px]">
        <div className="bg-zinc-800/90 rounded-xl p-4 text-center max-w-xs border border-zinc-700">
          <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-3">
            <span className="text-xl">🔒</span>
          </div>
          <p className="text-sm text-white font-medium mb-1">
            {label || 'Премиум данные'}
          </p>
          <p className="text-xs text-zinc-400 mb-3">
            Детальный анализ с цитатами и источниками
          </p>
          <button
            onClick={onUnlock}
            disabled={!canAfford}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              canAfford
                ? 'bg-amber-500 hover:bg-amber-400 text-black'
                : 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
            }`}
          >
            Разблокировать ({cost} монет)
          </button>
          {!canAfford && (
            <p className="text-xs text-red-400/70 mt-1.5">Недостаточно монет</p>
          )}
          {coinBalance !== null && (
            <p className="text-xs text-zinc-500 mt-1">Баланс: {coinBalance}</p>
          )}
        </div>
      </div>
    </div>
  );
}
