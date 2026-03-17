import jsPDF from 'jspdf';

interface PdfSection {
  heading?: string;
  content?: string;
  items?: string[];
  score?: number;
  table?: { headers: string[]; rows: string[][] };
}

interface PdfOptions {
  title: string;
  subtitle?: string;
  sections: PdfSection[];
  brandColor?: string;
  generatedBy?: string;
}

export function generatePDF(options: PdfOptions): jsPDF {
  const { title, subtitle, sections, brandColor = '#6366f1', generatedBy = 'MaxTest App' } = options;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // Helper: hex to RGB
  function hexToRgb(hex: string): [number, number, number] {
    const h = hex.replace('#', '');
    return [
      parseInt(h.substring(0, 2), 16),
      parseInt(h.substring(2, 4), 16),
      parseInt(h.substring(4, 6), 16),
    ];
  }

  // Helper: check page break
  function checkPage(height: number) {
    if (y + height > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      y = margin;
    }
  }

  const [r, g, b] = hexToRgb(brandColor);

  // ─── Header ───
  doc.setFillColor(r, g, b);
  doc.rect(0, 0, pageWidth, 40, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text(title, margin, 18);

  if (subtitle) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(subtitle, margin, 28);
  }

  doc.setFontSize(9);
  doc.text(new Date().toLocaleDateString('ru-RU'), pageWidth - margin, 18, { align: 'right' });
  doc.text(generatedBy, pageWidth - margin, 28, { align: 'right' });

  y = 50;
  doc.setTextColor(33, 33, 33);

  // ─── Sections ───
  for (const section of sections) {
    checkPage(30);

    if (section.heading) {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(r, g, b);
      doc.text(section.heading, margin, y);
      y += 8;
    }

    doc.setTextColor(55, 55, 55);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    // Score
    if (section.score != null) {
      checkPage(20);
      doc.setFontSize(32);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(r, g, b);
      doc.text(String(section.score) + '/100', margin, y + 10);
      y += 18;
      doc.setFontSize(10);
      doc.setTextColor(55, 55, 55);
    }

    // Content
    if (section.content) {
      const lines = doc.splitTextToSize(section.content, contentWidth);
      checkPage(lines.length * 5 + 5);
      doc.setFont('helvetica', 'normal');
      doc.text(lines, margin, y);
      y += lines.length * 5 + 5;
    }

    // Items list
    if (section.items && section.items.length > 0) {
      for (const item of section.items) {
        const lines = doc.splitTextToSize('• ' + item, contentWidth - 5);
        checkPage(lines.length * 5 + 2);
        doc.text(lines, margin + 3, y);
        y += lines.length * 5 + 2;
      }
      y += 3;
    }

    // Table
    if (section.table) {
      const { headers, rows } = section.table;
      const colWidth = contentWidth / headers.length;

      checkPage(10 + rows.length * 8);

      // Header row
      doc.setFillColor(r, g, b);
      doc.rect(margin, y - 4, contentWidth, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      headers.forEach((h, i) => {
        doc.text(h, margin + i * colWidth + 2, y);
      });
      y += 7;

      // Data rows
      doc.setTextColor(55, 55, 55);
      doc.setFont('helvetica', 'normal');
      rows.forEach((row, ri) => {
        if (ri % 2 === 0) {
          doc.setFillColor(245, 245, 245);
          doc.rect(margin, y - 4, contentWidth, 7, 'F');
        }
        row.forEach((cell, ci) => {
          doc.text(String(cell).substring(0, 40), margin + ci * colWidth + 2, y);
        });
        y += 7;
      });
      y += 5;
    }

    y += 5;
  }

  // ─── Footer ───
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `${generatedBy} — Страница ${i} из ${totalPages}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }

  return doc;
}

export function downloadPDF(doc: jsPDF, filename: string = 'report.pdf') {
  doc.save(filename);
}
