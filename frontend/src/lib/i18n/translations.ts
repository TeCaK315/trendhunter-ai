export type Language = 'ru' | 'en';

export interface Translations {
  // Navigation
  nav: {
    home: string;
    nicheResearch: string;
    favorites: string;
    projects: string;
    collapse: string;
  };

  // Home page
  home: {
    searchPlaceholder: string;
    updated: string;
    generating: string;
    newIdeas: string;
    refreshing: string;
    refresh: string;
    liveData: string;
    updatesEvery6Hours: string;
    heroTitle1: string;
    heroTitle2: string;
    heroTitle3: string;
    heroDescription: string;
    ideas: string;
    avgRating: string;
    categories: string;
    allNiches: string;
    found: string;
    ideasIn: string;
    category: string;
    showMore: string;
    moreIdeas: string;
    hide: string;
    nothingFound: string;
    tryChangingSearch: string;
    noTrendsInCategory: string;
    resetSearch: string;
    dataUpdatesAuto: string;
    connectionError: string;
    useNicheResearch: string;
  };

  // Trend card
  trendCard: {
    opportunity: string;
    pain: string;
    feasibility: string;
    profit: string;
    excellent: string;
    good: string;
    average: string;
    low: string;
    justNow: string;
    minAgo: string;
    hoursAgo: string;
    daysAgo: string;
    details: string;
    createProject: string;
    projectCreated: string;
    addToFavorites: string;
    removeFromFavorites: string;
    overallRating: string;
    potential: string;
    basedOnMetrics: string;
    whyTrending: string;
    detailedMetrics: string;
    detected: string;
    openDetails: string;
  };

  // Trend detail page
  trendDetail: {
    // Tabs
    tabs: {
      overview: string;
      analysis: string;
      sources: string;
      competition: string;
      venture: string;
      leads: string;
      pitchDeck: string;
      project: string;
    };
    // Breadcrumbs
    breadcrumbs: {
      home: string;
      trends: string;
    };
    // Not found
    notFound: string;
    backToHome: string;
    // Overview section
    overview: {
      growth: string;
      overallScore: string;
      opportunity: string;
      painLevel: string;
      feasibility: string;
      potential: string;
      information: string;
      source: string;
      detected: string;
      status: string;
      nextStep: string;
      runAnalysisDescription: string;
      analyzing: string;
      runAnalysis: string;
    };
    // Analysis section
    analysis: {
      deepAnalysis: string;
      consensusReached: string;
      aiDebate: string;
      aiDebateDescription: string;
      optimist: string;
      optimistRole: string;
      optimistConclusion: string;
      skeptic: string;
      skepticRole: string;
      skepticConclusion: string;
      willingnessToPay: string;
      arbiterVerdict: string;
      arbiterRole: string;
      confidence: string;
      mainPain: string;
      keyPainPoints: string;
      targetAudience: string;
      size: string;
      whereToFind: string;
      nextStep: string;
      collectSourcesDescription: string;
      collectingData: string;
      collectSources: string;
    };
    // Sources section
    sources: {
      simulation: string;
      openInGoogleTrends: string;
      yearlyGrowth: string;
      relatedQueries: string;
      dataSources: string;
    };
    // Competition section
    competition: {
      analyzeCompetitors: string;
      analyzingCompetitors: string;
      marketSaturation: string;
      riskLevel: string;
      blueOceanHint: string;
      low: string;
      medium: string;
      high: string;
      competitors: string;
      opportunityAreas: string;
      nextStep: string;
      ventureDescription: string;
      loadError: string;
    };
    // Venture section
    venture: {
      ventureData: string;
      collectingData: string;
      yearlyInvestments: string;
      averageRound: string;
      fundingTrend: string;
      growing: string;
      stable: string;
      declining: string;
      investmentAttractiveness: string;
      recentRounds: string;
      activeFunds: string;
      website: string;
      marketSignals: string;
      nextStep: string;
      findLeadsDescription: string;
      dateUnknown: string;
    };
    // Leads section
    leads: {
      title: string;
      searchingClients: string;
      foundCompanies: string;
      interestedInSolving: string;
      companies: string;
      relevance: string;
      website: string;
      email: string;
      linkedin: string;
      decisionMakers: string;
      linkedinQueries: string;
      directories: string;
      searchTips: string;
      nextStep: string;
      generatePitchDescription: string;
      createPitchDeck: string;
    };
    // Pitch section
    pitch: {
      generating: string;
      slide: string;
      speakerNotes: string;
      visualRecommendation: string;
      back: string;
      next: string;
      exportPresentation: string;
      copyText: string;
      copyTextDescription: string;
      downloadJson: string;
      downloadJsonDescription: string;
      selectTemplate: string;
      openTemplates: string;
      viaTextFast: string;
      viaTextStep1: string;
      viaTextStep2: string;
      viaTextStep3: string;
      viaTextStep4: string;
      viaJsonAuto: string;
      viaJsonStep1: string;
      viaJsonStep2: string;
      viaJsonStep3: string;
      viaJsonStep4: string;
      nextStep: string;
      createProjectDescription: string;
    };
    // Project section
    project: {
      generating: string;
      problemStatement: string;
      solutionOverview: string;
      coreFeatures: string;
      techStack: string;
      architecture: string;
      complexity: string;
      roadmap: string;
      goals: string;
      deliverables: string;
      successMetrics: string;
      createProject: string;
      createWithGithub: string;
      selectMvpType: string;
    };
    // Common
    low: string;
    medium: string;
    high: string;
    growing: string;
    stable: string;
    declining: string;
  };

