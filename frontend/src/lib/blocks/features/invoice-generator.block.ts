import type { BlockContext, BlockResult } from '../types';
import { createDesignTokens } from '../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);

  return {
    'src/components/InvoiceGenerator.tsx': `'use client';

import { useState } from 'react';
import { Plus, Trash2, Download, Send, FileText } from 'lucide-react';

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  price: number;
}

interface InvoiceData {
  invoiceNumber: string;
  date: string;
  dueDate: string;
  from: { name: string; address: string; email: string };
  to: { name: string; address: string; email: string };
  items: InvoiceItem[];
  taxRate: number;
  notes: string;
  currency: string;
}

export default function InvoiceGenerator() {
  const [invoice, setInvoice] = useState<InvoiceData>({
    invoiceNumber: 'INV-' + Date.now().toString().slice(-6),
    date: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    from: { name: '', address: '', email: '' },
    to: { name: '', address: '', email: '' },
    items: [{ id: '1', description: '', quantity: 1, price: 0 }],
    taxRate: 20,
    notes: '',
    currency: '₽',
  });

  function updateField(path: string, value: any) {
    setInvoice(prev => {
      const copy: any = JSON.parse(JSON.stringify(prev));
      const parts = path.split('.');
      let obj = copy;
      for (let i = 0; i < parts.length - 1; i++) {
        obj = obj[parts[i]];
      }
      obj[parts[parts.length - 1]] = value;
      return copy;
    });
  }

  function addItem() {
    setInvoice(prev => ({
      ...prev,
      items: [...prev.items, { id: Date.now().toString(), description: '', quantity: 1, price: 0 }],
    }));
  }

  function removeItem(id: string) {
    setInvoice(prev => ({ ...prev, items: prev.items.filter(i => i.id !== id) }));
  }

  function updateItem(id: string, field: string, value: any) {
    setInvoice(prev => ({
      ...prev,
      items: prev.items.map(i => i.id === id ? { ...i, [field]: value } : i),
    }));
  }

  const subtotal = invoice.items.reduce((sum, i) => sum + i.quantity * i.price, 0);
  const tax = subtotal * (invoice.taxRate / 100);
  const total = subtotal + tax;

  function generateHTML(): string {
    const rows = invoice.items.map(i =>
      '<tr><td style="padding:8px;border-bottom:1px solid #eee">' + i.description +
      '</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:center">' + i.quantity +
      '</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right">' + i.price.toFixed(2) + invoice.currency +
      '</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right">' + (i.quantity * i.price).toFixed(2) + invoice.currency + '</td></tr>'
    ).join('');

    return '<html><head><meta charset="utf-8"><title>Invoice ' + invoice.invoiceNumber + '</title></head>' +
      '<body style="font-family:Arial,sans-serif;max-width:800px;margin:0 auto;padding:40px">' +
      '<div style="display:flex;justify-content:space-between;margin-bottom:40px">' +
      '<div><h1 style="margin:0;font-size:28px">СЧЁТ</h1><p style="color:#666;margin:4px 0">' + invoice.invoiceNumber + '</p></div>' +
      '<div style="text-align:right"><p style="margin:2px 0">Дата: ' + invoice.date + '</p>' +
      '<p style="margin:2px 0">Оплатить до: ' + invoice.dueDate + '</p></div></div>' +
      '<div style="display:flex;justify-content:space-between;margin-bottom:30px">' +
      '<div><p style="font-weight:bold;margin:0 0 4px">От:</p><p style="margin:2px 0">' + invoice.from.name + '</p>' +
      '<p style="margin:2px 0;color:#666;font-size:14px">' + invoice.from.address + '</p>' +
      '<p style="margin:2px 0;color:#666;font-size:14px">' + invoice.from.email + '</p></div>' +
      '<div style="text-align:right"><p style="font-weight:bold;margin:0 0 4px">Кому:</p><p style="margin:2px 0">' + invoice.to.name + '</p>' +
      '<p style="margin:2px 0;color:#666;font-size:14px">' + invoice.to.address + '</p>' +
      '<p style="margin:2px 0;color:#666;font-size:14px">' + invoice.to.email + '</p></div></div>' +
      '<table style="width:100%;border-collapse:collapse;margin-bottom:20px">' +
      '<thead><tr style="background:#f8f9fa"><th style="padding:10px;text-align:left">Описание</th>' +
      '<th style="padding:10px;text-align:center">Кол-во</th><th style="padding:10px;text-align:right">Цена</th>' +
      '<th style="padding:10px;text-align:right">Сумма</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<div style="text-align:right;margin-top:20px">' +
      '<p style="margin:4px 0">Подытог: ' + subtotal.toFixed(2) + invoice.currency + '</p>' +
      '<p style="margin:4px 0">НДС (' + invoice.taxRate + '%): ' + tax.toFixed(2) + invoice.currency + '</p>' +
      '<p style="margin:4px 0;font-size:20px;font-weight:bold">Итого: ' + total.toFixed(2) + invoice.currency + '</p></div>' +
      (invoice.notes ? '<div style="margin-top:30px;padding:15px;background:#f8f9fa;border-radius:8px"><p style="font-weight:bold;margin:0 0 4px">Примечания:</p><p style="margin:0;font-size:14px;color:#666">' + invoice.notes + '</p></div>' : '') +
      '</body></html>';
  }

  function downloadInvoice() {
    const html = generateHTML();
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = invoice.invoiceNumber + '.html';
    a.click();
    URL.revokeObjectURL(url);
  }

  function printInvoice() {
    const html = generateHTML();
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      setTimeout(() => win.print(), 500);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header info */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: '${t.text70}' }}>Номер счёта</label>
          <input value={invoice.invoiceNumber} onChange={e => updateField('invoiceNumber', e.target.value)}
            className="w-full px-3 py-2 rounded-xl border text-sm" style={{ borderColor: '${t.primary40}', background: '${t.bg}', color: '${t.text}' }} />
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: '${t.text70}' }}>Дата</label>
          <input type="date" value={invoice.date} onChange={e => updateField('date', e.target.value)}
            className="w-full px-3 py-2 rounded-xl border text-sm" style={{ borderColor: '${t.primary40}', background: '${t.bg}', color: '${t.text}' }} />
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: '${t.text70}' }}>Оплатить до</label>
          <input type="date" value={invoice.dueDate} onChange={e => updateField('dueDate', e.target.value)}
            className="w-full px-3 py-2 rounded-xl border text-sm" style={{ borderColor: '${t.primary40}', background: '${t.bg}', color: '${t.text}' }} />
        </div>
      </div>

      {/* From / To */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <p className="text-sm font-semibold" style={{ color: '${t.text}' }}>От кого</p>
          <input placeholder="Название компании" value={invoice.from.name} onChange={e => updateField('from.name', e.target.value)}
            className="w-full px-3 py-2 rounded-xl border text-sm" style={{ borderColor: '${t.primary40}', background: '${t.bg}', color: '${t.text}' }} />
          <input placeholder="Адрес" value={invoice.from.address} onChange={e => updateField('from.address', e.target.value)}
            className="w-full px-3 py-2 rounded-xl border text-sm" style={{ borderColor: '${t.primary40}', background: '${t.bg}', color: '${t.text}' }} />
          <input placeholder="Email" value={invoice.from.email} onChange={e => updateField('from.email', e.target.value)}
            className="w-full px-3 py-2 rounded-xl border text-sm" style={{ borderColor: '${t.primary40}', background: '${t.bg}', color: '${t.text}' }} />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-semibold" style={{ color: '${t.text}' }}>Кому</p>
          <input placeholder="Название компании" value={invoice.to.name} onChange={e => updateField('to.name', e.target.value)}
            className="w-full px-3 py-2 rounded-xl border text-sm" style={{ borderColor: '${t.primary40}', background: '${t.bg}', color: '${t.text}' }} />
          <input placeholder="Адрес" value={invoice.to.address} onChange={e => updateField('to.address', e.target.value)}
            className="w-full px-3 py-2 rounded-xl border text-sm" style={{ borderColor: '${t.primary40}', background: '${t.bg}', color: '${t.text}' }} />
          <input placeholder="Email" value={invoice.to.email} onChange={e => updateField('to.email', e.target.value)}
            className="w-full px-3 py-2 rounded-xl border text-sm" style={{ borderColor: '${t.primary40}', background: '${t.bg}', color: '${t.text}' }} />
        </div>
      </div>

      {/* Items */}
      <div>
        <p className="text-sm font-semibold mb-2" style={{ color: '${t.text}' }}>Позиции</p>
        <div className="space-y-2">
          {invoice.items.map(item => (
            <div key={item.id} className="flex gap-2 items-center">
              <input placeholder="Описание" value={item.description} onChange={e => updateItem(item.id, 'description', e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl border text-sm" style={{ borderColor: '${t.primary40}', background: '${t.bg}', color: '${t.text}' }} />
              <input type="number" placeholder="Кол-во" value={item.quantity || ''} onChange={e => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                className="w-20 px-3 py-2 rounded-xl border text-sm text-center" style={{ borderColor: '${t.primary40}', background: '${t.bg}', color: '${t.text}' }} />
              <input type="number" placeholder="Цена" value={item.price || ''} onChange={e => updateItem(item.id, 'price', parseFloat(e.target.value) || 0)}
                className="w-28 px-3 py-2 rounded-xl border text-sm text-right" style={{ borderColor: '${t.primary40}', background: '${t.bg}', color: '${t.text}' }} />
              <span className="w-24 text-right text-sm font-medium" style={{ color: '${t.text}' }}>
                {(item.quantity * item.price).toFixed(2)}{invoice.currency}
              </span>
              <button onClick={() => removeItem(item.id)} className="p-2 rounded-lg hover:opacity-70" style={{ color: '${t.text50}' }}>
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <button onClick={addItem} className="mt-2 px-4 py-2 rounded-xl border text-xs font-medium flex items-center gap-1" style={{ borderColor: '${t.primary40}', color: '${t.primary}' }}>
          <Plus className="w-3.5 h-3.5" /> Добавить позицию
        </button>
      </div>

      {/* Tax + Notes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: '${t.text70}' }}>Примечания</label>
          <textarea value={invoice.notes} onChange={e => updateField('notes', e.target.value)} rows={3}
            placeholder="Условия оплаты, реквизиты..."
            className="w-full px-3 py-2 rounded-xl border text-sm resize-none" style={{ borderColor: '${t.primary40}', background: '${t.bg}', color: '${t.text}' }} />
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-sm" style={{ color: '${t.text70}' }}>
            <span>Подытог:</span><span>{subtotal.toFixed(2)}{invoice.currency}</span>
          </div>
          <div className="flex justify-between text-sm items-center">
            <span style={{ color: '${t.text70}' }}>НДС:</span>
            <div className="flex items-center gap-1">
              <input type="number" value={invoice.taxRate} onChange={e => updateField('taxRate', parseFloat(e.target.value) || 0)}
                className="w-16 px-2 py-1 rounded-lg border text-sm text-center" style={{ borderColor: '${t.primary40}', background: '${t.bg}', color: '${t.text}' }} />
              <span style={{ color: '${t.text70}' }}>% = {tax.toFixed(2)}{invoice.currency}</span>
            </div>
          </div>
          <div className="flex justify-between text-lg font-bold pt-2 border-t" style={{ color: '${t.text}', borderColor: '${t.primary40}' }}>
            <span>Итого:</span><span>{total.toFixed(2)}{invoice.currency}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button onClick={downloadInvoice} className="flex-1 py-3 rounded-xl text-white font-medium text-sm flex items-center justify-center gap-2"
          style={{ background: '${t.gradientPrimary}' }}>
          <Download className="w-4 h-4" /> Скачать HTML
        </button>
        <button onClick={printInvoice} className="flex-1 py-3 rounded-xl border font-medium text-sm flex items-center justify-center gap-2"
          style={{ borderColor: '${t.primary40}', color: '${t.text}' }}>
          <FileText className="w-4 h-4" /> Печать
        </button>
      </div>
    </div>
  );
}
`,
  };
}
