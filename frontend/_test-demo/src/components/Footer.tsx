import { Sparkles } from 'lucide-react';

export default function Footer() {
  return (
    <footer
      className="border-t py-8"
      style={{
        background: '#0f0f23',
        borderColor: '#6366f110',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
            >
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <span
              className="text-sm font-heading font-semibold"
              style={{ color: '#e2e8f0' }}
            >
              MaxTest App
            </span>
          </div>
          <p className="text-sm" style={{ color: '#e2e8f050' }}>
            Создано с MaxTest App
          </p>
        </div>
      </div>
    </footer>
  );
}
