'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import InteractiveWizard from '@/components/InteractiveWizard';

const WIZARD_STEPS = [{"title":"Enter your market query","description":"Input form"},{"title":"Review analysis","description":"Results dashboard"}];

const DISCLAIMER: string | undefined = undefined;

export default function WizardPage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleComplete(answers: Record<string, string>) {
    setLoading(true);
    try {
      // Combine all answers into one query
      const combined = Object.entries(answers)
        .map(([, val]) => val)
        .filter(Boolean)
        .join('\n\n');

      router.push(`/dashboard/analysis?q=${encodeURIComponent(combined)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen p-6 md:p-8" style={{ background: '#0f0f23' }}>
      <div className="max-w-4xl mx-auto">
        <InteractiveWizard
          steps={WIZARD_STEPS}
          onComplete={handleComplete}
          loading={loading}
          disclaimer={DISCLAIMER}
        />
      </div>
    </div>
  );
}
