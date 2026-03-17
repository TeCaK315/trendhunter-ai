import type { BlockContext, BlockResult } from '../types';
import { createDesignTokens } from '../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);
  const projectName = ctx.safe.projectName;

  return {
    'src/app/dashboard/settings/page.tsx': `'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Settings, Save, Loader2, Check, LogOut, Building2, Receipt,
  CreditCard, Globe, Hash, Percent, FileText, ImageIcon,
  AlertCircle, CheckCircle2, ExternalLink, Eye, EyeOff, Trash2,
} from 'lucide-react';
import { useT } from '@/lib/i18n';

interface StripeConfig {
  configured: boolean;
  source?: string;
  publishable_key_masked?: string;
  secret_key_masked?: string;
}

interface BusinessSettings {
  business_name: string;
  email: string;
  address: string;
  phone: string;
  website: string;
  tax_id: string;
  logo_url: string;
  default_currency: string;
  default_payment_terms: string;
  default_tax_rate: number;
  tax_label: string;
  invoice_prefix: string;
  default_notes: string;
  payment_instructions: string;
}

const PROFILE_KEY = '${projectName.replace(/'/g, '')}_sender_profile';
const SETTINGS_KEY = '${projectName.replace(/'/g, '')}_settings';

const CURRENCIES = [
  { code: 'USD', label: 'USD - US Dollar' },
  { code: 'EUR', label: 'EUR - Euro' },
  { code: 'GBP', label: 'GBP - British Pound' },
  { code: 'UAH', label: 'UAH - Ukrainian Hryvnia' },
  { code: 'CAD', label: 'CAD - Canadian Dollar' },
  { code: 'AUD', label: 'AUD - Australian Dollar' },
  { code: 'JPY', label: 'JPY - Japanese Yen' },
  { code: 'CHF', label: 'CHF - Swiss Franc' },
  { code: 'INR', label: 'INR - Indian Rupee' },
  { code: 'BRL', label: 'BRL - Brazilian Real' },
];

const PAYMENT_TERMS = [
  { value: 'due_on_receipt', labelKey: 'payment.dueOnReceipt' },
  { value: 'net_15', labelKey: 'payment.net15' },
  { value: 'net_30', labelKey: 'payment.net30' },
  { value: 'net_60', labelKey: 'payment.net60' },
];

export default function SettingsPage() {
  const router = useRouter();
  const t = useT();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'business' | 'invoice' | 'payment'>('business');

  // Stripe config state
  const [stripeConfig, setStripeConfig] = useState<StripeConfig>({ configured: false });
  const [stripeLoading, setStripeLoading] = useState(true);
  const [stripePubKey, setStripePubKey] = useState('');
  const [stripeSecretKey, setStripeSecretKey] = useState('');
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [stripeSaving, setStripeSaving] = useState(false);
  const [stripeError, setStripeError] = useState('');
  const [stripeSuccess, setStripeSuccess] = useState('');

  const [settings, setSettings] = useState<BusinessSettings>({
    business_name: '',
    email: '',
    address: '',
    phone: '',
    website: '',
    tax_id: '',
    logo_url: '',
    default_currency: 'USD',
    default_payment_terms: 'net_30',
    default_tax_rate: 0,
    tax_label: 'Tax',
    invoice_prefix: 'INV',
    default_notes: '',
    payment_instructions: '',
  });

  // Load Stripe config
  useEffect(() => {
    async function loadStripeConfig() {
      try {
        const res = await fetch('/api/admin/stripe');
        if (res.ok) {
          const data = await res.json();
          setStripeConfig(data);
        }
      } catch {}
      setStripeLoading(false);
    }
    loadStripeConfig();
  }, []);

  const handleStripeSave = async () => {
    setStripeSaving(true);
    setStripeError('');
    setStripeSuccess('');

    try {
      const res = await fetch('/api/admin/stripe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publishable_key: stripePubKey,
          secret_key: stripeSecretKey,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStripeError(data.error || 'Failed to save');
      } else {
        setStripeConfig({
          configured: true,
          source: 'database',
          publishable_key_masked: data.publishable_key_masked,
          secret_key_masked: data.secret_key_masked,
        });
        setStripePubKey('');
        setStripeSecretKey('');
        setStripeSuccess(t('settings.stripeTestSuccess'));
        setTimeout(() => setStripeSuccess(''), 5000);
      }
    } catch (err: any) {
      setStripeError(err.message || 'Network error');
    }
    setStripeSaving(false);
  };

  const handleStripeDisconnect = async () => {
    if (!confirm(t('msg.confirmDelete'))) return;
    try {
      await fetch('/api/admin/stripe', { method: 'DELETE' });
      setStripeConfig({ configured: false });
    } catch {}
  };

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      if (stored) {
        setSettings(prev => ({ ...prev, ...JSON.parse(stored) }));
      } else {
        // Migrate from old sender profile
        const profile = localStorage.getItem(PROFILE_KEY);
        if (profile) {
          const p = JSON.parse(profile);
          setSettings(prev => ({
            ...prev,
            business_name: p.business_name || '',
            email: p.email || '',
            address: p.address || '',
            phone: p.phone || '',
          }));
        }
      }
    } catch {}
  }, []);

  const handleSave = () => {
    setSaving(true);
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      // Also update sender profile for backwards compatibility
      localStorage.setItem(PROFILE_KEY, JSON.stringify({
        business_name: settings.business_name,
        email: settings.email,
        address: settings.address,
        phone: settings.phone,
      }));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {}
    setSaving(false);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500000) {
      alert('Logo must be under 500KB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setSettings(prev => ({ ...prev, logo_url: ev.target?.result as string || '' }));
    };
    reader.readAsDataURL(file);
  };

  const handleSignOut = async () => {
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {}
    router.push('/login');
  };

  const update = (field: keyof BusinessSettings, value: string | number) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const inputClasses = "w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 transition-all";
  const inputStyle = { background: '${t.bg}', borderColor: '${t.primary}15', color: '${t.text}' };
  const labelClasses = "block text-xs font-medium mb-1.5";

  const tabs = [
    { id: 'business' as const, label: t('settings.business'), icon: Building2 },
    { id: 'invoice' as const, label: t('settings.invoiceDefaults'), icon: Receipt },
    { id: 'payment' as const, label: t('settings.payment'), icon: CreditCard },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings className="w-6 h-6" style={{ color: '${t.primary}' }} />
          <h1 className="text-xl font-bold" style={{ fontFamily: "'${t.headingFont}', sans-serif", color: '${t.text}' }}>
            {t('settings.title')}
          </h1>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90 disabled:opacity-50"
          style={{ background: '${t.gradientPrimary}' }}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saving ? t('msg.processing') : saved ? t('msg.saved') : t('action.save')}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: '${t.surface1}' }}>
        {tabs.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all"
              style={{
                background: active ? '${t.primary}' : 'transparent',
                color: active ? '#fff' : '${t.text50}',
              }}>
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Business Tab */}
      {activeTab === 'business' && (
        <div className="space-y-5">
          {/* Logo */}
          <div className="rounded-2xl p-5" style={{ background: '${t.surface1}', boxShadow: '${t.shadowSm}', border: '1px solid ${t.primary}08' }}>
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: '${t.text}' }}>
              <ImageIcon className="w-4 h-4" style={{ color: '${t.primary}' }} /> {t('settings.logo')}
            </h2>
            <div className="flex items-center gap-4">
              {settings.logo_url ? (
                <div className="relative">
                  <img src={settings.logo_url} alt="Logo" className="w-20 h-20 object-contain rounded-xl border" style={{ borderColor: '${t.primary}10' }} />
                  <button onClick={() => update('logo_url', '')}
                    className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
                    ×
                  </button>
                </div>
              ) : (
                <div className="w-20 h-20 rounded-xl border-2 border-dashed flex items-center justify-center"
                  style={{ borderColor: '${t.primary}20' }}>
                  <ImageIcon className="w-6 h-6" style={{ color: '${t.text40}' }} />
                </div>
              )}
              <div>
                <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium cursor-pointer border hover:bg-white/[0.04]"
                  style={{ borderColor: '${t.primary}15', color: '${t.text}' }}>
                  <ImageIcon className="w-4 h-4" /> {t('settings.uploadLogo')}
                  <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                </label>
                <p className="text-[11px] mt-1" style={{ color: '${t.text40}' }}>{t('settings.logoHint')}</p>
              </div>
            </div>
          </div>

          {/* Business Details */}
          <div className="rounded-2xl p-5" style={{ background: '${t.surface1}', boxShadow: '${t.shadowSm}', border: '1px solid ${t.primary}08' }}>
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: '${t.text}' }}>
              <Building2 className="w-4 h-4" style={{ color: '${t.primary}' }} /> {t('settings.business')}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClasses} style={{ color: '${t.text50}' }}>{t('settings.businessName')}</label>
                <input type="text" value={settings.business_name} onChange={e => update('business_name', e.target.value)}
                  placeholder="Your Company LLC" className={inputClasses} style={inputStyle} />
              </div>
              <div>
                <label className={labelClasses} style={{ color: '${t.text50}' }}>{t('label.email')}</label>
                <input type="email" value={settings.email} onChange={e => update('email', e.target.value)}
                  placeholder="billing@company.com" className={inputClasses} style={inputStyle} />
              </div>
              <div>
                <label className={labelClasses} style={{ color: '${t.text50}' }}>{t('label.phone')}</label>
                <input type="tel" value={settings.phone} onChange={e => update('phone', e.target.value)}
                  placeholder="+1 (555) 123-4567" className={inputClasses} style={inputStyle} />
              </div>
              <div>
                <label className={labelClasses} style={{ color: '${t.text50}' }}>{t('label.website')}</label>
                <input type="url" value={settings.website} onChange={e => update('website', e.target.value)}
                  placeholder="https://company.com" className={inputClasses} style={inputStyle} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClasses} style={{ color: '${t.text50}' }}>{t('label.address')}</label>
                <input type="text" value={settings.address} onChange={e => update('address', e.target.value)}
                  placeholder="123 Main St, City, State, ZIP, Country" className={inputClasses} style={inputStyle} />
              </div>
              <div>
                <label className={labelClasses} style={{ color: '${t.text50}' }}>{t('settings.taxId')}</label>
                <input type="text" value={settings.tax_id} onChange={e => update('tax_id', e.target.value)}
                  placeholder="US12-3456789" className={inputClasses} style={inputStyle} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Defaults Tab */}
      {activeTab === 'invoice' && (
        <div className="space-y-5">
          <div className="rounded-2xl p-5" style={{ background: '${t.surface1}', boxShadow: '${t.shadowSm}', border: '1px solid ${t.primary}08' }}>
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: '${t.text}' }}>
              <Receipt className="w-4 h-4" style={{ color: '${t.primary}' }} /> {t('settings.defaultValues')}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClasses} style={{ color: '${t.text50}' }}>
                  <Globe className="w-3 h-3 inline mr-1" /> {t('label.currency')}
                </label>
                <select value={settings.default_currency} onChange={e => update('default_currency', e.target.value)}
                  className={inputClasses} style={inputStyle}>
                  {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClasses} style={{ color: '${t.text50}' }}>{t('create.paymentTerms')}</label>
                <select value={settings.default_payment_terms} onChange={e => update('default_payment_terms', e.target.value)}
                  className={inputClasses} style={inputStyle}>
                  {PAYMENT_TERMS.map(term => <option key={term.value} value={term.value}>{t(term.labelKey)}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClasses} style={{ color: '${t.text50}' }}>
                  <Hash className="w-3 h-3 inline mr-1" /> {t('settings.invoiceNumberPrefix')}
                </label>
                <input type="text" value={settings.invoice_prefix} onChange={e => update('invoice_prefix', e.target.value)}
                  placeholder="INV" className={inputClasses} style={inputStyle} />
                <p className="text-[11px] mt-1" style={{ color: '${t.text40}' }}>Invoices will be numbered: {settings.invoice_prefix}-0001</p>
              </div>
              <div>
                <label className={labelClasses} style={{ color: '${t.text50}' }}>
                  <Percent className="w-3 h-3 inline mr-1" /> {t('settings.defaultTaxRate')}
                </label>
                <input type="number" min="0" max="100" step="0.5" value={settings.default_tax_rate || ''}
                  onChange={e => update('default_tax_rate', parseFloat(e.target.value) || 0)}
                  placeholder="0" className={inputClasses} style={inputStyle} />
              </div>
              <div>
                <label className={labelClasses} style={{ color: '${t.text50}' }}>{t('settings.taxLabel')}</label>
                <input type="text" value={settings.tax_label} onChange={e => update('tax_label', e.target.value)}
                  placeholder="Tax / VAT / GST / Sales Tax" className={inputClasses} style={inputStyle} />
              </div>
            </div>
          </div>

          <div className="rounded-2xl p-5" style={{ background: '${t.surface1}', boxShadow: '${t.shadowSm}', border: '1px solid ${t.primary}08' }}>
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: '${t.text}' }}>
              <FileText className="w-4 h-4" style={{ color: '${t.primary}' }} /> {t('settings.defaultNotes')}
            </h2>
            <textarea value={settings.default_notes} onChange={e => update('default_notes', e.target.value)}
              placeholder="Thank you for your business! Payment is due within the terms specified above."
              rows={3} className="w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 resize-none transition-all"
              style={inputStyle} />
            <p className="text-[11px] mt-1" style={{ color: '${t.text40}' }}>{t('settings.defaultNotesHint')}</p>
          </div>
        </div>
      )}

      {/* Payment Tab */}
      {activeTab === 'payment' && (
        <div className="space-y-5">

          {/* ─── Stripe Configuration ─── */}
          <div className="rounded-2xl p-5" style={{ background: '${t.surface1}', boxShadow: '${t.shadowSm}', border: '1px solid ${t.primary}08' }}>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: '${t.text}' }}>
                <CreditCard className="w-4 h-4" style={{ color: '${t.primary}' }} /> {t('settings.stripeConfig')}
              </h2>
              {stripeLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" style={{ color: '${t.text40}' }} />
              ) : stripeConfig.configured ? (
                <span className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: '#22c55e18', color: '#22c55e' }}>
                  <CheckCircle2 className="w-3.5 h-3.5" /> {t('settings.stripeConnected')}
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: '#f59e0b18', color: '#f59e0b' }}>
                  <AlertCircle className="w-3.5 h-3.5" /> {t('settings.stripeNotConnected')}
                </span>
              )}
            </div>
            <p className="text-xs mb-5" style={{ color: '${t.text50}' }}>
              {t('settings.stripeDescription')}
            </p>

            {/* Current connection info */}
            {stripeConfig.configured && (
              <div className="mb-5 p-4 rounded-xl" style={{ background: '${t.primary}08', border: '1px solid ${t.primary}12' }}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <p className="text-[11px] font-medium mb-1" style={{ color: '${t.text40}' }}>{t('settings.publishableKey')}</p>
                    <p className="text-xs font-mono" style={{ color: '${t.text70}' }}>{stripeConfig.publishable_key_masked || '—'}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium mb-1" style={{ color: '${t.text40}' }}>{t('settings.secretKey')}</p>
                    <p className="text-xs font-mono" style={{ color: '${t.text70}' }}>{stripeConfig.secret_key_masked || '—'}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: '1px solid ${t.primary}10' }}>
                  <p className="text-[11px]" style={{ color: '${t.text40}' }}>
                    Source: {stripeConfig.source === 'env' ? '.env file' : 'Database'}
                  </p>
                  {stripeConfig.source === 'database' && (
                    <button onClick={handleStripeDisconnect}
                      className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-lg transition-all hover:bg-red-500/10"
                      style={{ color: '#ef4444' }}>
                      <Trash2 className="w-3 h-3" /> Disconnect
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Enter new keys */}
            {!stripeConfig.configured && (
              <div className="space-y-4">
                <div className="p-3 rounded-xl" style={{ background: '${t.primary}06', border: '1px solid ${t.primary}10' }}>
                  <p className="text-xs" style={{ color: '${t.text60}' }}>
                    {t('settings.stripeInstructions')}{' '}
                    <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-medium underline" style={{ color: '${t.primary}' }}>
                      {t('settings.stripeDashboard')} <ExternalLink className="w-3 h-3" />
                    </a>
                  </p>
                </div>

                <div>
                  <label className={labelClasses} style={{ color: '${t.text50}' }}>{t('settings.publishableKey')}</label>
                  <input type="text" value={stripePubKey} onChange={e => setStripePubKey(e.target.value)}
                    placeholder="pk_live_... or pk_test_..." className={inputClasses} style={inputStyle} />
                </div>

                <div>
                  <label className={labelClasses} style={{ color: '${t.text50}' }}>{t('settings.secretKey')}</label>
                  <div className="relative">
                    <input type={showSecretKey ? 'text' : 'password'} value={stripeSecretKey}
                      onChange={e => setStripeSecretKey(e.target.value)}
                      placeholder="sk_live_... or sk_test_..." className={inputClasses + ' pr-10'} style={inputStyle} />
                    <button type="button" onClick={() => setShowSecretKey(!showSecretKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded" style={{ color: '${t.text40}' }}>
                      {showSecretKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {stripeError && (
                  <div className="p-3 rounded-xl flex items-start gap-2" style={{ background: '#ef444410', border: '1px solid #ef444420' }}>
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#ef4444' }} />
                    <p className="text-xs" style={{ color: '#ef4444' }}>{stripeError}</p>
                  </div>
                )}

                {stripeSuccess && (
                  <div className="p-3 rounded-xl flex items-start gap-2" style={{ background: '#22c55e10', border: '1px solid #22c55e20' }}>
                    <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#22c55e' }} />
                    <p className="text-xs" style={{ color: '#22c55e' }}>{stripeSuccess}</p>
                  </div>
                )}

                <button onClick={handleStripeSave}
                  disabled={stripeSaving || !stripeSecretKey || !stripeSecretKey.startsWith('sk_')}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90 disabled:opacity-40"
                  style={{ background: '${t.gradientPrimary}' }}>
                  {stripeSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                  {stripeSaving ? t('msg.processing') : t('settings.testConnection')}
                </button>
              </div>
            )}
          </div>

          {/* ─── Payment Instructions ─── */}
          <div className="rounded-2xl p-5" style={{ background: '${t.surface1}', boxShadow: '${t.shadowSm}', border: '1px solid ${t.primary}08' }}>
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: '${t.text}' }}>
              <FileText className="w-4 h-4" style={{ color: '${t.primary}' }} /> {t('settings.paymentInstructions')}
            </h2>
            <textarea value={settings.payment_instructions} onChange={e => update('payment_instructions', e.target.value)}
              placeholder="Bank: First National Bank\\nAccount: 1234567890\\nRouting: 021000021\\n\\nOr pay via PayPal: billing@company.com\\nOr pay via Wise: company.com/pay"
              rows={6} className="w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 resize-none transition-all font-mono"
              style={inputStyle} />
            <p className="text-[11px] mt-1" style={{ color: '${t.text40}' }}>
              {t('settings.paymentInstructionsHint')}
            </p>
          </div>

          {/* ─── Account ─── */}
          <div className="rounded-2xl p-5" style={{ background: '${t.surface1}', boxShadow: '${t.shadowSm}', border: '1px solid ${t.primary}08' }}>
            <h2 className="text-sm font-semibold mb-4" style={{ color: '${t.text}' }}>{t('settings.account')}</h2>
            <button onClick={handleSignOut}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all hover:bg-red-500/10"
              style={{ borderColor: '#ef444430', color: '#ef4444' }}>
              <LogOut className="w-4 h-4" /> {t('nav.signOut')}
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
