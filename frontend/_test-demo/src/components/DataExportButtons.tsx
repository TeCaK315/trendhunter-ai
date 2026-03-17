'use client';

import { useState } from 'react';
import { Download, FileJson, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';

interface DataExportButtonsProps {
  data: any;
  filename?: string;
}

export default function DataExportButtons({ data, filename = 'export' }: DataExportButtonsProps) {
  const [exporting, setExporting] = useState('');

  function exportJSON() {
    setExporting('json');
    const json = JSON.stringify(data, null, 2);
    downloadFile(json, `${filename}.json`, 'application/json');
    setExporting('');
  }

  function exportCSV() {
    setExporting('csv');

    let rows: any[] = [];
    if (Array.isArray(data)) {
      rows = data;
    } else if (data.items && Array.isArray(data.items)) {
      rows = data.items;
    } else if (data.results && Array.isArray(data.results)) {
      rows = data.results;
    } else {
      rows = [data];
    }

    if (rows.length === 0) { setExporting(''); return; }

    const headers = Object.keys(rows[0]);
    const csvRows = [
      headers.join(','),
      ...rows.map(row =>
        headers.map(h => {
          const val = row[h];
          const str = typeof val === 'object' ? JSON.stringify(val) : String(val ?? '');
          return '"' + str.replace(/"/g, '""') + '"';
        }).join(',')
      ),
    ];

    downloadFile(csvRows.join('\n'), `${filename}.csv`, 'text/csv');
    setExporting('');
  }

  function exportText() {
    setExporting('txt');

    let text = '';
    if (typeof data === 'string') {
      text = data;
    } else {
      // Flatten to readable text
      const flatten = (obj: any, prefix = ''): string => {
        let result = '';
        for (const [key, val] of Object.entries(obj)) {
          const label = prefix ? `${prefix}.${key}` : key;
          if (Array.isArray(val)) {
            result += `\n${label}:\n`;
            val.forEach((item, i) => {
              if (typeof item === 'object') {
                result += flatten(item, `  [${i}]`);
              } else {
                result += `  - ${item}\n`;
              }
            });
          } else if (typeof val === 'object' && val !== null) {
            result += flatten(val, label);
          } else {
            result += `${label}: ${val}\n`;
          }
        }
        return result;
      }
      text = flatten(data);
    }

    downloadFile(text, `${filename}.txt`, 'text/plain');
    setExporting('');
  }

  function downloadFile(content: string, name: string, type: string) {
    const blob = new Blob([content], { type: type + ';charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex gap-2 flex-wrap">
      <button
        onClick={exportJSON}
        disabled={!!exporting}
        className="px-3 py-2 rounded-xl text-xs font-medium border flex items-center gap-1.5 hover:opacity-80 transition-all disabled:opacity-50"
        style={{ borderColor: '#6366f140', color: '#e2e8f0' }}
      >
        {exporting === 'json' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileJson className="w-3.5 h-3.5" />}
        JSON
      </button>
      <button
        onClick={exportCSV}
        disabled={!!exporting}
        className="px-3 py-2 rounded-xl text-xs font-medium border flex items-center gap-1.5 hover:opacity-80 transition-all disabled:opacity-50"
        style={{ borderColor: '#6366f140', color: '#e2e8f0' }}
      >
        {exporting === 'csv' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
        CSV
      </button>
      <button
        onClick={exportText}
        disabled={!!exporting}
        className="px-3 py-2 rounded-xl text-xs font-medium border flex items-center gap-1.5 hover:opacity-80 transition-all disabled:opacity-50"
        style={{ borderColor: '#6366f140', color: '#e2e8f0' }}
      >
        {exporting === 'txt' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
        TXT
      </button>
    </div>
  );
}
