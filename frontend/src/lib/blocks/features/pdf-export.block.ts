import type { BlockContext, BlockResult } from '../types';
import { createDesignTokens } from '../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);
  const projectName = ctx.safe.projectName || 'Document';

  return {
    'src/lib/pdf-generator.ts': `import jsPDF from 'jspdf';

interface PdfSection {
  heading?: string;
  content?: string;
  items?: string[];
  table?: { headers: string[]; rows: string[][]; alignRight?: number[] };
}

interface PdfOptions {
  title: string;
  subtitle?: string;
  sections?: PdfSection[];
  brandColor?: string;
  generatedBy?: string;
  footer?: string;
  [key: string]: any;
}

// Strip non-ASCII characters to prevent garbled text in jsPDF (no Cyrillic/CJK support)
function sanitize(text: string): string {
  return text.replace(/[^\\x20-\\x7E]/g, '').trim() || text.replace(/[^\\w\\s.,!?@#$%&*()\\-+=:;/\\\\'"<>{}\\[\\]|~\`]/g, '').trim() || 'Document';
}

export function generatePDF(options: PdfOptions, autoDownloadFilename?: string): any {
  // Auto-build sections from arbitrary data if sections not provided
  let resolvedSections: PdfSection[] = options.sections || [];
  if (resolvedSections.length === 0) {
    // Try to build sections from common data shapes
    if (options.content && Array.isArray(options.content)) {
      resolvedSections.push({
        heading: 'Details',
        items: options.content.map((c: any) =>
          typeof c === 'string' ? c : (c.label ? c.label + ': ' + (c.value ?? '') : JSON.stringify(c))
        ),
      });
    }
    if (options.items && Array.isArray(options.items)) {
      const rows = options.items.map((item: any) => [
        String(item.description || item.name || ''),
        String(item.quantity ?? item.qty ?? 1),
        String(item.rate ?? item.price ?? ''),
        String(item.amount ?? item.total ?? ''),
      ]);
      resolvedSections.push({
        heading: 'Items',
        table: { headers: ['Description', 'Qty', 'Rate', 'Amount'], rows, alignRight: [2, 3] },
      });
    }
    // Fallback: dump all string values as sections
    if (resolvedSections.length === 0) {
      Object.entries(options).forEach(([key, val]) => {
        if (key === 'title' || key === 'subtitle' || key === 'brandColor' || key === 'generatedBy' || key === 'footer') return;
        if (typeof val === 'string' && val.length > 0) {
          resolvedSections.push({ heading: key.replace(/_/g, ' ').replace(/\\b\\w/g, c => c.toUpperCase()), content: val });
        }
      });
    }
  }

  const {
    title,
    subtitle,
    brandColor = '${t.primary}',
    generatedBy = '${projectName}',
    footer,
  } = options;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  function hexToRgb(hex: string): [number, number, number] {
    const h = hex.replace('#', '');
    return [
      parseInt(h.substring(0, 2), 16),
      parseInt(h.substring(2, 4), 16),
      parseInt(h.substring(4, 6), 16),
    ];
  }

  function checkPage(height: number) {
    if (y + height > pageHeight - 20) {
      doc.addPage();
      y = margin;
    }
  }

  const [r, g, b] = hexToRgb(brandColor);

  // ─── Header bar ───
  doc.setFillColor(r, g, b);
  doc.rect(0, 0, pageWidth, 35, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(sanitize(title), margin, 16);

  if (subtitle) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(sanitize(subtitle), margin, 24);
  }

  // Date + brand on right
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), pageWidth - margin, 16, { align: 'right' });
  doc.text(sanitize(generatedBy), pageWidth - margin, 24, { align: 'right' });

  y = 45;
  doc.setTextColor(33, 33, 33);

  // ─── Sections ───
  for (const section of resolvedSections) {
    checkPage(25);

    if (section.heading) {
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(r, g, b);
      doc.text(sanitize(section.heading), margin, y);
      y += 7;
      // Underline
      doc.setDrawColor(r, g, b);
      doc.setLineWidth(0.3);
      doc.line(margin, y - 2, margin + contentWidth, y - 2);
      y += 3;
    }

    doc.setTextColor(55, 55, 55);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    if (section.content) {
      const lines = doc.splitTextToSize(sanitize(section.content), contentWidth);
      checkPage(lines.length * 5 + 4);
      doc.text(lines, margin, y);
      y += lines.length * 5 + 4;
    }

    if (section.items && section.items.length > 0) {
      for (const item of section.items) {
        const lines = doc.splitTextToSize('• ' + sanitize(item), contentWidth - 5);
        checkPage(lines.length * 5 + 2);
        doc.text(lines, margin + 3, y);
        y += lines.length * 5 + 2;
      }
      y += 2;
    }

    if (section.table) {
      const { headers, rows, alignRight = [] } = section.table;
      const colCount = headers.length;
      const colWidth = contentWidth / colCount;

      checkPage(10 + rows.length * 7);

      // Header
      doc.setFillColor(r, g, b);
      doc.rect(margin, y - 4, contentWidth, 7, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      headers.forEach((h, i) => {
        const align = alignRight.includes(i) ? 'right' : 'left';
        const x = align === 'right' ? margin + (i + 1) * colWidth - 2 : margin + i * colWidth + 2;
        doc.text(sanitize(h), x, y, { align });
      });
      y += 6;

      // Rows
      doc.setTextColor(55, 55, 55);
      doc.setFont('helvetica', 'normal');
      rows.forEach((row, ri) => {
        checkPage(7);
        if (ri % 2 === 0) {
          doc.setFillColor(248, 248, 248);
          doc.rect(margin, y - 4, contentWidth, 7, 'F');
        }
        row.forEach((cell, ci) => {
          const align = alignRight.includes(ci) ? 'right' : 'left';
          const x = align === 'right' ? margin + (ci + 1) * colWidth - 2 : margin + ci * colWidth + 2;
          doc.text(sanitize(String(cell)).substring(0, 50), x, y, { align });
        });
        y += 7;
      });
      y += 4;
    }

    y += 4;
  }

  // ─── Footer on all pages ───
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(160, 160, 160);
    doc.text(
      sanitize(footer || \`Generated by \${generatedBy} - Page \${i} of \${totalPages}\`),
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  }

  // Auto-download if filename provided as second argument
  if (autoDownloadFilename) {
    const fname = autoDownloadFilename.endsWith('.pdf') ? autoDownloadFilename : autoDownloadFilename + '.pdf';
    doc.save(fname);
  }

  return doc;
}

export function downloadPDF(doc: jsPDF, filename: string = 'document.pdf') {
  doc.save(filename);
}
`,

    'src/components/ExportButtons.tsx': `'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { generatePDF, downloadPDF } from '@/lib/pdf-generator';

interface ExportButtonsProps {
  title: string;
  data: any;
  filename?: string;
  [key: string]: any;
}

export default function ExportButtons({ title, data, filename }: ExportButtonsProps) {
  const [exporting, setExporting] = useState(false);

  function buildSections() {
    const sections: any[] = [];

    if (data.executive_summary) {
      sections.push({ heading: 'Summary', content: data.executive_summary });
    }

    if (data.sections) {
      data.sections.forEach((s: any) => {
        sections.push({
          heading: s.heading,
          content: s.content,
          items: s.key_points,
        });
      });
    }

    // Support invoice-style data with line items
    if (data.items && Array.isArray(data.items) && data.items.length > 0) {
      const first = data.items[0];
      if (first.description && first.rate !== undefined) {
        // Invoice line items
        sections.push({
          heading: 'Items',
          table: {
            headers: ['Description', 'Qty', 'Rate', 'Amount'],
            rows: data.items.map((item: any) => [
              item.description || '',
              String(item.quantity || 1),
              '$' + (item.rate || 0).toFixed(2),
              '$' + ((item.quantity || 1) * (item.rate || 0)).toFixed(2),
            ]),
            alignRight: [2, 3],
          },
        });
      } else {
        // Generic list items
        sections.push({
          heading: 'Results',
          items: data.items.map((item: any) =>
            typeof item === 'string' ? item : \`\${item.name || item.title}: \${item.description || ''}\`
          ),
        });
      }
    }

    // Totals
    if (data.subtotal !== undefined || data.total !== undefined) {
      const totalLines: string[] = [];
      if (data.subtotal !== undefined) totalLines.push('Subtotal: $' + Number(data.subtotal).toFixed(2));
      if (data.tax_amount !== undefined && data.tax_amount > 0) totalLines.push('Tax: $' + Number(data.tax_amount).toFixed(2));
      if (data.total !== undefined) totalLines.push('Total: $' + Number(data.total).toFixed(2));
      sections.push({ heading: 'Totals', items: totalLines });
    }

    if (data.recommendations && data.recommendations.length > 0) {
      sections.push({
        heading: 'Recommendations',
        items: data.recommendations.map((r: any) =>
          typeof r === 'string' ? r : r.title + ': ' + (r.description || '')
        ),
      });
    }

    if (data.conclusion) {
      sections.push({ heading: 'Conclusion', content: data.conclusion });
    }

    if (data.notes) {
      sections.push({ heading: 'Notes', content: data.notes });
    }

    return sections;
  }

  async function handleDownload() {
    setExporting(true);
    try {
      const sections = buildSections();
      const doc = generatePDF({ title, sections });
      const fname = filename || title.replace(/[^a-zA-Z0-9]/g, '_');
      downloadPDF(doc, fname + '.pdf');
    } catch (err) {
      console.error('PDF generation error:', err);
    } finally {
      setExporting(false);
    }
  }

  return (
    <button
      onClick={handleDownload}
      disabled={exporting}
      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all hover:opacity-80 disabled:opacity-50"
      style={{ borderColor: '${t.primary20}', color: '${t.text}' }}
    >
      {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
      Download PDF
    </button>
  );
}
`,
  };
}
