import type { BlockContext, BlockResult } from '../types';
import { createDesignTokens } from '../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);

  return {
    'src/app/dashboard/api-keys/page.tsx': `'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Key, Plus, Copy, Check, Trash2, Eye, EyeOff, Loader2 } from 'lucide-react';

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  is_active: boolean;
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyFull, setNewKeyFull] = useState('');
  const [copied, setCopied] = useState('');
  const supabase = createClient();

  useEffect(() => { loadKeys(); }, []);

  async function loadKeys() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('api_keys')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    setKeys(data || []);
    setLoading(false);
  }

  async function createKey() {
    if (!newKeyName.trim()) return;
    setCreating(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Generate API key
    const fullKey = 'sk_' + crypto.randomUUID().replace(/-/g, '');
    const prefix = fullKey.substring(0, 12) + '...';

    await supabase.from('api_keys').insert({
      user_id: user.id,
      name: newKeyName.trim(),
      key_hash: fullKey, // In production, hash this
      key_prefix: prefix,
      is_active: true,
    });

    setNewKeyFull(fullKey);
    setNewKeyName('');
    await loadKeys();
    setCreating(false);
  }

  async function deleteKey(id: string) {
    await supabase.from('api_keys').delete().eq('id', id);
    setKeys(prev => prev.filter(k => k.id !== id));
  }

  async function copyKey(text: string, id: string) {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(''), 2000);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '${t.bg}' }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: '${t.primary}' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 md:p-8" style={{ background: '${t.bg}' }}>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Key className="w-7 h-7" style={{ color: '${t.primary}' }} />
          <h1 className="text-2xl font-heading font-bold" style={{ color: '${t.text}' }}>API Ключи</h1>
        </div>

        {/* New key revealed */}
        {newKeyFull && (
          <div className="rounded-2xl border p-4 mb-6" style={{ background: '#fef3c7', borderColor: '#f59e0b' }}>
            <p className="text-sm font-semibold mb-2" style={{ color: '#92400e' }}>
              Скопируйте ключ сейчас — он больше не будет показан!
            </p>
            <div className="flex gap-2">
              <code className="flex-1 px-3 py-2 rounded-lg text-sm font-mono" style={{ background: 'white', color: '#1e293b' }}>
                {newKeyFull}
              </code>
              <button
                onClick={() => { copyKey(newKeyFull, 'new'); setNewKeyFull(''); }}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white"
                style={{ background: '#f59e0b' }}
              >
                {copied === 'new' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}

        {/* Create new key */}
        <div className="rounded-2xl border p-5 mb-6" style={{ borderColor: '${t.primary40}' }}>
          <h2 className="font-semibold mb-3" style={{ color: '${t.text}' }}>Создать новый ключ</h2>
          <div className="flex gap-3">
            <input
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="Название (напр. Production)"
              className="flex-1 px-4 py-2 rounded-xl border text-sm"
              style={{ borderColor: '${t.primary40}', background: '${t.bg}', color: '${t.text}' }}
            />
            <button
              onClick={createKey}
              disabled={creating || !newKeyName.trim()}
              className="px-5 py-2 rounded-xl text-sm font-medium text-white flex items-center gap-2 disabled:opacity-50"
              style={{ background: '${t.gradientPrimary}' }}
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Создать
            </button>
          </div>
        </div>

        {/* Keys list */}
        <div className="space-y-3">
          {keys.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: '${t.text50}' }}>Нет API ключей</p>
          ) : (
            keys.map(key => (
              <div
                key={key.id}
                className="flex items-center justify-between p-4 rounded-xl border"
                style={{ borderColor: '${t.primary20}' }}
              >
                <div>
                  <p className="font-medium text-sm" style={{ color: '${t.text}' }}>{key.name}</p>
                  <p className="text-xs font-mono mt-1" style={{ color: '${t.text70}' }}>{key.key_prefix}</p>
                  <p className="text-xs mt-1" style={{ color: '${t.text50}' }}>
                    Создан: {new Date(key.created_at).toLocaleDateString()}
                    {key.last_used_at && \` | Использован: \${new Date(key.last_used_at).toLocaleDateString()}\`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => copyKey(key.key_prefix, key.id)}
                    className="p-2 rounded-lg hover:opacity-70"
                    style={{ color: '${t.text70}' }}
                  >
                    {copied === key.id ? <Check className="w-4 h-4" style={{ color: '#22c55e' }} /> : <Copy className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => deleteKey(key.id)}
                    className="p-2 rounded-lg hover:opacity-70"
                    style={{ color: '#ef4444' }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
`,
  };
}
