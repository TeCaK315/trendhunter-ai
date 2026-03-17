'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MessageSquare, Upload, FileText, X, Loader2 } from 'lucide-react';
import AiChatWidget from '@/components/AiChatWidget';

export default function ChatPage() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [contextText, setContextText] = useState('');
  const supabase = createClient();

  useEffect(() => {
    loadDocuments();
  }, []);

  async function loadDocuments() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('documents')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (data) {
      setDocuments(data);
      // Build context from all documents
      const ctx = data.map((d: any) => d.content).filter(Boolean).join('\n\n---\n\n');
      if (ctx) {
        setContextText(`Use the following knowledge base to answer questions. If the answer is not in the knowledge base, say so.\n\nKnowledge base:\n${ctx}`);
      }
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const text = await file.text();

      await supabase.from('documents').insert({
        user_id: user.id,
        name: file.name,
        content: text.substring(0, 50000), // Limit to 50K chars
        file_type: file.name.split('.').pop() || 'txt',
      });

      await loadDocuments();
    } catch (err) {
      console.error('Upload error:', err);
    } finally {
      setUploading(false);
    }
  }

  async function removeDocument(id: string) {
    await supabase.from('documents').delete().eq('id', id);
    await loadDocuments();
  }

  return (
    <div className="min-h-screen p-6 md:p-8" style={{ background: '#0f0f23' }}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <MessageSquare className="w-7 h-7" style={{ color: '#6366f1' }} />
          <h1 className="text-2xl font-heading font-bold" style={{ color: '#e2e8f0' }}>
            AI Чат
          </h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Documents sidebar */}
          <div className="lg:col-span-1">
            <div className="rounded-2xl border p-5" style={{ borderColor: '#6366f140' }}>
              <h2 className="font-semibold mb-4" style={{ color: '#e2e8f0' }}>
                База знаний
              </h2>
              <p className="text-sm mb-4" style={{ color: '#e2e8f070' }}>
                Загрузите документы (.txt, .md, .csv), и AI будет использовать их для ответов.
              </p>

              {/* Upload button */}
              <label
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium cursor-pointer transition-all hover:opacity-80 mb-4"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white' }}
              >
                {uploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                {uploading ? 'Загрузка...' : 'Загрузить документ'}
                <input
                  type="file"
                  accept=".txt,.md,.csv,.json"
                  className="hidden"
                  onChange={handleUpload}
                  disabled={uploading}
                />
              </label>

              {/* Document list */}
              <div className="space-y-2">
                {documents.length === 0 && (
                  <p className="text-sm py-4 text-center" style={{ color: '#e2e8f050' }}>
                    Нет загруженных документов
                  </p>
                )}
                {documents.map(doc => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-3 rounded-xl"
                    style={{ background: '#6366f110' }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 flex-shrink-0" style={{ color: '#6366f1' }} />
                      <span className="text-sm truncate" style={{ color: '#e2e8f0' }}>
                        {doc.name}
                      </span>
                    </div>
                    <button
                      onClick={() => removeDocument(doc.id)}
                      className="p-1 rounded hover:opacity-70 flex-shrink-0"
                      style={{ color: '#e2e8f070' }}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Chat area */}
          <div className="lg:col-span-2 h-[600px]">
            <AiChatWidget
              systemContext={contextText || undefined}
              placeholder="Задайте вопрос по базе знаний..."
            />
          </div>
        </div>
      </div>
    </div>
  );
}
