import type { BlockContext, BlockResult } from '../types';
import { createDesignTokens } from '../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);

  return {
    'src/components/ThemeToggle.tsx': `'use client';

import { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle() {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'light') {
      setDark(false);
      document.documentElement.classList.remove('dark');
    } else {
      setDark(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
    if (next) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }

  return (
    <button
      onClick={toggle}
      className="p-2 rounded-lg transition-all hover:opacity-80"
      style={{ color: '${t.text}' }}
      title={dark ? 'Светлая тема' : 'Тёмная тема'}
    >
      {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </button>
  );
}
`,
  };
}
