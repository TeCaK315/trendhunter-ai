'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Upload, X, File, Image, Loader2 } from 'lucide-react';

interface FileUploadProps {
  onUpload?: (url: string, file: File) => void;
  accept?: string;
  maxSizeMB?: number;
  bucket?: string;
}

export default function FileUpload({
  onUpload,
  accept = 'image/*,.pdf,.csv,.xlsx',
  maxSizeMB = 10,
  bucket = 'uploads',
}: FileUploadProps) {
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

    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`File too large. Max size: ${maxSizeMB}MB`);
      return;
    }

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
    <div className="w-full">
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all ${
          dragActive ? 'scale-[1.02]' : ''
        }`}
        style={{
          borderColor: dragActive ? '#6366f1' : '#6366f140',
          background: dragActive ? '#6366f110' : 'transparent',
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleChange}
          className="hidden"
        />

        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-10 h-10 animate-spin" style={{ color: '#6366f1' }} />
            <p className="text-sm" style={{ color: '#e2e8f070' }}>Uploading...</p>
          </div>
        ) : preview ? (
          <div className="flex flex-col items-center gap-3">
            <img src={preview} alt="Preview" className="max-h-32 rounded-lg object-contain" />
            <p className="text-sm" style={{ color: '#e2e8f070' }}>{fileName}</p>
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
            <File className="w-10 h-10" style={{ color: '#6366f1' }} />
            <p className="text-sm" style={{ color: '#e2e8f070' }}>{fileName}</p>
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
            <Upload className="w-10 h-10" style={{ color: '#6366f1' }} />
            <p className="font-semibold" style={{ color: '#e2e8f0' }}>
              Drop file here or click to upload
            </p>
            <p className="text-sm" style={{ color: '#e2e8f050' }}>
              Max {maxSizeMB}MB
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
