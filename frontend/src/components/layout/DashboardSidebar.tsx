'use client';

import React from 'react';

type FlowStep = 'overview' | 'evidence' | 'action-plan' | 'monitoring' | 'research' | 'business' | 'project';
type EvidenceSubTab = 'analysis' | 'problem' | 'demand' | 'sellability' | 'occupation' | 'economics' | 'tech';
type ActionPlanSubTab = 'plan' | 'calculator' | 'scenarios' | 'survey' | 'gtm' | 'report' | 'differentiation';
type BusinessSubTab = 'venture' | 'leads';

interface DashboardSidebarProps {
  currentStep: FlowStep;
  setCurrentStep: (step: FlowStep) => void;
  evidenceSubTab: EvidenceSubTab;
  setEvidenceSubTab: (tab: EvidenceSubTab) => void;
  actionPlanSubTab: ActionPlanSubTab;
  setActionPlanSubTab: (tab: ActionPlanSubTab) => void;
  businessSubTab: BusinessSubTab;
  setBusinessSubTab: (tab: BusinessSubTab) => void;
  getStepStatus: (stepId: string) => 'completed' | 'active' | 'pending';
  evidenceProgress: { done: number; total: number; percent: number; loading: boolean };
  evidenceData: Record<string, unknown>;
  evidenceLoading: Record<string, boolean>;
  evidenceErrors: Record<string, string | null>;
  analysis: unknown;
  language: 'ru' | 'en';
  collapsed: boolean;
  onToggleCollapse: () => void;
}

interface NavSection {
  id: FlowStep;
  label: string;
  icon: string;
  subItems?: Array<{ id: string; label: string; icon: string; statusKey?: string }>;
}

