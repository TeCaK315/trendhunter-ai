import type { BlockContext, BlockResult } from '../types';
import { createDesignTokens } from '../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);

  return {
    'src/components/RichTextEditor.tsx': `'use client';

import { useState, useRef, useCallback } from 'react';
import { Bold, Italic, Underline, List, ListOrdered, Link, AlignLeft, AlignCenter, AlignRight, Heading1, Heading2, Code, Quote } from 'lucide-react';

interface RichTextEditorProps {
  value?: string;
  onChange?: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}

export default function RichTextEditor({ value, onChange, placeholder, minHeight = 200 }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);

  const execCommand = useCallback((command: string, val?: string) => {
    document.execCommand(command, false, val);
    editorRef.current?.focus();
    if (onChange && editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  const tools = [
    { icon: <Bold className="w-4 h-4" />, cmd: 'bold', title: 'Жирный' },
    { icon: <Italic className="w-4 h-4" />, cmd: 'italic', title: 'Курсив' },
    { icon: <Underline className="w-4 h-4" />, cmd: 'underline', title: 'Подчёркнутый' },
    { type: 'separator' },
    { icon: <Heading1 className="w-4 h-4" />, cmd: 'formatBlock', val: 'h2', title: 'Заголовок' },
    { icon: <Heading2 className="w-4 h-4" />, cmd: 'formatBlock', val: 'h3', title: 'Подзаголовок' },
    { type: 'separator' },
    { icon: <List className="w-4 h-4" />, cmd: 'insertUnorderedList', title: 'Список' },
    { icon: <ListOrdered className="w-4 h-4" />, cmd: 'insertOrderedList', title: 'Нум. список' },
    { type: 'separator' },
    { icon: <AlignLeft className="w-4 h-4" />, cmd: 'justifyLeft', title: 'По левому' },
    { icon: <AlignCenter className="w-4 h-4" />, cmd: 'justifyCenter', title: 'По центру' },
    { icon: <AlignRight className="w-4 h-4" />, cmd: 'justifyRight', title: 'По правому' },
    { type: 'separator' },
    { icon: <Quote className="w-4 h-4" />, cmd: 'formatBlock', val: 'blockquote', title: 'Цитата' },
    { icon: <Code className="w-4 h-4" />, cmd: 'formatBlock', val: 'pre', title: 'Код' },
    { icon: <Link className="w-4 h-4" />, cmd: 'createLink', prompt: true, title: 'Ссылка' },
  ];

  function handleToolClick(tool: any) {
    if (tool.prompt) {
      const url = window.prompt('URL:');
      if (url) execCommand(tool.cmd, url);
    } else {
      execCommand(tool.cmd, tool.val);
    }
  }

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: '${t.primary40}' }}>
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-2 flex-wrap border-b" style={{ borderColor: '${t.primary20}', background: '${t.primary10}' }}>
        {tools.map((tool, i) => {
          if ((tool as any).type === 'separator') {
            return <div key={i} className="w-px h-5 mx-1" style={{ background: '${t.primary20}' }} />;
          }
          return (
            <button
              key={i}
              onClick={() => handleToolClick(tool)}
              className="p-1.5 rounded-lg transition-all hover:opacity-70"
              style={{ color: '${t.text80}' }}
              title={(tool as any).title}
            >
              {(tool as any).icon}
            </button>
          );
        })}
      </div>

      {/* Editor area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={() => {
          if (onChange && editorRef.current) {
            onChange(editorRef.current.innerHTML);
          }
        }}
        className="px-4 py-3 outline-none prose prose-sm max-w-none"
        style={{
          minHeight,
          color: '${t.text}',
          background: '${t.bg}',
        }}
        dangerouslySetInnerHTML={value ? { __html: value } : undefined}
        data-placeholder={placeholder || 'Начните писать...'}
      />
    </div>
  );
}
`,
  };
}