  // Niche research
  nicheResearch: {
    title: string;
    subtitle: string;
    inputPlaceholder: string;
    analyze: string;
    analyzing: string;
    examples: string;
    results: string;
    painPoints: string;
    targetAudience: string;
    competitors: string;
    investments: string;
    sources: string;
    noData: string;
    error: string;
    // Extended translations
    describeNiche: string;
    nicheName: string;
    nicheNamePlaceholder: string;
    targetAudienceLabel: string;
    targetAudiencePlaceholder: string;
    problemDescription: string;
    problemDescriptionPlaceholder: string;
    keywords: string;
    keywordsPlaceholder: string;
    runDeepAnalysis: string;
    analysisIncludes: string;
    collectingData: string;
    expertAnalysis: string;
    dataCollection: string;
    backToTrends: string;
    inFavorites: string;
    savedToFavorites: string;
    analysisComplete: string;
    confidenceScore: string;
    // Tabs
    tabResearch: string;
    tabBusiness: string;
    tabSolutions: string;
    // Results sections
    collectedData: string;
    postsFound: string;
    videosFound: string;
    yearlyGrowth: string;
    aiSynthesis: string;
    optimist: string;
    skeptic: string;
    validatedPainPoints: string;
    forArguments: string;
    againstArguments: string;
    confidence: string;
    primaryAudience: string;
    segmentSize: string;
    whereToFind: string;
    willingnessToPay: string;
    high: string;
    medium: string;
    low: string;
    risks: string;
    opportunities: string;
    potentialRevenue: string;
    timeToMarket: string;
    arbiterRecommendation: string;
    recommendedSolutions: string;
    mvpFeatures: string;
    monetization: string;
    generateProductSpec: string;
    generatingProductSpec: string;
    analysisMetadata: string;
    analysisDepth: string;
    consensusReached: string;
    yes: string;
    partial: string;
    usedSources: string;
    openInFavorites: string;
    newResearch: string;
    fillNicheAndDescription: string;
    productSpecError: string;
    connectionError: string;
    tryAgain: string;
    productSpecHint: string;
  };

  // Favorites
  favorites: {
    title: string;
    empty: string;
    emptyDescription: string;
    goToHome: string;
    ideasCount: string;
    analyzed: string;
    addIdeas: string;
    loadingFavorites: string;
    selectFromLeft: string;
    removeFromFavorites: string;
    deepAnalysis: string;
    analyzing3Agents: string;
    reanalyze: string;
    analyze: string;
    downloadReport: string;
    whyTrending: string;
    analyzedOn: string;
    deepAnalysisLabel: string;
    optimistSkepticArbiter: string;
    confidenceLabel: string;
    consensus: string;
    mainPain: string;
    keyProblems: string;
    keyProblemsWithArgs: string;
    verdict: string;
    argumentsFor: string;
    argumentsAgainst: string;
    targetAudience: string;
    segmentSize: string;
    willingnessHigh: string;
    willingnessMedium: string;
    willingnessLow: string;
    whereToFind: string;
    risks: string;
    opportunities: string;
    finalRecommendation: string;
    agentPositions: string;
    optimist: string;
    skeptic: string;
    realDataSources: string;
    engagement: string;
    videos: string;
    noData: string;
    requiresFacebookApi: string;
    goToProject: string;
  };

  // Projects
  projects: {
    title: string;
    empty: string;
    emptyDescription: string;
    createFirst: string;
    status: {
      planning: string;
      inProgress: string;
      completed: string;
    };
  };

  // Onboarding
  onboarding: {
    skip: string;
    back: string;
    next: string;
    done: string;
    stepOf: string;
    steps: {
      home: {
        title: string;
        content: string;
      };
      research: {
        title: string;
        content: string;
      };
      favorites: {
        title: string;
        content: string;
      };
      projects: {
        title: string;
        content: string;
      };
      generate: {
        title: string;
        content: string;
      };
      trendCard: {
        title: string;
        content: string;
      };
    };
  };

  // Help button
  help: {
    title: string;
    showTour: string;
    tourDescription: string;
    documentation: string;
    githubRepo: string;
    version: string;
  };

  // Common
  common: {
    loading: string;
    error: string;
    retry: string;
    save: string;
    cancel: string;
    close: string;
    search: string;
    filter: string;
    sort: string;
    language: string;
  };

  // Sorting
  sort: {
    overallScore: string;
    byDate: string;
    opportunity: string;
    pain: string;
    feasibility: string;
    profit: string;
    highToLow: string;
    lowToHigh: string;
  };

  // Categories
  categories: {
    all: string;
    technology: string;
    saas: string;
    ecommerce: string;
    mobileApps: string;
    edtech: string;
    healthtech: string;
    aiml: string;
    fintech: string;
  };

  // Errors
  errors: {
    apiKeyNotConfigured: string;
    noDataFound: string;
    networkError: string;
    serverError: string;
  };
}

