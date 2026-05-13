import type { BlockContext, BlockResult } from '../types';
import { createDesignTokens } from '../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);

  return {
    'src/components/FileUpload.tsx': `'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Upload, X, File, Image, Loader2 } from 'lucide-react';

interface FileUploadProps {
  // Callbacks (any of these names supported)
  onUpload?: (url: string, file: File) => void;
  onFileSelect?: (file: File) => void;
  onChange?: (file: File) => void;
  onFile?: (file: File) => void;
  // Accept / file types
  accept?: string;
  acceptedTypes?: string;
  fileTypes?: string;
  allowedTypes?: string[];
  // Size limits (any of these supported)
  maxSizeMB?: number;
  maxSize?: number;     // bytes
  maxFileSize?: number; // bytes
  // External state
  disabled?: boolean;
  loading?: boolean;
  isLoading?: boolean;
  isUploading?: boolean;
  // UI labels (accepted, currently informational)
  description?: string;
  label?: string;
  placeholder?: string;
  className?: string;
  // Storage hints
  bucket?: string;
  folder?: string;
  path?: string;
}

export default function FileUpload({
  onUpload,
  onFileSelect,
  onChange,
  onFile,
  accept,
  acceptedTypes,
  fileTypes,
  allowedTypes,
  maxSizeMB,
  maxSize,
  maxFileSize,
  disabled,
  loading,
  isLoading,
  isUploading,
  description: _description,
  label: _label,
  placeholder: _placeholder,
  className,
  bucket = 'uploads',
  folder: _folder,
  path: _path,
}: FileUploadProps) {
  const effectiveAccept =
    accept ?? acceptedTypes ?? fileTypes ?? (allowedTypes && allowedTypes.length > 0 ? allowedTypes.join(',') : undefined) ?? 'image/*,.pdf,.csv,.xlsx';
  const sizeBytes = maxSize ?? maxFileSize;
  const effectiveMaxMB = maxSizeMB ?? (sizeBytes ? Math.round(sizeBytes / (1024 * 1024)) : 10);
  const isDisabled = !!(disabled || loading || isLoading || isUploading);
  // Suppress unused-var warnings for accepted-but-informational props
  void _description; void _label; void _placeholder; void _folder; void _path;
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const processFile = async (file: File) => {
    setError(null);

    if (file.size > effectiveMaxMB * 1024 * 1024) {
      setError(\`File too large. Max size: \${effectiveMaxMB}MB\`);
      return;
    }
    if (isDisabled) return;

    // Notify gap-filler consumers (any of these names supported)
    onFileSelect?.(file);
    onChange?.(file);
    onFile?.(file);

    // Preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    }
    setFileName(file.name);

    // Upload
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('bucket', bucket);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Upload failed');
      }

      const data = await res.json();
      onUpload?.(data.url, file);
    } catch (err: any) {
      setError(err.message);
      setPreview(null);
      setFileName(null);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files?.[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      processFile(e.target.files[0]);
    }
  };

  const clearFile = () => {
    setPreview(null);
    setFileName(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className={\`w-full \${className ?? ''}\`}>
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={\`relative rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all \${
          dragActive ? 'scale-[1.02]' : ''
        }\`}
        style={{
          borderColor: dragActive ? '${t.primary}' : '${t.primary40}',
          background: dragActive ? '${t.primary10}' : 'transparent',
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={effectiveAccept}
          onChange={handleChange}
          className="hidden"
        />

        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-10 h-10 animate-spin" style={{ color: '${t.primary}' }} />
            <p className="text-sm" style={{ color: '${t.text70}' }}>Uploading...</p>
          </div>
        ) : preview ? (
          <div className="flex flex-col items-center gap-3">
            <img src={preview} alt="Preview" className="max-h-32 rounded-lg object-contain" />
            <p className="text-sm" style={{ color: '${t.text70}' }}>{fileName}</p>
            <button
              onClick={(e) => { e.stopPropagation(); clearFile(); }}
              className="flex items-center gap-1 text-sm px-3 py-1 rounded-lg transition-colors hover:bg-red-500/10"
              style={{ color: '#ef4444' }}
            >
              <X className="w-4 h-4" /> Remove
            </button>
          </div>
        ) : fileName ? (
          <div className="flex flex-col items-center gap-3">
            <File className="w-10 h-10" style={{ color: '${t.primary}' }} />
            <p className="text-sm" style={{ color: '${t.text70}' }}>{fileName}</p>
            <button
              onClick={(e) => { e.stopPropagation(); clearFile(); }}
              className="flex items-center gap-1 text-sm px-3 py-1 rounded-lg transition-colors hover:bg-red-500/10"
              style={{ color: '#ef4444' }}
            >
              <X className="w-4 h-4" /> Remove
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <Upload className="w-10 h-10" style={{ color: '${t.primary}' }} />
            <p className="font-semibold" style={{ color: '${t.text}' }}>
              Drop file here or click to upload
            </p>
            <p className="text-sm" style={{ color: '${t.text50}' }}>
              Max {effectiveMaxMB}MB
            </p>
          </div>
        )}
      </div>

      {error && (
        <p className="mt-2 text-sm text-red-400">{error}</p>
      )}
    </div>
  );
}
`,

    'src/app/api/upload/route.ts': `import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const bucket = (formData.get('bucket') as string) || 'uploads';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Max 10MB.' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Generate unique filename
    const ext = file.name.split('.').pop() || 'bin';
    const fileName = \`\${user.id}/\${Date.now()}-\${Math.random().toString(36).slice(2)}.\${ext}\`;

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      console.error('Storage upload error:', error);
      return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }

    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path);

    return NextResponse.json({
      url: urlData.publicUrl,
      path: data.path,
      fileName: file.name,
      size: file.size,
      type: file.type,
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
`,
  };
}
