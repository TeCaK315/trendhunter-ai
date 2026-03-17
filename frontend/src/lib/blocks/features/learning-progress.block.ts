import type { BlockContext, BlockResult } from '../types';
import { createDesignTokens } from '../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);

  return {
    'src/components/LearningProgress.tsx': `'use client';

import { useState } from 'react';
import { CheckCircle, Circle, Lock, Trophy, Star, ChevronDown, ChevronRight } from 'lucide-react';

interface Lesson {
  id: string;
  title: string;
  duration?: string;
  completed?: boolean;
  locked?: boolean;
}

interface Module {
  id: string;
  title: string;
  description?: string;
  lessons: Lesson[];
}

interface LearningProgressProps {
  modules: Module[];
  totalXP?: number;
  onLessonClick?: (moduleId: string, lessonId: string) => void;
}

export default function LearningProgress({ modules, totalXP = 0, onLessonClick }: LearningProgressProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    if (modules.length > 0) init[modules[0].id] = true;
    return init;
  });

  const totalLessons = modules.reduce((sum, m) => sum + m.lessons.length, 0);
  const completedLessons = modules.reduce((sum, m) => sum + m.lessons.filter(l => l.completed).length, 0);
  const overallPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  function toggleModule(id: string) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  }

  function getModuleProgress(m: Module) {
    const done = m.lessons.filter(l => l.completed).length;
    return m.lessons.length > 0 ? Math.round((done / m.lessons.length) * 100) : 0;
  }

  return (
    <div className="space-y-6">
      {/* Overall stats */}
      <div className="rounded-2xl border p-5" style={{ borderColor: '${t.primary40}' }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-lg font-bold" style={{ color: '${t.text}' }}>Прогресс обучения</h3>
            <p className="text-sm" style={{ color: '${t.text70}' }}>{completedLessons} из {totalLessons} уроков</p>
          </div>
          <div className="flex items-center gap-4">
            {totalXP > 0 && (
              <div className="flex items-center gap-1">
                <Star className="w-5 h-5" style={{ color: '#eab308' }} />
                <span className="text-sm font-bold" style={{ color: '${t.text}' }}>{totalXP} XP</span>
              </div>
            )}
            <div className="relative w-16 h-16">
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="${t.primary20}" strokeWidth="3" />
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="${t.primary}" strokeWidth="3"
                  strokeDasharray={15.5 * 2 * Math.PI + ''}
                  strokeDashoffset={(15.5 * 2 * Math.PI * (1 - overallPercent / 100)) + ''}
                  strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-bold" style={{ color: '${t.primary}' }}>{overallPercent}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: '${t.primary10}' }}>
          <div className="h-full rounded-full transition-all duration-500" style={{ width: overallPercent + '%', background: '${t.gradientPrimary}' }} />
        </div>
      </div>

      {overallPercent === 100 && (
        <div className="rounded-2xl border p-5 text-center" style={{ borderColor: '#eab308', background: '#fefce8' }}>
          <Trophy className="w-10 h-10 mx-auto mb-2" style={{ color: '#eab308' }} />
          <p className="text-lg font-bold" style={{ color: '#854d0e' }}>Курс завершён!</p>
          <p className="text-sm" style={{ color: '#a16207' }}>Поздравляем с прохождением всех модулей</p>
        </div>
      )}

      {/* Module list */}
      <div className="space-y-3">
        {modules.map((mod, mi) => {
          const modPercent = getModuleProgress(mod);
          const isOpen = expanded[mod.id] || false;
          const allDone = modPercent === 100;

          return (
            <div key={mod.id} className="rounded-xl border overflow-hidden" style={{ borderColor: allDone ? '#22c55e' : '${t.primary40}' }}>
              <button
                onClick={() => toggleModule(mod.id)}
                className="w-full flex items-center gap-3 p-4 text-left hover:opacity-90 transition-all"
                style={{ background: allDone ? '#f0fdf4' : 'transparent' }}
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ background: allDone ? '#22c55e' : '${t.primary10}', color: allDone ? '#fff' : '${t.primary}' }}>
                  {allDone ? <CheckCircle className="w-4 h-4" /> : mi + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: '${t.text}' }}>{mod.title}</p>
                  {mod.description && <p className="text-xs truncate" style={{ color: '${t.text50}' }}>{mod.description}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium" style={{ color: allDone ? '#22c55e' : '${t.text50}' }}>{modPercent}%</span>
                  {isOpen ? <ChevronDown className="w-4 h-4" style={{ color: '${t.text50}' }} /> : <ChevronRight className="w-4 h-4" style={{ color: '${t.text50}' }} />}
                </div>
              </button>

              {isOpen && (
                <div className="border-t px-4 pb-3" style={{ borderColor: '${t.primary40}' }}>
                  {mod.lessons.map((lesson, li) => (
                    <button
                      key={lesson.id}
                      onClick={() => !lesson.locked && onLessonClick?.(mod.id, lesson.id)}
                      disabled={lesson.locked}
                      className="w-full flex items-center gap-3 py-2.5 text-left disabled:opacity-40"
                    >
                      {lesson.completed ? (
                        <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: '#22c55e' }} />
                      ) : lesson.locked ? (
                        <Lock className="w-4 h-4 flex-shrink-0" style={{ color: '${t.text50}' }} />
                      ) : (
                        <Circle className="w-4 h-4 flex-shrink-0" style={{ color: '${t.text50}' }} />
                      )}
                      <span className="flex-1 text-sm" style={{ color: lesson.completed ? '${t.text50}' : '${t.text}' }}>
                        {lesson.title}
                      </span>
                      {lesson.duration && (
                        <span className="text-xs" style={{ color: '${t.text50}' }}>{lesson.duration}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
`,
  };
}
