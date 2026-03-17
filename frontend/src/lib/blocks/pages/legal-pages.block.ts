import type { BlockContext, BlockResult } from '../types';
import { createDesignTokens } from '../design-injector';

/**
 * Legal Pages Block — generates Privacy Policy, Terms of Service, About Us, FAQ
 *
 * - Standard legal templates with placeholders
 * - Placeholders highlighted in RED until filled in
 * - Admin editor at /dashboard/legal-editor to edit all legal pages
 * - Content stored in localStorage, rendered on public pages
 */
export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);
  const projectName = ctx.safe.projectName;

  const LEGAL_KEY = `${projectName.replace(/'/g, '')}_legal_pages`;

  // Default legal content templates with {{PLACEHOLDER}} markers
  const defaultPrivacy = `Last updated: {{EFFECTIVE_DATE}}

{{COMPANY_NAME}} ("we", "us", or "our") operates {{WEBSITE_URL}} (the "Service"). This Privacy Policy informs you of our policies regarding the collection, use, and disclosure of personal data when you use our Service.

1. Information We Collect

We collect the following types of information:
- Account information: name, email address, and password when you create an account
- Billing information: payment details processed securely through Stripe
- Usage data: how you interact with our Service, including pages visited and features used
- Device data: browser type, IP address, and operating system

2. How We Use Your Information

We use collected information to:
- Provide and maintain our Service
- Process payments and send invoices
- Send important updates about your account
- Improve our Service based on usage patterns
- Comply with legal obligations

3. Data Storage and Security

Your data is stored securely using industry-standard encryption. We use Supabase for database management and Stripe for payment processing. We retain your data for as long as your account is active.

4. Third-Party Services

We use the following third-party services:
- Supabase (database and authentication)
- Stripe (payment processing)
- Vercel (hosting)

Each service has its own privacy policy governing the use of your data.

5. Your Rights

You have the right to:
- Access your personal data
- Request correction of inaccurate data
- Request deletion of your data
- Export your data
- Opt out of marketing communications

6. Contact Us

For privacy-related inquiries, contact us at:
Email: {{CONTACT_EMAIL}}
Address: {{COMPANY_ADDRESS}}
Registration: {{COMPANY_REGISTRATION}}`;

  const defaultTerms = `Last updated: {{EFFECTIVE_DATE}}

Please read these Terms of Service ("Terms") carefully before using {{WEBSITE_URL}} operated by {{COMPANY_NAME}}.

1. Acceptance of Terms

By accessing or using our Service, you agree to be bound by these Terms. If you disagree with any part, you may not access the Service.

2. Description of Service

{{COMPANY_NAME}} provides {{SERVICE_DESCRIPTION}}. The Service is provided "as is" and "as available" without warranties of any kind.

3. User Accounts

- You must provide accurate and complete registration information
- You are responsible for maintaining the security of your account
- You must notify us immediately of any unauthorized use
- We reserve the right to suspend or terminate accounts that violate these Terms

4. Payment Terms

- Prices are listed in the currency displayed at the time of purchase
- All payments are processed securely through Stripe
- Subscriptions auto-renew unless cancelled before the renewal date
- Refunds are handled on a case-by-case basis within 14 days of purchase

5. Intellectual Property

- The Service and its content are owned by {{COMPANY_NAME}}
- You retain ownership of any data you input into the Service
- You grant us a license to process your data as needed to provide the Service

6. Limitation of Liability

{{COMPANY_NAME}} shall not be liable for any indirect, incidental, special, or consequential damages resulting from your use of the Service.

7. Governing Law

These Terms shall be governed by the laws of {{JURISDICTION}}, without regard to conflict of law provisions.

8. Changes to Terms

We reserve the right to modify these Terms at any time. We will notify users of significant changes via email or through the Service.

9. Contact

Questions about these Terms should be directed to:
Email: {{CONTACT_EMAIL}}
Address: {{COMPANY_ADDRESS}}`;

  const defaultAbout = `# About {{COMPANY_NAME}}

{{COMPANY_NAME}} was created to solve a real problem: {{SERVICE_DESCRIPTION}}.

## Our Mission

We believe that every freelancer and small business deserves professional tools without the enterprise price tag. Our platform makes it easy to create, send, and track professional documents in minutes.

## How It Works

1. **Create** — Fill in your details and line items
2. **Send** — Email directly to your clients with one click
3. **Track** — Monitor payment status and generate reports

## Contact Us

Have questions or feedback? We'd love to hear from you.

Email: {{CONTACT_EMAIL}}
Website: {{WEBSITE_URL}}
Address: {{COMPANY_ADDRESS}}
Registration: {{COMPANY_REGISTRATION}}`;

  const defaultFAQ = `## Frequently Asked Questions

### How do I get started?
Sign up for a free account, fill in your business details in Settings, and create your first document. It takes less than 2 minutes.

### Is my data secure?
Yes. We use industry-standard encryption and secure infrastructure. Your payment data is processed by Stripe and never touches our servers.

### Can I customize the look of my documents?
Yes. You can upload your logo, set your brand colors, and customize the default notes and payment instructions in Settings.

### How do I export my data?
Go to Reports and click "Export CSV" to download all your data in spreadsheet format. You can also download individual documents as PDF.

### What payment methods are supported?
We accept all major credit cards through Stripe. Your clients can pay via the payment link included in each document.

### Can I cancel my subscription?
Yes, you can cancel anytime from the Billing page. Your data will remain accessible until the end of your billing period.

### How do I contact support?
Email us at {{CONTACT_EMAIL}} and we'll respond within 24 hours.

### Do you offer refunds?
Yes, we offer full refunds within 14 days of purchase if you're not satisfied.`;

  return {
    // ─── Public Legal Pages ───
    'src/app/privacy/page.tsx': `'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Shield } from 'lucide-react';
import { useT } from '@/lib/i18n';

const LEGAL_KEY = '${LEGAL_KEY}';

export default function PrivacyPage() {
  const t = useT();
  const [content, setContent] = useState('');

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(LEGAL_KEY) || '{}');
      setContent(stored.privacy || ${JSON.stringify(defaultPrivacy)});
    } catch {
      setContent(${JSON.stringify(defaultPrivacy)});
    }
  }, []);

  return (
    <div className="min-h-screen" style={{ background: '${t.bg}' }}>
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link href="/" className="inline-flex items-center gap-2 text-sm mb-8 hover:opacity-80 transition-opacity" style={{ color: '${t.primary}' }}>
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Link>
        <div className="flex items-center gap-3 mb-6">
          <Shield className="w-6 h-6" style={{ color: '${t.primary}' }} />
          <h1 className="text-2xl font-bold" style={{ fontFamily: "'${t.headingFont}', sans-serif", color: '${t.text}' }}>{t('legal.privacyPolicy')}</h1>
        </div>
        <div className="prose prose-sm max-w-none" style={{ color: '${t.text70}' }}>
          {content.split('\\n').map((line, i) => {
            // Highlight unfilled placeholders in red
            const hasPlaceholder = /\\{\\{[A-Z_]+\\}\\}/.test(line);
            if (line.startsWith('# ')) return <h1 key={i} className="text-xl font-bold mt-8 mb-4" style={{ color: '${t.text}' }}>{line.replace('# ', '')}</h1>;
            if (line.startsWith('## ')) return <h2 key={i} className="text-lg font-semibold mt-6 mb-3" style={{ color: '${t.text}' }}>{line.replace('## ', '')}</h2>;
            if (line.startsWith('- ')) return <li key={i} className="ml-4 mb-1" style={{ color: hasPlaceholder ? '#ef4444' : '${t.text70}' }}>{line.replace('- ', '')}</li>;
            if (line.match(/^\\d+\\./)) return <h3 key={i} className="text-base font-semibold mt-5 mb-2" style={{ color: '${t.text}' }}>{line}</h3>;
            if (!line.trim()) return <br key={i} />;
            return <p key={i} className="mb-2" style={{ color: hasPlaceholder ? '#ef4444' : '${t.text70}' }}>{line}</p>;
          })}
        </div>
      </div>
    </div>
  );
}
`,

    'src/app/terms/page.tsx': `'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, FileText } from 'lucide-react';
import { useT } from '@/lib/i18n';

const LEGAL_KEY = '${LEGAL_KEY}';

export default function TermsPage() {
  const t = useT();
  const [content, setContent] = useState('');

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(LEGAL_KEY) || '{}');
      setContent(stored.terms || ${JSON.stringify(defaultTerms)});
    } catch {
      setContent(${JSON.stringify(defaultTerms)});
    }
  }, []);

  return (
    <div className="min-h-screen" style={{ background: '${t.bg}' }}>
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link href="/" className="inline-flex items-center gap-2 text-sm mb-8 hover:opacity-80 transition-opacity" style={{ color: '${t.primary}' }}>
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Link>
        <div className="flex items-center gap-3 mb-6">
          <FileText className="w-6 h-6" style={{ color: '${t.primary}' }} />
          <h1 className="text-2xl font-bold" style={{ fontFamily: "'${t.headingFont}', sans-serif", color: '${t.text}' }}>{t('legal.termsOfService')}</h1>
        </div>
        <div className="prose prose-sm max-w-none" style={{ color: '${t.text70}' }}>
          {content.split('\\n').map((line, i) => {
            const hasPlaceholder = /\\{\\{[A-Z_]+\\}\\}/.test(line);
            if (line.startsWith('# ')) return <h1 key={i} className="text-xl font-bold mt-8 mb-4" style={{ color: '${t.text}' }}>{line.replace('# ', '')}</h1>;
            if (line.startsWith('## ')) return <h2 key={i} className="text-lg font-semibold mt-6 mb-3" style={{ color: '${t.text}' }}>{line.replace('## ', '')}</h2>;
            if (line.startsWith('- ')) return <li key={i} className="ml-4 mb-1" style={{ color: hasPlaceholder ? '#ef4444' : '${t.text70}' }}>{line.replace('- ', '')}</li>;
            if (line.match(/^\\d+\\./)) return <h3 key={i} className="text-base font-semibold mt-5 mb-2" style={{ color: '${t.text}' }}>{line}</h3>;
            if (!line.trim()) return <br key={i} />;
            return <p key={i} className="mb-2" style={{ color: hasPlaceholder ? '#ef4444' : '${t.text70}' }}>{line}</p>;
          })}
        </div>
      </div>
    </div>
  );
}
`,

    'src/app/about/page.tsx': `'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Info } from 'lucide-react';
import { useT } from '@/lib/i18n';

const LEGAL_KEY = '${LEGAL_KEY}';

export default function AboutPage() {
  const t = useT();
  const [content, setContent] = useState('');

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(LEGAL_KEY) || '{}');
      setContent(stored.about || ${JSON.stringify(defaultAbout)});
    } catch {
      setContent(${JSON.stringify(defaultAbout)});
    }
  }, []);

  return (
    <div className="min-h-screen" style={{ background: '${t.bg}' }}>
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link href="/" className="inline-flex items-center gap-2 text-sm mb-8 hover:opacity-80 transition-opacity" style={{ color: '${t.primary}' }}>
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Link>
        <div className="flex items-center gap-3 mb-6">
          <Info className="w-6 h-6" style={{ color: '${t.primary}' }} />
          <h1 className="text-2xl font-bold" style={{ fontFamily: "'${t.headingFont}', sans-serif", color: '${t.text}' }}>{t('legal.aboutUs')}</h1>
        </div>
        <div className="prose prose-sm max-w-none" style={{ color: '${t.text70}' }}>
          {content.split('\\n').map((line, i) => {
            const hasPlaceholder = /\\{\\{[A-Z_]+\\}\\}/.test(line);
            if (line.startsWith('# ')) return <h1 key={i} className="text-xl font-bold mt-8 mb-4" style={{ color: '${t.text}' }}>{line.replace('# ', '')}</h1>;
            if (line.startsWith('## ')) return <h2 key={i} className="text-lg font-semibold mt-6 mb-3" style={{ color: '${t.text}' }}>{line.replace('## ', '')}</h2>;
            if (line.startsWith('### ')) return <h3 key={i} className="text-base font-semibold mt-4 mb-2" style={{ color: '${t.text}' }}>{line.replace('### ', '')}</h3>;
            if (line.startsWith('- ')) return <li key={i} className="ml-4 mb-1">{line.replace('- ', '')}</li>;
            if (!line.trim()) return <br key={i} />;
            return <p key={i} className="mb-2" style={{ color: hasPlaceholder ? '#ef4444' : '${t.text70}' }}>{line}</p>;
          })}
        </div>
      </div>
    </div>
  );
}
`,

    'src/app/faq/page.tsx': `'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, HelpCircle, ChevronDown } from 'lucide-react';
import { useT } from '@/lib/i18n';

const LEGAL_KEY = '${LEGAL_KEY}';

export default function FAQPage() {
  const t = useT();
  const [content, setContent] = useState('');
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(LEGAL_KEY) || '{}');
      setContent(stored.faq || ${JSON.stringify(defaultFAQ)});
    } catch {
      setContent(${JSON.stringify(defaultFAQ)});
    }
  }, []);

  // Parse FAQ into Q&A pairs
  const faqItems = content.split('###').filter(s => s.trim()).map(block => {
    const lines = block.trim().split('\\n');
    const question = lines[0]?.trim() || '';
    const answer = lines.slice(1).join('\\n').trim();
    return { question, answer };
  });

  return (
    <div className="min-h-screen" style={{ background: '${t.bg}' }}>
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link href="/" className="inline-flex items-center gap-2 text-sm mb-8 hover:opacity-80 transition-opacity" style={{ color: '${t.primary}' }}>
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Link>
        <div className="flex items-center gap-3 mb-6">
          <HelpCircle className="w-6 h-6" style={{ color: '${t.primary}' }} />
          <h1 className="text-2xl font-bold" style={{ fontFamily: "'${t.headingFont}', sans-serif", color: '${t.text}' }}>{t('legal.faq')}</h1>
        </div>
        <div className="space-y-2">
          {faqItems.map((item, i) => (
            <div key={i} className="rounded-xl border overflow-hidden"
              style={{ borderColor: openIndex === i ? '${t.primary}20' : '${t.primary}08' }}>
              <button onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full flex items-center justify-between p-4 text-left transition-colors hover:bg-white/[0.02]">
                <span className="text-sm font-medium pr-4" style={{ color: '${t.text}' }}>{item.question}</span>
                <ChevronDown className="w-4 h-4 flex-shrink-0 transition-transform"
                  style={{ color: '${t.text50}', transform: openIndex === i ? 'rotate(180deg)' : 'rotate(0deg)' }} />
              </button>
              {openIndex === i && (
                <div className="px-4 pb-4">
                  {item.answer.split('\\n').map((line, j) => {
                    const hasPlaceholder = /\\{\\{[A-Z_]+\\}\\}/.test(line);
                    if (!line.trim()) return <br key={j} />;
                    return <p key={j} className="text-sm mb-1" style={{ color: hasPlaceholder ? '#ef4444' : '${t.text70}' }}>{line}</p>;
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
`,

    // ─── Admin Legal Editor ───
    'src/app/dashboard/legal-editor/page.tsx': `'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Save, Check, Loader2, Shield, FileText, Info,
  HelpCircle, AlertTriangle, Eye,
} from 'lucide-react';
import { useT } from '@/lib/i18n';

const LEGAL_KEY = '${LEGAL_KEY}';

const PLACEHOLDER_HINTS: Record<string, string> = {
  'COMPANY_NAME': 'Your registered business name (e.g. "Acme LLC", "John Doe Sole Proprietor"). Find it on your business registration certificate.',
  'WEBSITE_URL': 'Your full website URL including https:// (e.g. "https://invoiceflow.com")',
  'CONTACT_EMAIL': 'Business email for legal/support inquiries (e.g. "legal@company.com")',
  'COMPANY_ADDRESS': 'Registered business address. Check your incorporation documents or tax registration.',
  'COMPANY_REGISTRATION': 'Business registration number: EIN (US), KVK (NL), Company Number (UK), ИНН/ОГРН (RU), ЄДРПОУ (UA). Found on your registration certificate from the government.',
  'EFFECTIVE_DATE': 'Date when this policy takes effect (e.g. "January 1, 2026")',
  'JURISDICTION': 'Country/state whose laws govern these terms. Usually where your business is registered (e.g. "State of Delaware, USA", "Netherlands", "England and Wales").',
  'SERVICE_DESCRIPTION': 'Brief description of what your service does (e.g. "an online invoicing platform for freelancers and small businesses")',
};

const TABS = [
  { id: 'privacy', label: 'Privacy Policy', icon: Shield, url: '/privacy' },
  { id: 'terms', label: 'Terms of Service', icon: FileText, url: '/terms' },
  { id: 'about', label: 'About Us', icon: Info, url: '/about' },
  { id: 'faq', label: 'FAQ', icon: HelpCircle, url: '/faq' },
];

const DEFAULTS: Record<string, string> = {
  privacy: ${JSON.stringify(defaultPrivacy)},
  terms: ${JSON.stringify(defaultTerms)},
  about: ${JSON.stringify(defaultAbout)},
  faq: ${JSON.stringify(defaultFAQ)},
};

export default function LegalEditorPage() {
  const t = useT();
  const [pages, setPages] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState('privacy');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [hoveredPlaceholder, setHoveredPlaceholder] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(LEGAL_KEY) || '{}');
      setPages({
        privacy: stored.privacy || DEFAULTS.privacy,
        terms: stored.terms || DEFAULTS.terms,
        about: stored.about || DEFAULTS.about,
        faq: stored.faq || DEFAULTS.faq,
      });
    } catch {
      setPages({ ...DEFAULTS });
    }
  }, []);

  const currentContent = pages[activeTab] || '';

  const updateContent = (content: string) => {
    setPages(prev => ({ ...prev, [activeTab]: content }));
  };

  const handleSave = () => {
    setSaving(true);
    try {
      localStorage.setItem(LEGAL_KEY, JSON.stringify(pages));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {}
    setSaving(false);
  };

  // Find unfilled placeholders
  const placeholders: string[] = [];
  const phRegex = /\\{\\{([A-Z_]+)\\}\\}/g;
  let phMatch: RegExpExecArray | null;
  while ((phMatch = phRegex.exec(currentContent)) !== null) { placeholders.push(phMatch[1]); }
  const uniquePlaceholders = placeholders.filter((v, i, a) => a.indexOf(v) === i);

  const replaceAll = (placeholder: string, value: string) => {
    const updated = currentContent.replace(new RegExp('\\\\{\\\\{' + placeholder + '\\\\}\\\\}', 'g'), value);
    updateContent(updated);
  };

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
              {t('legal.editor')}
            </h1>
            <p className="text-xs mt-0.5" style={{ color: '${t.text40}' }}>{t('legal.editorSubtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {TABS.find(t => t.id === activeTab) && (
            <Link href={TABS.find(t => t.id === activeTab)!.url} target="_blank"
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border transition-all hover:bg-white/[0.04]"
              style={{ borderColor: '${t.primary}15', color: '${t.text50}' }}>
              <Eye className="w-4 h-4" /> Preview
            </Link>
          )}
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90 disabled:opacity-50"
            style={{ background: '${t.gradientPrimary}' }}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saved ? 'Saved!' : 'Save All'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: '${t.surface1}' }}>
        {TABS.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          const pageContent = pages[tab.id] || '';
          const hasUnfilled = /\\{\\{[A-Z_]+\\}\\}/.test(pageContent);
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all relative"
              style={{ background: active ? '${t.primary}' : 'transparent', color: active ? '#fff' : '${t.text50}' }}>
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
              {hasUnfilled && (
                <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500" />
              )}
            </button>
          );
        })}
      </div>

      {/* Unfilled Placeholders Warning */}
      {uniquePlaceholders.length > 0 && (
        <div className="rounded-2xl p-4" style={{ background: '#ef444410', border: '1px solid #ef444420' }}>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4" style={{ color: '#ef4444' }} />
            <h3 className="text-sm font-semibold" style={{ color: '#ef4444' }}>
              {uniquePlaceholders.length} placeholder{uniquePlaceholders.length > 1 ? 's' : ''} need your data
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {uniquePlaceholders.map(ph => (
              <div key={ph} className="relative group">
                <div className="flex items-center gap-2 p-2 rounded-lg" style={{ background: '#ef444408' }}>
                  <span className="text-xs font-mono font-bold" style={{ color: '#ef4444' }}>{'{{' + ph + '}}'}</span>
                  <input type="text" placeholder={'Enter ' + ph.toLowerCase().replace(/_/g, ' ')}
                    className="flex-1 text-xs px-2 py-1 rounded border bg-transparent focus:outline-none"
                    style={{ borderColor: '#ef444430', color: '${t.text}' }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.target as HTMLInputElement).value) {
                        replaceAll(ph, (e.target as HTMLInputElement).value);
                        (e.target as HTMLInputElement).value = '';
                      }
                    }}
                  />
                </div>
                {/* Tooltip with hint */}
                <div className="absolute left-0 bottom-full mb-1 w-72 p-2 rounded-lg text-[11px] opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10"
                  style={{ background: '${t.surface2}', color: '${t.text70}', boxShadow: '${t.shadowMd}', border: '1px solid ${t.primary}15' }}>
                  {PLACEHOLDER_HINTS[ph] || 'Replace this with your actual data'}
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] mt-2" style={{ color: '#ef444480' }}>
            Type a value and press Enter to replace all occurrences. Hover for details on where to find the data.
          </p>
        </div>
      )}

      {/* Editor */}
      <div className="rounded-2xl overflow-hidden" style={{ background: '${t.surface1}', boxShadow: '${t.shadowSm}', border: '1px solid ${t.primary}08' }}>
        <textarea
          ref={textareaRef}
          value={currentContent}
          onChange={(e) => updateContent(e.target.value)}
          className="w-full min-h-[500px] p-5 text-sm font-mono leading-relaxed focus:outline-none resize-y"
          style={{ background: 'transparent', color: '${t.text}', caretColor: '${t.primary}' }}
          placeholder="Enter your content here. Use ## for headings, ### for subheadings, - for bullet points."
        />
      </div>
    </div>
  );
}
`,
  };
}
