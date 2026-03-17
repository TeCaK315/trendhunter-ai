import type { BlockContext, BlockResult } from '../types';
import { createDesignTokens } from '../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);

  return {
    'src/components/UserProfile.tsx': `'use client';

import { useState } from 'react';
import { Camera, MapPin, Link as LinkIcon, Calendar, Mail, Edit2, Save, X } from 'lucide-react';

interface UserStats {
  label: string;
  value: string | number;
}

interface UserProfileProps {
  name: string;
  email?: string;
  avatar?: string;
  bio?: string;
  location?: string;
  website?: string;
  joinDate?: string;
  stats?: UserStats[];
  recentActivity?: { text: string; date: string }[];
  editable?: boolean;
  onSave?: (data: { name: string; bio: string; location: string; website: string }) => void;
}

export default function UserProfile({
  name,
  email,
  avatar,
  bio = '',
  location = '',
  website = '',
  joinDate,
  stats = [],
  recentActivity = [],
  editable = false,
  onSave,
}: UserProfileProps) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(name);
  const [editBio, setEditBio] = useState(bio);
  const [editLocation, setEditLocation] = useState(location);
  const [editWebsite, setEditWebsite] = useState(website);

  function handleSave() {
    onSave?.({ name: editName, bio: editBio, location: editLocation, website: editWebsite });
    setEditing(false);
  }

  function cancel() {
    setEditName(name);
    setEditBio(bio);
    setEditLocation(location);
    setEditWebsite(website);
    setEditing(false);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border overflow-hidden" style={{ borderColor: '${t.primary40}' }}>
        {/* Cover */}
        <div className="h-32 relative" style={{ background: '${t.gradientPrimary}' }}>
          {editable && !editing && (
            <button onClick={() => setEditing(true)}
              className="absolute top-3 right-3 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 bg-white/90"
              style={{ color: '${t.text}' }}>
              <Edit2 className="w-3.5 h-3.5" /> Редактировать
            </button>
          )}
        </div>

        {/* Profile info */}
        <div className="px-6 pb-6 -mt-12">
          <div className="flex items-end gap-4">
            <div className="relative">
              {avatar ? (
                <img src={avatar} alt={name} className="w-24 h-24 rounded-full border-4 object-cover" style={{ borderColor: '${t.bg}' }} />
              ) : (
                <div className="w-24 h-24 rounded-full border-4 flex items-center justify-center text-3xl font-bold text-white"
                  style={{ borderColor: '${t.bg}', background: '${t.primary}' }}>
                  {name.charAt(0)}
                </div>
              )}
              {editing && (
                <button className="absolute bottom-0 right-0 w-8 h-8 rounded-full flex items-center justify-center text-white"
                  style={{ background: '${t.primary}' }}>
                  <Camera className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="flex-1 min-w-0 pb-1">
              {editing ? (
                <input value={editName} onChange={e => setEditName(e.target.value)}
                  className="text-xl font-bold px-2 py-1 rounded-lg border w-full"
                  style={{ borderColor: '${t.primary40}', color: '${t.text}' }} />
              ) : (
                <h2 className="text-xl font-bold" style={{ color: '${t.text}' }}>{name}</h2>
              )}
              {email && <p className="text-sm flex items-center gap-1" style={{ color: '${t.text50}' }}><Mail className="w-3.5 h-3.5" />{email}</p>}
            </div>
          </div>

          {/* Bio */}
          <div className="mt-4">
            {editing ? (
              <textarea value={editBio} onChange={e => setEditBio(e.target.value)}
                placeholder="О себе..."
                rows={3}
                className="w-full px-3 py-2 rounded-xl border text-sm resize-none"
                style={{ borderColor: '${t.primary40}', color: '${t.text}' }} />
            ) : bio ? (
              <p className="text-sm" style={{ color: '${t.text70}' }}>{bio}</p>
            ) : null}
          </div>

          {/* Meta */}
          <div className="flex flex-wrap gap-4 mt-3">
            {editing ? (
              <>
                <input value={editLocation} onChange={e => setEditLocation(e.target.value)}
                  placeholder="Город" className="px-3 py-1.5 rounded-lg border text-xs"
                  style={{ borderColor: '${t.primary40}', color: '${t.text}' }} />
                <input value={editWebsite} onChange={e => setEditWebsite(e.target.value)}
                  placeholder="Сайт" className="px-3 py-1.5 rounded-lg border text-xs"
                  style={{ borderColor: '${t.primary40}', color: '${t.text}' }} />
              </>
            ) : (
              <>
                {location && <span className="text-xs flex items-center gap-1" style={{ color: '${t.text50}' }}><MapPin className="w-3.5 h-3.5" />{location}</span>}
                {website && <a href={website} target="_blank" rel="noopener noreferrer" className="text-xs flex items-center gap-1 hover:underline" style={{ color: '${t.primary}' }}><LinkIcon className="w-3.5 h-3.5" />{website}</a>}
                {joinDate && <span className="text-xs flex items-center gap-1" style={{ color: '${t.text50}' }}><Calendar className="w-3.5 h-3.5" />С {joinDate}</span>}
              </>
            )}
          </div>

          {/* Edit actions */}
          {editing && (
            <div className="flex gap-2 mt-4">
              <button onClick={handleSave}
                className="px-4 py-2 rounded-xl text-white text-sm font-medium flex items-center gap-1"
                style={{ background: '${t.primary}' }}>
                <Save className="w-4 h-4" /> Сохранить
              </button>
              <button onClick={cancel}
                className="px-4 py-2 rounded-xl border text-sm flex items-center gap-1"
                style={{ borderColor: '${t.primary40}', color: '${t.text70}' }}>
                <X className="w-4 h-4" /> Отмена
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      {stats.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stats.map((stat, i) => (
            <div key={i} className="rounded-xl border p-4 text-center" style={{ borderColor: '${t.primary40}' }}>
              <p className="text-xl font-bold" style={{ color: '${t.text}' }}>{stat.value}</p>
              <p className="text-xs" style={{ color: '${t.text50}' }}>{stat.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Recent activity */}
      {recentActivity.length > 0 && (
        <div className="rounded-xl border p-4" style={{ borderColor: '${t.primary40}' }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: '${t.text}' }}>Последняя активность</h3>
          <div className="space-y-2">
            {recentActivity.map((item, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b last:border-b-0" style={{ borderColor: '${t.primary40}' }}>
                <span className="text-sm" style={{ color: '${t.text70}' }}>{item.text}</span>
                <span className="text-xs flex-shrink-0 ml-4" style={{ color: '${t.text50}' }}>{item.date}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
`,
  };
}