export default function DashboardSidebar({
  currentStep,
  setCurrentStep,
  evidenceSubTab,
  setEvidenceSubTab,
  actionPlanSubTab,
  setActionPlanSubTab,
  businessSubTab,
  setBusinessSubTab,
  getStepStatus,
  evidenceProgress,
  evidenceData,
  evidenceLoading,
  evidenceErrors,
  analysis,
  language,
  collapsed,
  onToggleCollapse,
}: DashboardSidebarProps) {
  const sections: NavSection[] = [
    {
      id: 'overview',
      label: language === 'ru' ? 'Обзор' : 'Overview',
      icon: '📊',
    },
    {
      id: 'evidence',
      label: language === 'ru' ? 'Исследование' : 'Research',
      icon: '🔎',
      subItems: [
        { id: 'problem', label: language === 'ru' ? 'Проблема' : 'Problem', icon: '🎯', statusKey: 'problem' },
        { id: 'demand', label: language === 'ru' ? 'Спрос' : 'Demand', icon: '📈', statusKey: 'demand' },
        { id: 'sellability', label: language === 'ru' ? 'Продаваемость' : 'Sellability', icon: '💳', statusKey: 'sellability' },
        { id: 'occupation', label: language === 'ru' ? 'Конкуренция' : 'Competition', icon: '🏟️', statusKey: 'occupation' },
        { id: 'economics', label: language === 'ru' ? 'Экономика' : 'Economics', icon: '📊', statusKey: 'economics' },
        { id: 'tech', label: language === 'ru' ? 'Слепые пятна' : 'Blind Spots', icon: '🔍', statusKey: 'tech' },
        { id: 'analysis', label: language === 'ru' ? 'AI Синтез' : 'AI Synthesis', icon: '🧠' },
      ],
    },
    {
      id: 'action-plan',
      label: language === 'ru' ? 'Стратегия' : 'Strategy',
      icon: '📋',
      subItems: [
        { id: 'plan', label: language === 'ru' ? 'План' : 'Plan', icon: '📋' },
        { id: 'differentiation', label: language === 'ru' ? 'Дифференциация' : 'Differentiation', icon: '🎯' },
        { id: 'calculator', label: language === 'ru' ? 'Калькулятор' : 'Calculator', icon: '🧮' },
        { id: 'scenarios', label: language === 'ru' ? 'Сценарии' : 'Scenarios', icon: '🔀' },
        { id: 'survey', label: language === 'ru' ? 'Опрос' : 'Survey', icon: '📝' },
        { id: 'gtm', label: 'GTM', icon: '🚀' },
        { id: 'report', label: language === 'ru' ? 'Отчёт' : 'Report', icon: '📄' },
      ],
    },
    {
      id: 'monitoring',
      label: language === 'ru' ? 'Мониторинг' : 'Monitoring',
      icon: '📡',
    },
    {
      id: 'business',
      label: language === 'ru' ? 'Бизнес' : 'Business',
      icon: '💼',
      subItems: [
        { id: 'venture', label: language === 'ru' ? 'Инвестиции' : 'Venture', icon: '💰' },
        { id: 'leads', label: language === 'ru' ? 'Клиенты' : 'Leads', icon: '👥' },
      ],
    },
    {
      id: 'project',
      label: language === 'ru' ? 'Проект' : 'Project',
      icon: '🚀',
    },
  ];

  const handleSectionClick = (section: NavSection) => {
    const isClickable = section.id === 'overview' ||
      section.id === 'evidence' ||
      section.id === 'action-plan' ||
      section.id === 'business' ||
      section.id === 'monitoring' ||
      (section.id === 'project' && !!analysis);
    if (!isClickable) return;
    setCurrentStep(section.id);
  };

  const handleSubItemClick = (sectionId: FlowStep, subId: string) => {
    if (currentStep !== sectionId) {
      setCurrentStep(sectionId);
    }
    if (sectionId === 'evidence') {
      setEvidenceSubTab(subId as EvidenceSubTab);
    } else if (sectionId === 'action-plan') {
      setActionPlanSubTab(subId as ActionPlanSubTab);
    } else if (sectionId === 'business') {
      setBusinessSubTab(subId as BusinessSubTab);
    }
  };

  const getActiveSubId = (sectionId: FlowStep): string | null => {
    if (currentStep !== sectionId) return null;
    if (sectionId === 'evidence') return evidenceSubTab;
    if (sectionId === 'action-plan') return actionPlanSubTab;
    if (sectionId === 'business') return businessSubTab;
    return null;
  };

  const getSubItemStatus = (statusKey?: string): 'loaded' | 'loading' | 'error' | null => {
    if (!statusKey) return null;
    if (evidenceLoading[statusKey]) return 'loading';
    if (evidenceData[statusKey]) return 'loaded';
    if (evidenceErrors[statusKey]) return 'error';
    return null;
  };

  return (
    <div
      className={`flex-shrink-0 border-r border-zinc-800/50 bg-zinc-950/50 transition-all duration-300 hidden lg:block ${
        collapsed ? 'w-[56px]' : 'w-[220px]'
      }`}
    >
      <div className="sticky top-0 h-screen overflow-y-auto py-3 flex flex-col">
        {/* Evidence progress */}
        {!collapsed && currentStep === 'evidence' && (
          <div className="px-3 mb-3">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full transition-all duration-500"
                  style={{ width: `${evidenceProgress.percent}%` }}
                />
              </div>
              <span className="text-[10px] text-zinc-500 whitespace-nowrap">
                {evidenceProgress.done}/{evidenceProgress.total}
              </span>
            </div>
          </div>
        )}

        {/* Sections */}
        <nav className="flex-1 px-2 space-y-0.5">
          {sections.map((section) => {
            const isActive = currentStep === section.id;
            const status = getStepStatus(section.id);
            const isClickable = section.id === 'overview' ||
              section.id === 'evidence' ||
              section.id === 'action-plan' ||
              section.id === 'business' ||
              section.id === 'monitoring' ||
              (section.id === 'project' && !!analysis);
            const activeSubId = getActiveSubId(section.id);

            return (
              <div key={section.id}>
                {/* Main section button */}
                <button
                  onClick={() => handleSectionClick(section)}
                  disabled={!isClickable}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-all text-left relative group ${
                    isActive
                      ? 'bg-indigo-600/15 text-white'
                      : status === 'completed'
                      ? 'text-zinc-300 hover:bg-zinc-800/50'
                      : isClickable
                      ? 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                      : 'text-zinc-600 cursor-not-allowed'
                  }`}
                  title={collapsed ? section.label : undefined}
                >
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-indigo-500 rounded-r-full" />
                  )}
                  <span className="text-base flex-shrink-0">{section.icon}</span>
                  {!collapsed && (
                    <>
                      <span className="text-sm font-medium truncate flex-1">{section.label}</span>
                      {status === 'completed' && !isActive && (
                        <span className="text-green-400 text-xs">✓</span>
                      )}
                    </>
                  )}
                </button>

                {/* Sub-items (only when section is active and not collapsed) */}
                {isActive && section.subItems && !collapsed && (
                  <div className="ml-4 mt-0.5 mb-1 space-y-0.5 border-l border-zinc-800 pl-2">
                    {section.subItems.map((sub) => {
                      const isSubActive = activeSubId === sub.id;
                      const subStatus = getSubItemStatus(sub.statusKey);

                      return (
                        <button
                          key={sub.id}
                          onClick={() => handleSubItemClick(section.id, sub.id)}
                          className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md transition-all text-left text-xs ${
                            isSubActive
                              ? 'bg-indigo-500/15 text-indigo-300'
                              : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/40'
                          }`}
                        >
                          <span className="text-sm flex-shrink-0">{sub.icon}</span>
                          <span className="truncate flex-1">{sub.label}</span>
                          {subStatus === 'loading' && (
                            <span className="w-2.5 h-2.5 border border-green-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                          )}
                          {subStatus === 'loaded' && (
                            <span className="w-1.5 h-1.5 bg-green-400 rounded-full flex-shrink-0" />
                          )}
                          {subStatus === 'error' && (
                            <span className="w-1.5 h-1.5 bg-red-400 rounded-full flex-shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Collapse toggle */}
        <div className="px-2 pt-2 border-t border-zinc-800/50 mt-2">
          <button
            onClick={onToggleCollapse}
            className="w-full flex items-center justify-center gap-2 px-2 py-2 text-zinc-500 hover:text-white hover:bg-zinc-800/50 rounded-lg transition-all text-xs"
          >
            <svg
              className={`w-4 h-4 transition-transform ${collapsed ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
            {!collapsed && <span>{language === 'ru' ? 'Свернуть' : 'Collapse'}</span>}
          </button>
        </div>
      </div>
    </div>
  );
}
