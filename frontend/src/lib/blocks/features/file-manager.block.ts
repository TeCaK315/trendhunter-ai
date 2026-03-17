import type { BlockContext, BlockResult } from '../types';
import { createDesignTokens } from '../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);

  return {
    'src/components/FileManager.tsx': `'use client';

import { useState, useRef } from 'react';
import { Upload, Folder, File, Image, FileText, Trash2, Download, Eye, X, Loader2, FolderPlus } from 'lucide-react';

interface FileItem {
  id: string;
  name: string;
  type: 'file' | 'folder';
  size?: number;
  url?: string;
  mimeType?: string;
  createdAt?: string;
  children?: FileItem[];
}

interface FileManagerProps {
  files: FileItem[];
  onUpload?: (file: File, path: string) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onCreateFolder?: (name: string, path: string) => Promise<void>;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function getFileIcon(mimeType?: string) {
  if (!mimeType) return File;
  if (mimeType.startsWith('image/')) return Image;
  return FileText;
}

export default function FileManager({ files, onUpload, onDelete, onCreateFolder }: FileManagerProps) {
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<FileItem | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function getCurrentFiles(): FileItem[] {
    let current = files;
    for (const folder of currentPath) {
      const found = current.find(f => f.name === folder && f.type === 'folder');
      if (found?.children) current = found.children;
      else break;
    }
    return current;
  }

  const currentFiles = getCurrentFiles();
  const folders = currentFiles.filter(f => f.type === 'folder');
  const regularFiles = currentFiles.filter(f => f.type === 'file');

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !onUpload) return;
    setUploading(true);
    try {
      await onUpload(file, currentPath.join('/'));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function handleCreateFolder() {
    if (!newFolderName.trim() || !onCreateFolder) return;
    await onCreateFolder(newFolderName.trim(), currentPath.join('/'));
    setNewFolderName('');
    setShowNewFolder(false);
  }

  return (
    <div className="space-y-4">
      {/* Breadcrumbs + actions */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-1 text-sm">
          <button onClick={() => setCurrentPath([])} className="font-medium hover:underline" style={{ color: '${t.primary}' }}>
            Файлы
          </button>
          {currentPath.map((p, i) => (
            <span key={i} className="flex items-center gap-1">
              <span style={{ color: '${t.text50}' }}>/</span>
              <button onClick={() => setCurrentPath(currentPath.slice(0, i + 1))}
                className="font-medium hover:underline" style={{ color: '${t.primary}' }}>
                {p}
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          {onCreateFolder && (
            <button onClick={() => setShowNewFolder(!showNewFolder)}
              className="px-3 py-2 rounded-xl border text-xs font-medium flex items-center gap-1"
              style={{ borderColor: '${t.primary40}', color: '${t.text70}' }}>
              <FolderPlus className="w-3.5 h-3.5" /> Папка
            </button>
          )}
          {onUpload && (
            <label className="px-3 py-2 rounded-xl text-white text-xs font-medium flex items-center gap-1 cursor-pointer"
              style={{ background: '${t.gradientPrimary}' }}>
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              Загрузить
              <input ref={inputRef} type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
            </label>
          )}
        </div>
      </div>

      {/* New folder input */}
      {showNewFolder && (
        <div className="flex gap-2">
          <input value={newFolderName} onChange={e => setNewFolderName(e.target.value)}
            placeholder="Название папки"
            className="flex-1 px-3 py-2 rounded-xl border text-sm"
            style={{ borderColor: '${t.primary40}', background: '${t.bg}', color: '${t.text}' }}
            onKeyDown={e => e.key === 'Enter' && handleCreateFolder()} />
          <button onClick={handleCreateFolder} className="px-4 py-2 rounded-xl text-white text-xs font-medium"
            style={{ background: '${t.primary}' }}>Создать</button>
          <button onClick={() => setShowNewFolder(false)} className="px-2 py-2 rounded-xl border"
            style={{ borderColor: '${t.primary40}', color: '${t.text50}' }}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* File list */}
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: '${t.primary40}' }}>
        {currentPath.length > 0 && (
          <button onClick={() => setCurrentPath(currentPath.slice(0, -1))}
            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:opacity-80 border-b"
            style={{ borderColor: '${t.primary40}' }}>
            <Folder className="w-5 h-5" style={{ color: '${t.text50}' }} />
            <span className="text-sm" style={{ color: '${t.text50}' }}>..</span>
          </button>
        )}

        {folders.map(folder => (
          <button key={folder.id}
            onClick={() => setCurrentPath([...currentPath, folder.name])}
            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:opacity-80 border-b"
            style={{ borderColor: '${t.primary40}' }}>
            <Folder className="w-5 h-5" style={{ color: '#eab308' }} />
            <span className="text-sm font-medium flex-1" style={{ color: '${t.text}' }}>{folder.name}</span>
            {folder.children && <span className="text-xs" style={{ color: '${t.text50}' }}>{folder.children.length} элем.</span>}
          </button>
        ))}

        {regularFiles.map(file => {
          const Icon = getFileIcon(file.mimeType);
          return (
            <div key={file.id} className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0"
              style={{ borderColor: '${t.primary40}' }}>
              <Icon className="w-5 h-5 flex-shrink-0" style={{ color: '${t.primary}' }} />
              <span className="text-sm flex-1 truncate" style={{ color: '${t.text}' }}>{file.name}</span>
              {file.size && <span className="text-xs" style={{ color: '${t.text50}' }}>{formatSize(file.size)}</span>}
              <div className="flex gap-1">
                {file.url && file.mimeType?.startsWith('image/') && (
                  <button onClick={() => setPreview(file)} className="p-1.5 rounded-lg hover:opacity-70" style={{ color: '${t.text50}' }}>
                    <Eye className="w-4 h-4" />
                  </button>
                )}
                {file.url && (
                  <a href={file.url} download className="p-1.5 rounded-lg hover:opacity-70" style={{ color: '${t.text50}' }}>
                    <Download className="w-4 h-4" />
                  </a>
                )}
                {onDelete && (
                  <button onClick={() => onDelete(file.id)} className="p-1.5 rounded-lg hover:opacity-70" style={{ color: '#ef4444' }}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {currentFiles.length === 0 && (
          <div className="py-12 text-center">
            <Folder className="w-10 h-10 mx-auto mb-2" style={{ color: '${t.text50}' }} />
            <p className="text-sm" style={{ color: '${t.text50}' }}>Папка пуста</p>
          </div>
        )}
      </div>

      {/* Image preview modal */}
      {preview && preview.url && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.8)' }}
          onClick={() => setPreview(null)}>
          <button className="absolute top-4 right-4 text-white p-2"><X className="w-6 h-6" /></button>
          <img src={preview.url} alt={preview.name} className="max-w-[90vw] max-h-[85vh] object-contain rounded-xl" />
        </div>
      )}
    </div>
  );
}
`,
  };
}