export const translations: Record<Language, Translations> = {
  ru: {
    nav: {
      home: 'Поток идей',
      nicheResearch: 'Исследование ниши',
      favorites: 'Избранное',
      projects: 'Проекты',
      collapse: 'Свернуть',
    },
    home: {
      searchPlaceholder: 'Поиск идей...',
      updated: 'Обновлено',
      generating: 'Генерация...',
      newIdeas: 'Новые идеи',
      refreshing: 'Обновление...',
      refresh: 'Обновить',
      liveData: 'Live данные',
      updatesEvery6Hours: 'Обновляется каждые 6 часов',
      heroTitle1: 'Найди свою',
      heroTitle2: 'идею',
      heroTitle3: 'для следующего проекта',
      heroDescription: 'AI анализирует тренды из Reddit, Google Trends, YouTube и других источников, чтобы найти перспективные ниши с высоким потенциалом.',
      ideas: 'Идей',
      avgRating: 'Ср. рейтинг',
      categories: 'Категорий',
      allNiches: 'Все ниши',
      found: 'Найдено',
      ideasIn: 'идей в категории',
      category: 'категории',
      showMore: 'Показать ещё',
      moreIdeas: 'идей',
      hide: 'Скрыть',
      nothingFound: 'Ничего не найдено',
      tryChangingSearch: 'Попробуйте изменить поисковый запрос',
      noTrendsInCategory: 'Нет трендов в этой категории. Запустите Trend Analyzer в n8n чтобы получить свежие данные',
      resetSearch: 'Сбросить поиск',
      dataUpdatesAuto: 'Данные обновляются автоматически каждые 6 часов через n8n',
      connectionError: 'Ошибка соединения',
      useNicheResearch: 'Используйте "Исследование ниш" для ручного анализа',
    },
    trendCard: {
      opportunity: 'Возможность',
      pain: 'Боль',
      feasibility: 'Выполнимость',
      profit: 'Выгода',
      excellent: 'Отлично',
      good: 'Хорошо',
      average: 'Средне',
      low: 'Низкий',
      justNow: 'Только что',
      minAgo: 'мин назад',
      hoursAgo: 'ч назад',
      daysAgo: 'д назад',
      details: 'Подробнее',
      createProject: 'Создать проект',
      projectCreated: 'Проект создан',
      addToFavorites: 'В избранное',
      removeFromFavorites: 'Убрать из избранного',
      overallRating: 'Общий рейтинг',
      potential: 'потенциал',
      basedOnMetrics: 'На основе 4 ключевых метрик',
      whyTrending: 'Почему это трендит',
      detailedMetrics: 'Детальные метрики',
      detected: 'Обнаружено',
      openDetails: 'Открыть детали',
    },
    trendDetail: {
      tabs: {
        overview: 'Обзор',
        analysis: 'Анализ',
        sources: 'Источники',
        competition: 'Конкуренты',
        venture: 'Инвестиции',
        leads: 'Клиенты',
        pitchDeck: 'Pitch Deck',
        project: 'Проект',
      },
      breadcrumbs: {
        home: 'Главная',
        trends: 'Тренды',
      },
      notFound: 'Тренд не найден',
      backToHome: 'Вернуться на главную',
      overview: {
        growth: 'рост',
        overallScore: 'Общая оценка',
        opportunity: 'Возможность',
        painLevel: 'Острота боли',
        feasibility: 'Выполнимость',
        potential: 'Потенциал',
        information: 'Информация',
        source: 'Источник',
        detected: 'Обнаружен',
        status: 'Статус',
        nextStep: 'Следующий шаг',
        runAnalysisDescription: 'Запустите AI-анализ для выявления болевых точек и целевой аудитории.',
        analyzing: 'Анализирую...',
        runAnalysis: 'Запустить анализ',
      },
      analysis: {
        deepAnalysis: 'Глубокий анализ: 3 AI-агента',
        consensusReached: 'Консенсус достигнут',
        aiDebate: 'Дебаты AI-агентов',
        aiDebateDescription: 'Два агента спорят о потенциале ниши, третий выносит вердикт',
        optimist: 'Оптимист',
        optimistRole: 'Венчурный аналитик',
        optimistConclusion: 'Вывод оптимиста',
        skeptic: 'Скептик',
        skepticRole: 'Опытный инвестор',
        skepticConclusion: 'Вывод скептика',
        willingnessToPay: 'Готовность платить',
        arbiterVerdict: 'Вердикт Арбитра',
        arbiterRole: 'Senior Product Strategist с 20+ лет опыта',
        confidence: 'Уверенность',
        mainPain: 'ГЛАВНАЯ БОЛЬ',
        keyPainPoints: 'Ключевые болевые точки (после арбитража)',
        targetAudience: 'Целевая аудитория',
        size: 'Размер',
        whereToFind: 'Где найти',
        nextStep: 'Следующий шаг',
        collectSourcesDescription: 'Соберите реальные данные из Reddit, YouTube и Google Trends для подтверждения анализа.',
        collectingData: 'Собираю данные...',
        collectSources: 'Собрать источники',
      },
      sources: {
        simulation: 'Симуляция',
        openInGoogleTrends: 'Открыть в Google Trends',
        yearlyGrowth: 'Рост за год',
        relatedQueries: 'Связанные запросы',
        dataSources: 'Источники данных',
      },
      competition: {
        analyzeCompetitors: 'Анализ конкурентов',
        analyzingCompetitors: 'Анализируем конкурентов...',
        marketSaturation: 'Насыщенность рынка',
        riskLevel: 'Уровень риска',
        blueOceanHint: 'Чем выше - тем меньше конкуренция',
        low: 'Низкая',
        medium: 'Средняя',
        high: 'Высокая',
        competitors: 'Конкуренты',
        opportunityAreas: 'Области возможностей',
        nextStep: 'Следующий шаг',
        ventureDescription: 'Изучите инвестиционный ландшафт и активные фонды в этой нише.',
        loadError: 'Не удалось загрузить данные о конкурентах',
      },
      venture: {
        ventureData: 'Венчурные данные',
        collectingData: 'Собираем данные об инвестициях...',
        yearlyInvestments: 'Инвестиции за год',
        averageRound: 'Средний раунд',
        fundingTrend: 'Тренд финансирования',
        growing: 'Растёт',
        stable: 'Стабильно',
        declining: 'Падает',
        investmentAttractiveness: 'Инвест. привлекательность',
        recentRounds: 'Недавние раунды',
        activeFunds: 'Активные фонды',
        website: 'Сайт',
        marketSignals: 'Рыночные сигналы',
        nextStep: 'Следующий шаг',
        findLeadsDescription: 'Найдите потенциальных клиентов с контактами для outreach.',
        dateUnknown: 'Дата неизвестна',
      },
      leads: {
        title: 'Потенциальные клиенты',
        searchingClients: 'Ищем потенциальных клиентов...',
        foundCompanies: 'Найдено компаний',
        interestedInSolving: 'которые могут быть заинтересованы в решении проблемы',
        companies: 'Компании',
        relevance: 'релевантность',
        website: 'Сайт',
        email: 'Email',
        linkedin: 'LinkedIn',
        decisionMakers: 'ЛПР для связи',
        linkedinQueries: 'Запросы для LinkedIn Sales Navigator',
        directories: 'Каталоги для поиска',
        searchTips: 'Советы по поиску',
        nextStep: 'Следующий шаг',
        generatePitchDescription: 'Сгенерируйте Pitch Deck на 10 слайдов для презентации инвесторам.',
        createPitchDeck: 'Создать Pitch Deck',
      },
      pitch: {
        generating: 'Генерируем Pitch Deck...',
        slide: 'Слайд',
        speakerNotes: 'Заметки спикера',
        visualRecommendation: 'Рекомендация по визуалу',
        back: 'Назад',
        next: 'Вперёд',
        exportPresentation: 'Экспорт презентации',
        copyText: 'Копировать текст',
        copyTextDescription: 'Для вставки в редактор',
        downloadJson: 'Скачать JSON',
        downloadJsonDescription: 'Полные данные презентации',
        selectTemplate: 'Выберите шаблон и вставьте контент',
        openTemplates: 'Открыть шаблоны →',
        viaTextFast: 'Через текст (быстро):',
        viaTextStep1: '1. Нажмите "Копировать текст"',
        viaTextStep2: '2. Откройте шаблон (Slides/Figma/Canva)',
        viaTextStep3: '3. Создайте копию шаблона',
        viaTextStep4: '4. Вставьте контент в слайды',
        viaJsonAuto: 'Через JSON (для автоматизации):',
        viaJsonStep1: '1. Скачайте JSON файл',
        viaJsonStep2: '2. Используйте с AI (ChatGPT/Claude): "Создай презентацию из этого JSON"',
        viaJsonStep3: '3. Или импортируйте в Gamma.app, Tome.app',
        viaJsonStep4: '4. Или используйте Google Slides API для автоматического создания',
        nextStep: 'Следующий шаг',
        createProjectDescription: 'Создайте проект с README, roadmap и GitHub репозиторием.',
      },
      project: {
        generating: 'Генерируем проект...',
        problemStatement: 'Описание проблемы',
        solutionOverview: 'Обзор решения',
        coreFeatures: 'Ключевые функции',
        techStack: 'Технологии',
        architecture: 'Архитектура',
        complexity: 'Сложность',
        roadmap: 'Дорожная карта: MVP → Production',
        goals: 'Цели',
        deliverables: 'Deliverables',
        successMetrics: 'Метрики успеха',
        createProject: 'Создать проект',
        createWithGithub: 'Создать с GitHub репо',
        selectMvpType: 'Выберите тип MVP',
      },
      low: 'Низкий',
      medium: 'Средний',
      high: 'Высокий',
      growing: 'Растёт',
      stable: 'Стабильно',
      declining: 'Падает',
    },
    nicheResearch: {
      title: 'Исследование ниши',
      subtitle: 'Введите тему для глубокого анализа рынка',
      inputPlaceholder: 'Например: AI для автоматизации HR',
      analyze: 'Анализировать',
      analyzing: 'Анализируем...',
      examples: 'Примеры запросов',
      results: 'Результаты анализа',
      painPoints: 'Болевые точки',
      targetAudience: 'Целевая аудитория',
      competitors: 'Конкуренты',
      investments: 'Инвестиции',
      sources: 'Источники данных',
      noData: 'Нет данных',
      error: 'Ошибка анализа',
      // Extended translations
      describeNiche: 'Опишите нишу для исследования',
      nicheName: 'Название ниши',
      nicheNamePlaceholder: 'Например: AI-ассистент для стоматологов',
      targetAudienceLabel: 'Целевая аудитория (опционально)',
      targetAudiencePlaceholder: 'Например: Частные стоматологические клиники',
      problemDescription: 'Описание проблемы/идеи',
      problemDescriptionPlaceholder: 'Опишите суть идеи, какую проблему решает, что хотите создать. Чем подробнее - тем точнее анализ.',
      keywords: 'Ключевые слова для поиска (опционально)',
      keywordsPlaceholder: 'Через запятую: dental software, appointment booking, patient management',
      runDeepAnalysis: 'Запустить глубокий анализ',
      analysisIncludes: 'Анализ включает сбор данных из Reddit, YouTube, Google Trends + экспертную оценку тремя AI-агентами',
      collectingData: 'Собираем данные из Reddit, YouTube, Google Trends...',
      expertAnalysis: 'Запускаем экспертный анализ (Оптимист → Скептик → Арбитр)...',
      dataCollection: 'Сбор данных',
      backToTrends: 'К трендам',
      inFavorites: 'В избранном',
      savedToFavorites: 'Сохранено в Избранное',
      analysisComplete: 'Анализ завершён',
      confidenceScore: 'Уверенность',
      // Tabs
      tabResearch: '📊 Исследование',
      tabBusiness: '💼 Бизнес-анализ',
      tabSolutions: '🚀 Решения',
      // Results sections
      collectedData: 'Собранные данные',
      postsFound: 'постов найдено',
      videosFound: 'видео найдено',
      yearlyGrowth: 'рост за год',
      aiSynthesis: 'AI-синтез данных',
      optimist: 'Оптимист',
      skeptic: 'Скептик',
      validatedPainPoints: 'Валидированные болевые точки',
      forArguments: 'За',
      againstArguments: 'Против',
      confidence: 'уверенность',
      primaryAudience: 'Целевая аудитория',
      segmentSize: 'Размер',
      whereToFind: 'Где найти',
      willingnessToPay: 'Готовность платить',
      high: 'Высокая',
      medium: 'Средняя',
      low: 'Низкая',
      risks: 'Риски',
      opportunities: 'Возможности',
      potentialRevenue: 'Потенциальный доход',
      timeToMarket: 'Время до рынка',
      arbiterRecommendation: 'Рекомендация арбитра',
      recommendedSolutions: 'Рекомендуемые решения',
      mvpFeatures: 'MVP фичи',
      monetization: 'Монетизация',
      generateProductSpec: 'Сгенерировать',
      generatingProductSpec: 'Генерируем детальную спецификацию продукта...',
      analysisMetadata: 'Метаданные анализа',
      analysisDepth: 'Глубина анализа',
      consensusReached: 'Консенсус достигнут',
      yes: 'Да',
      partial: 'Частично',
      usedSources: 'Использованные источники',
      openInFavorites: 'Открыть в Избранном',
      newResearch: 'Новое исследование',
      fillNicheAndDescription: 'Заполните название ниши и описание',
      productSpecError: 'Ошибка генерации ProductSpec',
      connectionError: 'Ошибка соединения с сервером',
      tryAgain: 'Попробовать снова',
      productSpecHint: 'Нажмите «Сгенерировать» для создания детальной спецификации продукта с user flow, техническими требованиями и моделью монетизации',
    },
    favorites: {
      title: 'Избранное',
      empty: 'Пока пусто',
      emptyDescription: 'Добавляйте интересные идеи в избранное, чтобы вернуться к ним позже',
      goToHome: 'Перейти к потоку идей',
      ideasCount: 'идей',
      analyzed: 'проанализировано',
      addIdeas: 'Добавить идеи',
      loadingFavorites: 'Загрузка избранного...',
      selectFromLeft: 'Выберите идею из списка слева',
      removeFromFavorites: 'Убрать из избранного',
      deepAnalysis: 'Глубокий анализ',
      analyzing3Agents: 'Глубокий анализ (3 агента)...',
      reanalyze: 'Переанализировать',
      analyze: 'Анализировать',
      downloadReport: 'Скачать отчёт',
      whyTrending: 'Почему это трендит',
      analyzedOn: 'Проанализирован',
      deepAnalysisLabel: 'Глубокий анализ',
      optimistSkepticArbiter: 'Оптимист + Скептик + Арбитр',
      confidenceLabel: 'уверенность',
      consensus: 'Консенсус',
      mainPain: 'Главная боль',
      keyProblems: 'Ключевые проблемы',
      keyProblemsWithArgs: 'Ключевые проблемы (с аргументацией)',
      verdict: 'Вердикт',
      argumentsFor: 'Аргументы ЗА',
      argumentsAgainst: 'Аргументы ПРОТИВ',
      targetAudience: 'Целевая аудитория',
      segmentSize: 'Размер',
      willingnessHigh: 'Высокая готовность платить',
      willingnessMedium: 'Средняя готовность платить',
      willingnessLow: 'Низкая готовность платить',
      whereToFind: 'Где найти',
      risks: 'Риски',
      opportunities: 'Возможности',
      finalRecommendation: 'Финальная рекомендация',
      agentPositions: 'Позиции агентов',
      optimist: 'Оптимист',
      skeptic: 'Скептик',
      realDataSources: 'Реальные источники данных',
      engagement: 'engagement',
      videos: 'видео',
      noData: 'Нет данных',
      requiresFacebookApi: 'Требуется Facebook API ключ',
      goToProject: 'Перейти к проекту',
    },
    projects: {
      title: 'Мои проекты',
      empty: 'Нет проектов',
      emptyDescription: 'Создайте первый проект на основе понравившейся идеи',
      createFirst: 'Найти идею',
      status: {
        planning: 'Планирование',
        inProgress: 'В работе',
        completed: 'Завершён',
      },
    },
    onboarding: {
      skip: 'Пропустить',
      back: 'Назад',
      next: 'Далее',
      done: 'Готово',
      stepOf: 'из',
      steps: {
        home: {
          title: 'Главная страница',
          content: 'Здесь отображается поток трендов — автоматически собранные и проанализированные тренды из Google Trends, Reddit и YouTube.',
        },
        research: {
          title: 'Исследование ниш',
          content: 'Введите любую тему для глубокого анализа: боли аудитории, конкуренты, инвестиции, источники данных. Все данные реальные и проверяемые.',
        },
        favorites: {
          title: 'Избранное',
          content: 'Сохраняйте интересные тренды и идеи для дальнейшей работы. Здесь хранятся ваши закладки.',
        },
        projects: {
          title: 'Проекты',
          content: 'Превращайте идеи в проекты. Система создаст GitHub репозиторий и подключит специализированных AI-агентов для помощи в разработке.',
        },
        generate: {
          title: 'Генерация трендов',
          content: 'Нажмите эту кнопку для запуска автоматического сбора трендов через n8n. Требуется настроенный N8N_WEBHOOK_URL.',
        },
        trendCard: {
          title: 'Карточка тренда',
          content: 'Каждая карточка содержит оценки: популярность, острота боли, выполнимость, потенциал. Нажмите для детального анализа.',
        },
      },
    },
    help: {
      title: 'Помощь',
      showTour: 'Показать обзор',
      tourDescription: 'Пошаговый тур по функциям',
      documentation: 'Документация',
      githubRepo: 'GitHub репозиторий',
      version: 'Версия',
    },
    common: {
      loading: 'Загрузка...',
      error: 'Ошибка',
      retry: 'Повторить',
      save: 'Сохранить',
      cancel: 'Отмена',
      close: 'Закрыть',
      search: 'Поиск',
      filter: 'Фильтр',
      sort: 'Сортировка',
      language: 'Язык',
    },
    sort: {
      overallScore: 'Общая оценка',
      byDate: 'По дате',
      opportunity: 'Возможность',
      pain: 'Боль',
      feasibility: 'Выполнимость',
      profit: 'Выгода',
      highToLow: 'Высокие → Низкие',
      lowToHigh: 'Низкие → Высокие',
    },
    categories: {
      all: 'Все ниши',
      technology: 'Технологии',
      saas: 'SaaS',
      ecommerce: 'E-commerce',
      mobileApps: 'Мобильные приложения',
      edtech: 'EdTech',
      healthtech: 'HealthTech',
      aiml: 'AI/ML',
      fintech: 'FinTech',
    },
    errors: {
      apiKeyNotConfigured: 'API ключ не настроен',
      noDataFound: 'Данные не найдены',
      networkError: 'Ошибка сети',
      serverError: 'Ошибка сервера',
    },
  },

  en: {
    nav: {
      home: 'Ideas Feed',
      nicheResearch: 'Niche Research',
      favorites: 'Favorites',
      projects: 'Projects',
      collapse: 'Collapse',
    },
    home: {
      searchPlaceholder: 'Search ideas...',
      updated: 'Updated',
      generating: 'Generating...',
      newIdeas: 'New Ideas',
      refreshing: 'Refreshing...',
      refresh: 'Refresh',
      liveData: 'Live data',
      updatesEvery6Hours: 'Updates every 6 hours',
      heroTitle1: 'Find your',
      heroTitle2: 'idea',
      heroTitle3: 'for the next project',
      heroDescription: 'AI analyzes trends from Reddit, Google Trends, YouTube and other sources to find promising niches with high potential.',
      ideas: 'Ideas',
      avgRating: 'Avg. rating',
      categories: 'Categories',
      allNiches: 'All niches',
      found: 'Found',
      ideasIn: 'ideas in',
      category: 'category',
      showMore: 'Show more',
      moreIdeas: 'ideas',
      hide: 'Hide',
      nothingFound: 'Nothing found',
      tryChangingSearch: 'Try changing your search query',
      noTrendsInCategory: 'No trends in this category. Run Trend Analyzer in n8n to get fresh data',
      resetSearch: 'Reset search',
      dataUpdatesAuto: 'Data updates automatically every 6 hours via n8n',
      connectionError: 'Connection error',
      useNicheResearch: 'Use "Niche Research" for manual analysis',
    },
    trendCard: {
      opportunity: 'Opportunity',
      pain: 'Pain',
      feasibility: 'Feasibility',
      profit: 'Profit',
      excellent: 'Excellent',
      good: 'Good',
      average: 'Average',
      low: 'Low',
      justNow: 'Just now',
      minAgo: 'min ago',
      hoursAgo: 'h ago',
      daysAgo: 'd ago',
      details: 'Details',
      createProject: 'Create project',
      projectCreated: 'Project created',
      addToFavorites: 'Add to favorites',
      removeFromFavorites: 'Remove from favorites',
      overallRating: 'Overall rating',
      potential: 'potential',
      basedOnMetrics: 'Based on 4 key metrics',
      whyTrending: 'Why is this trending',
      detailedMetrics: 'Detailed metrics',
      detected: 'Detected',
      openDetails: 'Open details',
    },
    trendDetail: {
      tabs: {
        overview: 'Overview',
        analysis: 'Analysis',
        sources: 'Sources',
        competition: 'Competitors',
        venture: 'Investments',
        leads: 'Clients',
        pitchDeck: 'Pitch Deck',
        project: 'Project',
      },
      breadcrumbs: {
        home: 'Home',
        trends: 'Trends',
      },
      notFound: 'Trend not found',
      backToHome: 'Back to home',
      overview: {
        growth: 'growth',
        overallScore: 'Overall Score',
        opportunity: 'Opportunity',
        painLevel: 'Pain Level',
        feasibility: 'Feasibility',
        potential: 'Potential',
        information: 'Information',
        source: 'Source',
        detected: 'Detected',
        status: 'Status',
        nextStep: 'Next Step',
        runAnalysisDescription: 'Run AI analysis to identify pain points and target audience.',
        analyzing: 'Analyzing...',
        runAnalysis: 'Run Analysis',
      },
      analysis: {
        deepAnalysis: 'Deep Analysis: 3 AI Agents',
        consensusReached: 'Consensus reached',
        aiDebate: 'AI Agents Debate',
        aiDebateDescription: 'Two agents debate the niche potential, a third gives the verdict',
        optimist: 'Optimist',
        optimistRole: 'Venture Analyst',
        optimistConclusion: 'Optimist conclusion',
        skeptic: 'Skeptic',
        skepticRole: 'Experienced Investor',
        skepticConclusion: 'Skeptic conclusion',
        willingnessToPay: 'Willingness to pay',
        arbiterVerdict: 'Arbiter Verdict',
        arbiterRole: 'Senior Product Strategist with 20+ years of experience',
        confidence: 'Confidence',
        mainPain: 'MAIN PAIN',
        keyPainPoints: 'Key pain points (after arbitration)',
        targetAudience: 'Target Audience',
        size: 'Size',
        whereToFind: 'Where to find',
        nextStep: 'Next Step',
        collectSourcesDescription: 'Collect real data from Reddit, YouTube and Google Trends to validate the analysis.',
        collectingData: 'Collecting data...',
        collectSources: 'Collect Sources',
      },
      sources: {
        simulation: 'Simulation',
        openInGoogleTrends: 'Open in Google Trends',
        yearlyGrowth: 'Yearly Growth',
        relatedQueries: 'Related Queries',
        dataSources: 'Data Sources',
      },
      competition: {
        analyzeCompetitors: 'Analyze Competitors',
        analyzingCompetitors: 'Analyzing competitors...',
        marketSaturation: 'Market Saturation',
        riskLevel: 'Risk Level',
        blueOceanHint: 'Higher score = less competition',
        low: 'Low',
        medium: 'Medium',
        high: 'High',
        competitors: 'Competitors',
        opportunityAreas: 'Opportunity Areas',
        nextStep: 'Next Step',
        ventureDescription: 'Explore the investment landscape and active funds in this niche.',
        loadError: 'Failed to load competitor data',
      },
      venture: {
        ventureData: 'Venture Data',
        collectingData: 'Collecting investment data...',
        yearlyInvestments: 'Yearly Investments',
        averageRound: 'Average Round',
        fundingTrend: 'Funding Trend',
        growing: 'Growing',
        stable: 'Stable',
        declining: 'Declining',
        investmentAttractiveness: 'Investment Attractiveness',
        recentRounds: 'Recent Rounds',
        activeFunds: 'Active Funds',
        website: 'Website',
        marketSignals: 'Market Signals',
        nextStep: 'Next Step',
        findLeadsDescription: 'Find potential clients with contacts for outreach.',
        dateUnknown: 'Date unknown',
      },
      leads: {
        title: 'Potential Clients',
        searchingClients: 'Searching for potential clients...',
        foundCompanies: 'Companies found',
        interestedInSolving: 'that may be interested in solving the problem',
        companies: 'Companies',
        relevance: 'relevance',
        website: 'Website',
        email: 'Email',
        linkedin: 'LinkedIn',
        decisionMakers: 'Decision makers to contact',
        linkedinQueries: 'LinkedIn Sales Navigator queries',
        directories: 'Directories for search',
        searchTips: 'Search tips',
        nextStep: 'Next Step',
        generatePitchDescription: 'Generate a 10-slide Pitch Deck for investor presentation.',
        createPitchDeck: 'Create Pitch Deck',
      },
      pitch: {
        generating: 'Generating Pitch Deck...',
        slide: 'Slide',
        speakerNotes: 'Speaker notes',
        visualRecommendation: 'Visual recommendation',
        back: 'Back',
        next: 'Next',
        exportPresentation: 'Export presentation',
        copyText: 'Copy text',
        copyTextDescription: 'For pasting into editor',
        downloadJson: 'Download JSON',
        downloadJsonDescription: 'Full presentation data',
        selectTemplate: 'Select a template and paste content',
        openTemplates: 'Open templates →',
        viaTextFast: 'Via text (fast):',
        viaTextStep1: '1. Click "Copy text"',
        viaTextStep2: '2. Open template (Slides/Figma/Canva)',
        viaTextStep3: '3. Create a copy of the template',
        viaTextStep4: '4. Paste content into slides',
        viaJsonAuto: 'Via JSON (for automation):',
        viaJsonStep1: '1. Download JSON file',
        viaJsonStep2: '2. Use with AI (ChatGPT/Claude): "Create presentation from this JSON"',
        viaJsonStep3: '3. Or import to Gamma.app, Tome.app',
        viaJsonStep4: '4. Or use Google Slides API for automatic creation',
        nextStep: 'Next Step',
        createProjectDescription: 'Create a project with README, roadmap and GitHub repository.',
      },
      project: {
        generating: 'Generating project...',
        problemStatement: 'Problem Statement',
        solutionOverview: 'Solution Overview',
        coreFeatures: 'Core Features',
        techStack: 'Tech Stack',
        architecture: 'Architecture',
        complexity: 'Complexity',
        roadmap: 'Roadmap: MVP → Production',
        goals: 'Goals',
        deliverables: 'Deliverables',
        successMetrics: 'Success Metrics',
        createProject: 'Create Project',
        createWithGithub: 'Create with GitHub repo',
        selectMvpType: 'Select MVP type',
      },
      low: 'Low',
      medium: 'Medium',
      high: 'High',
      growing: 'Growing',
      stable: 'Stable',
      declining: 'Declining',
    },
    nicheResearch: {
      title: 'Niche Research',
      subtitle: 'Enter a topic for deep market analysis',
      inputPlaceholder: 'E.g.: AI for HR automation',
      analyze: 'Analyze',
      analyzing: 'Analyzing...',
      examples: 'Query examples',
      results: 'Analysis results',
      painPoints: 'Pain points',
      targetAudience: 'Target audience',
      competitors: 'Competitors',
      investments: 'Investments',
      sources: 'Data sources',
      noData: 'No data',
      error: 'Analysis error',
      // Extended translations
      describeNiche: 'Describe the niche to research',
      nicheName: 'Niche name',
      nicheNamePlaceholder: 'E.g.: AI assistant for dentists',
      targetAudienceLabel: 'Target audience (optional)',
      targetAudiencePlaceholder: 'E.g.: Private dental clinics',
      problemDescription: 'Problem/idea description',
      problemDescriptionPlaceholder: 'Describe the idea, what problem it solves, what you want to create. The more detail - the more accurate the analysis.',
      keywords: 'Search keywords (optional)',
      keywordsPlaceholder: 'Comma-separated: dental software, appointment booking, patient management',
      runDeepAnalysis: 'Run deep analysis',
      analysisIncludes: 'Analysis includes data from Reddit, YouTube, Google Trends + expert evaluation by three AI agents',
      collectingData: 'Collecting data from Reddit, YouTube, Google Trends...',
      expertAnalysis: 'Running expert analysis (Optimist → Skeptic → Arbiter)...',
      dataCollection: 'Data collection',
      backToTrends: 'Back to trends',
      inFavorites: 'In favorites',
      savedToFavorites: 'Saved to Favorites',
      analysisComplete: 'Analysis complete',
      confidenceScore: 'Confidence',
      // Tabs
      tabResearch: '📊 Research',
      tabBusiness: '💼 Business Analysis',
      tabSolutions: '🚀 Solutions',
      // Results sections
      collectedData: 'Collected data',
      postsFound: 'posts found',
      videosFound: 'videos found',
      yearlyGrowth: 'yearly growth',
      aiSynthesis: 'AI data synthesis',
      optimist: 'Optimist',
      skeptic: 'Skeptic',
      validatedPainPoints: 'Validated pain points',
      forArguments: 'For',
      againstArguments: 'Against',
      confidence: 'confidence',
      primaryAudience: 'Target Audience',
      segmentSize: 'Size',
      whereToFind: 'Where to find',
      willingnessToPay: 'Willingness to pay',
      high: 'High',
      medium: 'Medium',
      low: 'Low',
      risks: 'Risks',
      opportunities: 'Opportunities',
      potentialRevenue: 'Potential revenue',
      timeToMarket: 'Time to market',
      arbiterRecommendation: 'Arbiter recommendation',
      recommendedSolutions: 'Recommended solutions',
      mvpFeatures: 'MVP features',
      monetization: 'Monetization',
      generateProductSpec: 'Generate',
      generatingProductSpec: 'Generating detailed product specification...',
      analysisMetadata: 'Analysis metadata',
      analysisDepth: 'Analysis depth',
      consensusReached: 'Consensus reached',
      yes: 'Yes',
      partial: 'Partial',
      usedSources: 'Sources used',
      openInFavorites: 'Open in Favorites',
      newResearch: 'New research',
      fillNicheAndDescription: 'Fill in niche name and description',
      productSpecError: 'ProductSpec generation error',
      connectionError: 'Server connection error',
      tryAgain: 'Try again',
      productSpecHint: 'Click "Generate" to create a detailed product specification with user flow, technical requirements and monetization model',
    },
    favorites: {
      title: 'Favorites',
      empty: 'Empty',
      emptyDescription: 'Add interesting ideas to favorites to return to them later',
      goToHome: 'Go to ideas feed',
      ideasCount: 'ideas',
      analyzed: 'analyzed',
      addIdeas: 'Add Ideas',
      loadingFavorites: 'Loading favorites...',
      selectFromLeft: 'Select an idea from the list on the left',
      removeFromFavorites: 'Remove from favorites',
      deepAnalysis: 'Deep Analysis',
      analyzing3Agents: 'Deep analysis (3 agents)...',
      reanalyze: 'Re-analyze',
      analyze: 'Analyze',
      downloadReport: 'Download Report',
      whyTrending: 'Why is this trending',
      analyzedOn: 'Analyzed on',
      deepAnalysisLabel: 'Deep Analysis',
      optimistSkepticArbiter: 'Optimist + Skeptic + Arbiter',
      confidenceLabel: 'confidence',
      consensus: 'Consensus',
      mainPain: 'Main Pain',
      keyProblems: 'Key Problems',
      keyProblemsWithArgs: 'Key Problems (with arguments)',
      verdict: 'Verdict',
      argumentsFor: 'Arguments FOR',
      argumentsAgainst: 'Arguments AGAINST',
      targetAudience: 'Target Audience',
      segmentSize: 'Size',
      willingnessHigh: 'High willingness to pay',
      willingnessMedium: 'Medium willingness to pay',
      willingnessLow: 'Low willingness to pay',
      whereToFind: 'Where to find',
      risks: 'Risks',
      opportunities: 'Opportunities',
      finalRecommendation: 'Final Recommendation',
      agentPositions: 'Agent Positions',
      optimist: 'Optimist',
      skeptic: 'Skeptic',
      realDataSources: 'Real Data Sources',
      engagement: 'engagement',
      videos: 'videos',
      noData: 'No data',
      requiresFacebookApi: 'Requires Facebook API key',
      goToProject: 'Go to Project',
    },
    projects: {
      title: 'My Projects',
      empty: 'No projects',
      emptyDescription: 'Create your first project based on an idea you like',
      createFirst: 'Find an idea',
      status: {
        planning: 'Planning',
        inProgress: 'In Progress',
        completed: 'Completed',
      },
    },
    onboarding: {
      skip: 'Skip',
      back: 'Back',
      next: 'Next',
      done: 'Done',
      stepOf: 'of',
      steps: {
        home: {
          title: 'Home Page',
          content: 'This displays the trend feed — automatically collected and analyzed trends from Google Trends, Reddit and YouTube.',
        },
        research: {
          title: 'Niche Research',
          content: 'Enter any topic for deep analysis: audience pain points, competitors, investments, data sources. All data is real and verifiable.',
        },
        favorites: {
          title: 'Favorites',
          content: 'Save interesting trends and ideas for later. Your bookmarks are stored here.',
        },
        projects: {
          title: 'Projects',
          content: 'Turn ideas into projects. The system will create a GitHub repository and connect specialized AI agents to help with development.',
        },
        generate: {
          title: 'Generate Trends',
          content: 'Click this button to start automatic trend collection via n8n. Requires configured N8N_WEBHOOK_URL.',
        },
        trendCard: {
          title: 'Trend Card',
          content: 'Each card contains scores: popularity, pain severity, feasibility, potential. Click for detailed analysis.',
        },
      },
    },
    help: {
      title: 'Help',
      showTour: 'Show tour',
      tourDescription: 'Step-by-step feature tour',
      documentation: 'Documentation',
      githubRepo: 'GitHub repository',
      version: 'Version',
    },
    common: {
      loading: 'Loading...',
      error: 'Error',
      retry: 'Retry',
      save: 'Save',
      cancel: 'Cancel',
      close: 'Close',
      search: 'Search',
      filter: 'Filter',
      sort: 'Sort',
      language: 'Language',
    },
    sort: {
      overallScore: 'Overall score',
      byDate: 'By date',
      opportunity: 'Opportunity',
      pain: 'Pain',
      feasibility: 'Feasibility',
      profit: 'Profit',
      highToLow: 'High → Low',
      lowToHigh: 'Low → High',
    },
    categories: {
      all: 'All niches',
      technology: 'Technology',
      saas: 'SaaS',
      ecommerce: 'E-commerce',
      mobileApps: 'Mobile Apps',
      edtech: 'EdTech',
      healthtech: 'HealthTech',
      aiml: 'AI/ML',
      fintech: 'FinTech',
    },
    errors: {
      apiKeyNotConfigured: 'API key not configured',
      noDataFound: 'No data found',
      networkError: 'Network error',
      serverError: 'Server error',
    },
  },
};
