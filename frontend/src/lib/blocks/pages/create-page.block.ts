import type { BlockContext, BlockResult } from '../types';
import { createDesignTokens, escapeJsx } from '../design-injector';

/**
 * Universal "Create" page — generates a dynamic form with:
 * - From/To business details (sender profile saved to localStorage)
 * - Auto-incrementing document number (INV-001, etc.)
 * - Line items (add/remove rows) with auto-calculations
 * - Due date + payment terms
 * - Live summary panel
 * - Submit → generates PDF directly (no AI needed) OR calls API
 * - Redirect to /dashboard/analysis with data
 *
 * Adapts to ANY niche via ProductSpec fields.
 */
export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);
  const spec = ctx.product_spec;

  const primaryOutput = ctx.safe.primaryOutput || 'result';
  const primaryOutputCap = primaryOutput.charAt(0).toUpperCase() + primaryOutput.slice(1);
  const projectName = ctx.safe.projectName;

  // Get required fields — these become the "header" fields of the form
  const requiredFields = spec?.user_input?.required_fields || [];

  // Separate header fields (metadata) from potential line-item fields
  const lineItemKeywords = ['amount', 'price', 'quantity', 'item', 'description', 'rate', 'cost', 'total', 'name', 'product', 'service'];
  const headerFields = requiredFields.filter(f =>
    !lineItemKeywords.some(k => f.name.toLowerCase().includes(k))
  );

  // Build header fields JSX (only non-invoice fields — invoice has its own From/To)
  const extraFieldsJsx = headerFields
    .filter(f => !['client', 'date', 'due', 'invoice', 'from', 'to', 'email', 'address', 'company', 'business', 'sender', 'recipient'].some(k => f.name.toLowerCase().includes(k)))
    .map(f => {
      const name = escapeJsx(f.name);
      const label = escapeJsx(f.description || f.name).replace(/_/g, ' ');
      const labelCap = label.charAt(0).toUpperCase() + label.slice(1);
      const placeholder = escapeJsx(f.example || '');
      const type = f.type?.toLowerCase() === 'date' ? 'date'
        : f.type?.toLowerCase() === 'email' ? 'email'
        : f.type?.toLowerCase() === 'number' ? 'number'
        : 'text';

      return `
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '${t.text50}' }}>${labelCap}</label>
                <input
                  type="${type}"
                  value={formData['${name}'] || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, '${name}': e.target.value }))}
                  placeholder="${placeholder}"
                  className="w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 transition-all"
                  style={{ background: '${t.bg}', borderColor: '${t.primary}15', color: '${t.text}', focusRingColor: '${t.primary}' }}
                />
              </div>`;
    }).join('');

  return {
    'src/app/dashboard/create/page.tsx': `'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, Loader2, FileText, Download, Save, Building2, User, Edit3 } from 'lucide-react';
import { useT } from '@/lib/i18n';

const CURRENCIES = [
  { code: 'USD', symbol: '$', label: 'USD ($)' },
  { code: 'EUR', symbol: '\\u20AC', label: 'EUR (\\u20AC)' },
  { code: 'GBP', symbol: '\\u00A3', label: 'GBP (\\u00A3)' },
  { code: 'UAH', symbol: 'UAH', label: 'UAH' },
  { code: 'RUB', symbol: 'RUB', label: 'RUB' },
  { code: 'JPY', symbol: '\\u00A5', label: 'JPY (\\u00A5)' },
  { code: 'CAD', symbol: 'C$', label: 'CAD (C$)' },
  { code: 'AUD', symbol: 'A$', label: 'AUD (A$)' },
  { code: 'CHF', symbol: 'CHF', label: 'CHF' },
  { code: 'CNY', symbol: '\\u00A5', label: 'CNY (\\u00A5)' },
  { code: 'INR', symbol: 'INR', label: 'INR' },
  { code: 'BRL', symbol: 'R$', label: 'BRL (R$)' },
];

const PAYMENT_STATUSES = [
  { value: 'draft', labelKey: 'status.draft', color: '#94a3b8' },
  { value: 'sent', labelKey: 'status.sent', color: '#3b82f6' },
  { value: 'unpaid', labelKey: 'status.overdue', color: '#f59e0b' },
  { value: 'paid', labelKey: 'status.paid', color: '#22c55e' },
  { value: 'overdue', labelKey: 'status.overdue', color: '#ef4444' },
  { value: 'cancelled', labelKey: 'status.cancelled', color: '#6b7280' },
];

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
}

interface SenderProfile {
  business_name: string;
  email: string;
  address: string;
  phone: string;
}

const PAYMENT_TERMS = [
  { value: 'due_on_receipt', labelKey: 'payment.dueOnReceipt' },
  { value: 'net_15', labelKey: 'payment.net15' },
  { value: 'net_30', labelKey: 'payment.net30' },
  { value: 'net_60', labelKey: 'payment.net60' },
];

const PROFILE_KEY = '${projectName.replace(/'/g, '')}_sender_profile';
const HISTORY_KEY = '${projectName.replace(/'/g, '')}_history';
const COUNTER_KEY = '${projectName.replace(/'/g, '')}_doc_counter';
const CLIENTS_KEY = '${projectName.replace(/'/g, '')}_clients';
const SETTINGS_KEY = '${projectName.replace(/'/g, '')}_settings';

function getNextDocNumber(): string {
  try {
    const counter = parseInt(localStorage.getItem(COUNTER_KEY) || '0') + 1;
    localStorage.setItem(COUNTER_KEY, String(counter));
    return 'INV-' + String(counter).padStart(4, '0');
  } catch { return 'INV-0001'; }
}

export default function CreatePage() {
  const router = useRouter();
  const t = useT();
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});

  // ─── Sender (From) ───
  const [sender, setSender] = useState<SenderProfile>({
    business_name: '', email: '', address: '', phone: '',
  });
  const [senderSaved, setSenderSaved] = useState(false);

  // ─── Recipient (To) ───
  const [recipient, setRecipient] = useState({
    name: '', email: '', address: '',
  });

  // ─── Document meta ───
  const [docNumber, setDocNumber] = useState('');
  const [docDate, setDocDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('net_30');

  // ─── Line items ───
  const [items, setItems] = useState<LineItem[]>([
    { id: crypto.randomUUID(), description: '', quantity: 1, rate: 0 },
  ]);
  const [taxRate, setTaxRate] = useState(0);
  const [notes, setNotes] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [paymentStatus, setPaymentStatus] = useState('draft');
  const [editMode, setEditMode] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // Client autocomplete
  const [savedClients, setSavedClients] = useState<any[]>([]);
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [clientSearch, setClientSearch] = useState('');

  // ─── Load saved profile, clients, settings + generate doc number OR load for editing ───
  useEffect(() => {
    try {
      const saved = localStorage.getItem(PROFILE_KEY);
      if (saved) {
        const profile = JSON.parse(saved);
        setSender(profile);
        setSenderSaved(true);
      }
    } catch {}

    // Load saved clients for autocomplete
    try {
      const clients = JSON.parse(localStorage.getItem(CLIENTS_KEY) || '[]');
      setSavedClients(clients);
    } catch {}

    // Load default settings
    try {
      const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
      if (settings.default_currency) setCurrency(settings.default_currency);
      if (settings.default_payment_terms) setPaymentTerms(settings.default_payment_terms);
      if (settings.default_tax_rate) setTaxRate(settings.default_tax_rate);
      if (settings.default_notes) setNotes(settings.default_notes);
    } catch {}

    // Check if pre-filling from client page
    const params = new URLSearchParams(window.location.search);
    const clientName = params.get('client_name');
    if (clientName && !params.get('edit')) {
      setRecipient({
        name: clientName,
        email: params.get('client_email') || '',
        address: params.get('client_address') || '',
      });
    }

    // Check if editing an existing invoice
    const editParam = params.get('edit');
    if (editParam) {
      try {
        const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
        const found = history.find((h: any) => h.id === editParam);
        if (found && found.data) {
          const d = found.data;
          setEditMode(true);
          setEditId(editParam);
          setDocNumber(d.doc_number || '');
          setDocDate(d.date || new Date().toISOString().split('T')[0]);
          setDueDate(d.due_date || '');
          setPaymentTerms(d.payment_terms || 'net_30');
          setCurrency(d.currency || 'USD');
          setPaymentStatus(d.payment_status || 'draft');
          setNotes(d.notes || '');
          setTaxRate(d.tax_rate || 0);
          if (d.sender) setSender(d.sender);
          if (d.recipient) setRecipient(d.recipient);
          if (d.items && d.items.length > 0) {
            setItems(d.items.map((item: any) => ({ ...item, id: item.id || crypto.randomUUID() })));
          }
          return; // Skip new doc number generation
        }
      } catch {}
    }

    setDocNumber(getNextDocNumber());

    // Set default due date (30 days from now)
    const due = new Date();
    due.setDate(due.getDate() + 30);
    setDueDate(due.toISOString().split('T')[0]);
  }, []);

  // Update due date when payment terms change
  useEffect(() => {
    const days = paymentTerms === 'due_on_receipt' ? 0
      : paymentTerms === 'net_15' ? 15
      : paymentTerms === 'net_60' ? 60 : 30;
    const due = new Date(docDate);
    due.setDate(due.getDate() + days);
    setDueDate(due.toISOString().split('T')[0]);
  }, [paymentTerms, docDate]);

  // ─── Calculations ───
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.rate, 0);
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

  const addItem = () => {
    setItems([...items, { id: crypto.randomUUID(), description: '', quantity: 1, rate: 0 }]);
  };

  const removeItem = (id: string) => {
    if (items.length > 1) setItems(items.filter(i => i.id !== id));
  };

  const updateItem = (id: string, field: keyof LineItem, value: string | number) => {
    setItems(items.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const formatCurrency = (n: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);
  };

  const saveSenderProfile = () => {
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(sender));
      setSenderSaved(true);
    } catch {}
  };

  const handleSubmit = async () => {
    setSubmitting(true);

    const payload = {
      ...formData,
      doc_number: docNumber,
      date: docDate,
      due_date: dueDate,
      payment_terms: paymentTerms,
      payment_status: paymentStatus,
      currency,
      sender,
      recipient,
      items: items.filter(i => i.description),
      subtotal,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      total,
      notes,
    };

    try {
      // Save to history
      const existing = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');

      if (editMode && editId) {
        // Update existing entry
        const updated = existing.map((h: any) =>
          h.id === editId ? { ...h, data: payload, result: payload, input: recipient.name || 'Unnamed', payment_status: paymentStatus } : h
        );
        localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
      } else {
        // Create new entry
        const historyItem = {
          id: crypto.randomUUID(),
          doc_number: docNumber,
          input: recipient.name || 'Unnamed',
          created_at: new Date().toISOString(),
          status: 'completed',
          payment_status: paymentStatus,
          data: payload,
          result: payload,
        };
        localStorage.setItem(HISTORY_KEY, JSON.stringify([historyItem, ...existing].slice(0, 50)));
      }

      // Auto-save new client if not in contacts
      if (recipient.name && !editMode) {
        try {
          const existingClients = JSON.parse(localStorage.getItem(CLIENTS_KEY) || '[]');
          const exists = existingClients.some((c: any) => c.name.toLowerCase() === recipient.name.toLowerCase());
          if (!exists) {
            const newClient = {
              id: crypto.randomUUID(),
              name: recipient.name,
              email: recipient.email,
              address: recipient.address,
              phone: '',
              company: '',
              notes: '',
              created_at: new Date().toISOString(),
            };
            localStorage.setItem(CLIENTS_KEY, JSON.stringify([newClient, ...existingClients]));
          }
        } catch {}
      }

      // Navigate to result/preview page
      const params = new URLSearchParams();
      params.set('_result', JSON.stringify(payload));
      params.set('doc_number', docNumber);
      router.push(\`/dashboard/analysis?\${params.toString()}\`);
    } catch (err) {
      console.error('Submit error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const inputClasses = "w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 transition-all";
  const inputStyle = { background: '${t.bg}', borderColor: '${t.primary}15', color: '${t.text}' };
  const labelClasses = "block text-xs font-medium mb-1.5";

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="p-2 rounded-xl transition-all hover:bg-white/[0.06]">
          <ArrowLeft className="w-5 h-5" style={{ color: '${t.text50}' }} />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold" style={{ fontFamily: "'${t.headingFont}', sans-serif", color: '${t.text}' }}>
            {editMode ? <><Edit3 className="w-4 h-4 inline mr-2" />{t('create.editTitle')}</> : t('create.title')}
          </h1>
          <p className="text-xs mt-0.5" style={{ color: '${t.text40}' }}>
            {docNumber && <span className="font-mono">{docNumber}</span>}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ─── Form (left 3 cols) ─── */}
        <div className="lg:col-span-3 space-y-5">

          {/* ─── FROM / TO ─── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* From (Sender) */}
            <div className="rounded-2xl p-5" style={{ background: '${t.surface1}', boxShadow: '${t.shadowSm}', border: '1px solid ${t.primary}08' }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4" style={{ color: '${t.primary}' }} />
                  <h2 className="text-sm font-semibold" style={{ color: '${t.text}' }}>{t('label.from')}</h2>
                </div>
                <button
                  onClick={saveSenderProfile}
                  className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg transition-all"
                  style={{ color: senderSaved ? '${t.accent}' : '${t.primary}', background: senderSaved ? '${t.accent}15' : '${t.primary}10' }}
                  title={t('create.saveDefault')}
                >
                  <Save className="w-3 h-3" />
                  {senderSaved ? t('create.saved') : t('action.save')}
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className={labelClasses} style={{ color: '${t.text50}' }}>{t('create.businessName')}</label>
                  <input
                    type="text"
                    value={sender.business_name}
                    onChange={(e) => setSender(prev => ({ ...prev, business_name: e.target.value }))}
                    placeholder="Your Company LLC"
                    className={inputClasses}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label className={labelClasses} style={{ color: '${t.text50}' }}>{t('label.email')}</label>
                  <input
                    type="email"
                    value={sender.email}
                    onChange={(e) => setSender(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="billing@company.com"
                    className={inputClasses}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label className={labelClasses} style={{ color: '${t.text50}' }}>{t('label.address')}</label>
                  <input
                    type="text"
                    value={sender.address}
                    onChange={(e) => setSender(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="123 Main St, City, State"
                    className={inputClasses}
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>

            {/* To (Recipient) */}
            <div className="rounded-2xl p-5" style={{ background: '${t.surface1}', boxShadow: '${t.shadowSm}', border: '1px solid ${t.primary}08' }}>
              <div className="flex items-center gap-2 mb-4">
                <User className="w-4 h-4" style={{ color: '${t.accent}' }} />
                <h2 className="text-sm font-semibold" style={{ color: '${t.text}' }}>{t('label.to')}</h2>
              </div>
              <div className="space-y-3">
                <div className="relative">
                  <label className={labelClasses} style={{ color: '${t.text50}' }}>{t('create.clientName')}</label>
                  <input
                    type="text"
                    value={recipient.name}
                    onChange={(e) => {
                      const val = e.target.value;
                      setRecipient(prev => ({ ...prev, name: val }));
                      setClientSearch(val);
                      setShowClientDropdown(val.length > 0 && savedClients.some(c => c.name.toLowerCase().includes(val.toLowerCase())));
                    }}
                    onFocus={() => {
                      if (savedClients.length > 0) setShowClientDropdown(true);
                    }}
                    onBlur={() => setTimeout(() => setShowClientDropdown(false), 200)}
                    placeholder="Acme Corp"
                    className={inputClasses}
                    style={inputStyle}
                    autoComplete="off"
                  />
                  {showClientDropdown && (
                    <div className="absolute z-20 top-full left-0 right-0 mt-1 rounded-xl border shadow-lg max-h-48 overflow-y-auto"
                      style={{ background: '${t.surface2}', borderColor: '${t.primary}15' }}>
                      {savedClients
                        .filter(c => !clientSearch || c.name.toLowerCase().includes(clientSearch.toLowerCase()))
                        .slice(0, 8)
                        .map((c: any) => (
                          <button key={c.id} type="button"
                            className="w-full text-left px-3 py-2 text-sm hover:bg-white/[0.06] transition-colors flex items-center gap-2"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setRecipient({ name: c.name, email: c.email || '', address: c.address || '' });
                              setShowClientDropdown(false);
                            }}>
                            <span className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                              style={{ background: '${t.primary}' }}>
                              {c.name.charAt(0).toUpperCase()}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate" style={{ color: '${t.text}' }}>{c.name}</p>
                              {c.email && <p className="text-[11px] truncate" style={{ color: '${t.text40}' }}>{c.email}</p>}
                            </div>
                          </button>
                        ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className={labelClasses} style={{ color: '${t.text50}' }}>{t('create.clientEmail')}</label>
                  <input
                    type="email"
                    value={recipient.email}
                    onChange={(e) => setRecipient(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="client@acme.com"
                    className={inputClasses}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label className={labelClasses} style={{ color: '${t.text50}' }}>{t('create.clientAddress')}</label>
                  <input
                    type="text"
                    value={recipient.address}
                    onChange={(e) => setRecipient(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="456 Oak Ave, City, State"
                    className={inputClasses}
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ─── Document Details ─── */}
          <div className="rounded-2xl p-5" style={{ background: '${t.surface1}', boxShadow: '${t.shadowSm}', border: '1px solid ${t.primary}08' }}>
            <h2 className="text-sm font-semibold mb-4" style={{ color: '${t.text}' }}>{t('create.details')}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className={labelClasses} style={{ color: '${t.text50}' }}>{t('label.number')}</label>
                <input
                  type="text"
                  value={docNumber}
                  onChange={(e) => setDocNumber(e.target.value)}
                  className={inputClasses + ' font-mono'}
                  style={inputStyle}
                />
              </div>
              <div>
                <label className={labelClasses} style={{ color: '${t.text50}' }}>{t('label.date')}</label>
                <input
                  type="date"
                  value={docDate}
                  onChange={(e) => setDocDate(e.target.value)}
                  className={inputClasses}
                  style={inputStyle}
                />
              </div>
              <div>
                <label className={labelClasses} style={{ color: '${t.text50}' }}>{t('create.paymentTerms')}</label>
                <select
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  className={inputClasses}
                  style={inputStyle}
                >
                  {PAYMENT_TERMS.map(term => (
                    <option key={term.value} value={term.value}>{t(term.labelKey)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClasses} style={{ color: '${t.text50}' }}>{t('label.dueDate')}</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className={inputClasses}
                  style={inputStyle}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
              <div>
                <label className={labelClasses} style={{ color: '${t.text50}' }}>{t('label.currency')}</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className={inputClasses}
                  style={inputStyle}
                >
                  {CURRENCIES.map(c => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClasses} style={{ color: '${t.text50}' }}>{t('label.status')}</label>
                <select
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value)}
                  className={inputClasses}
                  style={inputStyle}
                >
                  {PAYMENT_STATUSES.map(s => (
                    <option key={s.value} value={s.value}>{t(s.labelKey)}</option>
                  ))}
                </select>
              </div>
            </div>
${extraFieldsJsx ? `
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              ${extraFieldsJsx}
            </div>` : ''}
          </div>

          {/* ─── Line items ─── */}
          <div className="rounded-2xl p-5" style={{ background: '${t.surface1}', boxShadow: '${t.shadowSm}', border: '1px solid ${t.primary}08' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold" style={{ color: '${t.text}' }}>{t('create.lineItems')}</h2>
              <button
                onClick={addItem}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl transition-all hover:scale-[1.03]"
                style={{ color: '${t.primary}', background: '${t.primary}10' }}
              >
                <Plus className="w-3.5 h-3.5" /> {t('create.addItem')}
              </button>
            </div>

            {/* Table header */}
            <div className="hidden sm:grid grid-cols-12 gap-3 mb-2 px-1">
              <div className="col-span-5 text-xs font-medium" style={{ color: '${t.text50}' }}>{t('label.description')}</div>
              <div className="col-span-2 text-xs font-medium" style={{ color: '${t.text50}' }}>{t('label.quantity')}</div>
              <div className="col-span-2 text-xs font-medium" style={{ color: '${t.text50}' }}>{t('label.rate')}</div>
              <div className="col-span-2 text-xs font-medium text-right" style={{ color: '${t.text50}' }}>{t('label.amount')}</div>
              <div className="col-span-1" />
            </div>

            {/* Items */}
            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.id} className="grid grid-cols-12 gap-3 items-center group">
                  <div className="col-span-12 sm:col-span-5">
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                      placeholder="Item description"
                      className={inputClasses}
                      style={inputStyle}
                    />
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateItem(item.id, 'quantity', parseInt(e.target.value) || 0)}
                      className={inputClasses}
                      style={inputStyle}
                    />
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.rate || ''}
                      onChange={(e) => updateItem(item.id, 'rate', parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      className={inputClasses}
                      style={inputStyle}
                    />
                  </div>
                  <div className="col-span-3 sm:col-span-2 text-right">
                    <span className="text-sm font-semibold" style={{ color: '${t.text}' }}>
                      {formatCurrency(item.quantity * item.rate)}
                    </span>
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <button
                      onClick={() => removeItem(item.id)}
                      className="p-1.5 rounded-lg transition-all opacity-40 group-hover:opacity-100 hover:bg-red-500/10"
                      style={{ color: items.length > 1 ? '#ef4444' : '${t.text50}' }}
                      disabled={items.length <= 1}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ─── Notes ─── */}
          <div className="rounded-2xl p-5" style={{ background: '${t.surface1}', boxShadow: '${t.shadowSm}', border: '1px solid ${t.primary}08' }}>
            <h2 className="text-sm font-semibold mb-3" style={{ color: '${t.text}' }}>{t('label.notes')}</h2>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('create.notesPlaceholder')}
              rows={3}
              className="w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 resize-none transition-all"
              style={{ background: '${t.bg}', borderColor: '${t.primary}15', color: '${t.text}' }}
            />
          </div>
        </div>

        {/* ─── Summary (right 2 cols) ─── */}
        <div className="lg:col-span-2">
          <div className="sticky top-20 space-y-5">
            {/* Totals */}
            <div className="rounded-2xl p-5" style={{ background: '${t.surface2}', boxShadow: '${t.shadowMd}', border: '1px solid ${t.primary}10' }}>
              <h2 className="text-sm font-semibold mb-4" style={{ color: '${t.text}' }}>{t('label.total')}</h2>

              {/* Mini preview */}
              {(sender.business_name || recipient.name) && (
                <div className="mb-4 pb-4" style={{ borderBottom: '1px solid ${t.primary}10' }}>
                  {sender.business_name && (
                    <p className="text-xs font-medium" style={{ color: '${t.text70}' }}>{sender.business_name}</p>
                  )}
                  {recipient.name && (
                    <p className="text-xs mt-1" style={{ color: '${t.text50}' }}>{t('label.to')}: {recipient.name}</p>
                  )}
                  {docNumber && (
                    <p className="text-[11px] font-mono mt-1" style={{ color: '${t.text40}' }}>{docNumber}</p>
                  )}
                </div>
              )}

              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span style={{ color: '${t.text50}' }}>{t('create.items')}</span>
                  <span className="font-mono text-xs" style={{ color: '${t.text50}' }}>{items.filter(i => i.description).length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span style={{ color: '${t.text50}' }}>{t('label.subtotal')}</span>
                  <span style={{ color: '${t.text}' }}>{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span style={{ color: '${t.text50}' }}>{t('label.tax')}</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={taxRate || ''}
                      onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="w-16 px-2 py-1 rounded-lg border text-xs text-right focus:outline-none transition-all"
                      style={{ background: '${t.bg}', borderColor: '${t.primary}15', color: '${t.text}' }}
                    />
                    <span className="text-xs" style={{ color: '${t.text50}' }}>%</span>
                  </div>
                </div>
                {taxRate > 0 && (
                  <div className="flex justify-between text-sm">
                    <span style={{ color: '${t.text50}' }}>{t('create.taxAmount')}</span>
                    <span style={{ color: '${t.text}' }}>{formatCurrency(taxAmount)}</span>
                  </div>
                )}
                <div className="border-t pt-3 flex justify-between" style={{ borderColor: '${t.primary}15' }}>
                  <span className="text-sm font-semibold" style={{ color: '${t.text}' }}>{t('label.total')}</span>
                  <span className="text-xl font-bold" style={{ color: '${t.primary}' }}>{formatCurrency(total)}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <button
              onClick={handleSubmit}
              disabled={submitting || items.every(i => !i.description)}
              className="w-full py-3.5 rounded-xl text-sm font-semibold text-white transition-all duration-300 hover:scale-[1.02] hover:opacity-90 disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2"
              style={{ background: '${t.gradientPrimary}', boxShadow: '0 0 24px ${t.primary}20' }}
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> {t('msg.processing')}</>
              ) : (
                <><FileText className="w-4 h-4" /> {editMode ? t('create.update') : t('create.submit')}</>
              )}
            </button>

            <Link
              href="/dashboard"
              className="block w-full py-2.5 rounded-xl text-sm font-medium text-center border transition-all duration-200 hover:bg-white/[0.04]"
              style={{ borderColor: '${t.primary}15', color: '${t.text50}' }}
            >
              {t('action.cancel')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
`,
  };
}
