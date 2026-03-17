'use client';

import { useState } from 'react';
import { Download, Mail, Loader2 } from 'lucide-react';
import { generatePDF, downloadPDF } from '@/lib/pdf-generator';

interface ExportButtonsProps {
  title: string;
  data: any;
  outputFormat?: string;
}

export default function ExportButtons({ title, data, outputFormat }: ExportButtonsProps) {
  const [exporting, setExporting] = useState(false);

  function buildSections() {
    const sections: any[] = [];

    if (data.summary) {
      sections.push({ heading: 'Резюме', content: data.summary });
    }

    if (data.score != null) {
      sections.push({ heading: 'Оценка', score: data.score });
    }

    if (data.breakdown && data.breakdown.length > 0) {
      sections.push({
        heading: 'Разбивка',
        table: {
          headers: ['Категория', 'Оценка', 'Комментарий'],
          rows: data.breakdown.map((b: any) => [b.category || '', String(b.score || ''), b.explanation || '']),
        },
      });
    }

    if (data.executive_summary) {
      sections.push({ heading: 'Резюме', content: data.executive_summary });
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

    if (data.items && data.items.length > 0) {
      sections.push({
        heading: 'Результаты',
        items: data.items.map((item: any) =>
          `[${item.priority || 'N/A'}] ${item.name}: ${item.description || ''}`
        ),
      });
    }

    if (data.recommendations && data.recommendations.length > 0) {
      const recs = data.recommendations.map((r: any) =>
        typeof r === 'string' ? r : `${r.title}: ${r.description || ''}`
      );
      sections.push({ heading: 'Рекомендации', items: recs });
    }

    if (data.action_plan && data.action_plan.length > 0) {
      sections.push({
        heading: 'План действий',
        items: data.action_plan.map((s: any) =>
          `Шаг ${s.step}: ${s.action} (${s.timeline || 'без срока'})`
        ),
      });
    }

    if (data.key_findings && data.key_findings.length > 0) {
      sections.push({ heading: 'Ключевые находки', items: data.key_findings });
    }

    if (data.opportunities && data.opportunities.length > 0) {
      sections.push({ heading: 'Возможности', items: data.opportunities });
    }

    if (data.risks && data.risks.length > 0) {
      sections.push({ heading: 'Риски', items: data.risks });
    }

    if (data.conclusion) {
      sections.push({ heading: 'Заключение', content: data.conclusion });
    }

    if (data.expected_outcome) {
      sections.push({ heading: 'Ожидаемый результат', content: data.expected_outcome });
    }

    return sections;
  }

  async function handleDownload() {
    setExporting(true);
    try {
      const sections = buildSections();
      const doc = generatePDF({
        title,
        subtitle: new Date().toLocaleDateString('ru-RU'),
        sections,
      });
      downloadPDF(doc, `${title.replace(/[^a-zA-Zа-яА-Я0-9]/g, '_')}.pdf`);
    } catch (err) {
      console.error('PDF generation error:', err);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={handleDownload}
        disabled={exporting}
        className="px-4 py-2 rounded-xl text-sm font-medium border flex items-center gap-2 hover:opacity-80 disabled:opacity-50 transition-all"
        style={{ borderColor: '#6366f140', color: '#e2e8f0' }}
      >
        {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        Скачать PDF
      </button>
    </div>
  );
}
