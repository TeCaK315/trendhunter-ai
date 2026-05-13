export type Language = 'ru' | 'en';

export interface Translations {
  // Navigation
  nav: {
    home: string;
    nicheResearch: string;
    favorites: string;
    projects: string;
    lk: string;
    lkHome: string;
    lkResearch: string;
    lkStrategies: string;
    lkRoadmap: string;
    lkProjects: string;
    lkCredits: string;
    collapse: string;
    sectionDiscover: string;
    sectionWorkspace: string;
  };

  // Auth
  auth: {
    signIn: string;
    signOut: string;
    signInWith: string;
    signInWithGoogle: string;
    myAccount: string;
    settings: string;
    generationsToday: string;
    generationsLeft: string;
    unlimited: string;
    upgradeToPro: string;
    connectedAccounts: string;
    connected: string;
    connect: string;
    githubProfile: string;
    ideasToday: string;
    unlimitedAccess: string;
    loginRequired: string;
    loginToGenerate: string;
    limitReached: string;
    limitReachedDescription: string;
    adminPanel: string;
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
    heroCta: string;
    heroDemo: string;
    heroFeature1: string;
    heroFeature2: string;
    heroFeature3: string;
    heroFeature4: string;
    howItWorksTitle: string;
    step1Title: string;
    step1Desc: string;
    step2Title: string;
    step2Desc: string;
    step3Title: string;
    step3Desc: string;
    trendingSectionTitle: string;
    trendingSectionDesc: string;
    ideas: string;
    avgGrowth: string;
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
    generateFrom: string;
    randomCategory: string;
  };

  // Trend card
  trendCard: {
    popularity: string;
    growth: string;
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
    analyzeNiche: string;
    addToFavoritesShort: string;
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
      potential: string;
      information: string;
      source: string;
      detected: string;
      status: string;
      nextStep: string;
      runAnalysisDescription: string;
      analyzing: string;
      runAnalysis: string;
      progressStep: string;
      progressOf: string;
      dataCollected: string;
      dataBlocks: string;
      allDataReady: string;
      nextStepStrategy: string;
      nextStepMonitoring: string;
      nextStepProject: string;
      nextStepHint: string;
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
    // Welcome Wizard (first login)
    welcome: {
      step1Title: string;
      step1Desc: string;
      step2Title: string;
      step2Desc: string;
      step3Title: string;
      step3Desc: string;
      getStarted: string;
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
    hintText: string;
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
    growth: string;
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
    business: string;
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
      lk: 'ЛК',
      lkHome: 'Главная',
      lkResearch: 'Исследования',
      lkStrategies: 'Стратегии',
      lkRoadmap: 'Роадмап Pro',
      lkProjects: 'Проекты',
      lkCredits: 'Пополнить монеты',
      collapse: 'Свернуть',
      sectionDiscover: 'Обзор',
      sectionWorkspace: 'Рабочее пространство',
    },
    auth: {
      signIn: 'Войти',
      signOut: 'Выйти',
      signInWith: 'Войти через',
      signInWithGoogle: 'Войти через Google',
      myAccount: 'Мой аккаунт',
      settings: 'Настройки',
      generationsToday: 'Генераций сегодня',
      generationsLeft: 'Осталось генераций',
      unlimited: 'Безлимит',
      upgradeToPro: 'Улучшить до Pro',
      connectedAccounts: 'Подключённые аккаунты',
      connected: 'Подключён',
      connect: 'Подключить',
      githubProfile: 'Профиль GitHub',
      ideasToday: 'Идей сегодня',
      unlimitedAccess: 'Безлимитный доступ',
      loginRequired: 'Требуется авторизация',
      loginToGenerate: 'Войдите, чтобы генерировать идеи и получить доступ ко всем функциям платформы',
      limitReached: 'Лимит исчерпан',
      limitReachedDescription: 'Вы достигли дневного лимита в 10 идей. Лимит сбросится в полночь.',
      adminPanel: 'Админ-панель',
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
      heroTitle1: 'Найди прибыльную нишу',
      heroTitle2: 'за 10 минут',
      heroTitle3: '',
      heroDescription: 'Не гадай — анализируй реальные данные. Google Trends, конкуренты, стоимость входа — всё в одном месте.',
      heroCta: 'Начать бесплатно',
      heroDemo: 'Посмотреть тренды',
      heroFeature1: 'Google Trends',
      heroFeature2: 'Анализ конкурентов',
      heroFeature3: 'Оценка входа',
      heroFeature4: 'Бизнес-калькулятор',
      howItWorksTitle: 'Как это работает',
      step1Title: 'Выбери тренд',
      step1Desc: 'Смотри что растёт в поиске прямо сейчас',
      step2Title: 'Получи анализ',
      step2Desc: 'Конкуренты, стоимость входа, рыночная ситуация',
      step3Title: 'Запусти проект',
      step3Desc: 'Калькулятор, мониторинг, опросы — всё в одном месте',
      trendingSectionTitle: 'Растущие ниши на этой неделе',
      trendingSectionDesc: 'Реальные данные Google Trends. Обновляется каждые 6 часов.',
      ideas: 'Идей',
      avgGrowth: 'Ср. рост',
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
      noTrendsInCategory: 'Нет трендов в этой категории. Нажмите "Новые идеи" чтобы найти свежие тренды',
      resetSearch: 'Сбросить поиск',
      dataUpdatesAuto: 'Данные обновляются из Google Trends',
      connectionError: 'Ошибка соединения',
      useNicheResearch: 'Используйте "Исследование ниш" для ручного анализа',
      generateFrom: 'Генерировать из',
      randomCategory: 'Случайная',
    },
    trendCard: {
      popularity: 'Популярность',
      growth: 'Рост тренда',
      excellent: 'Отличный',
      good: 'Хороший',
      average: 'Средний',
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
      potential: 'Потенциал',
      basedOnMetrics: 'На основе 4 ключевых метрик',
      whyTrending: 'Почему это трендит',
      detailedMetrics: 'Детальные метрики',
      detected: 'Обнаружено',
      openDetails: 'Открыть детали',
      analyzeNiche: 'Анализировать нишу',
      addToFavoritesShort: 'В избранное',
    },
    trendDetail: {
      tabs: {
        overview: 'Обзор',
        analysis: 'Анализ',
        sources: 'Источники',
        competition: 'Конкуренты',
        venture: 'Инвестиции',
        leads: 'Клиенты',
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
        overallScore: 'Популярность',
        potential: 'Потенциал',
        information: 'Информация',
        source: 'Источник',
        detected: 'Обнаружен',
        status: 'Статус',
        nextStep: 'Следующий шаг',
        runAnalysisDescription: 'Запустите исследование рынка: сбор жалоб, спроса, конкурентов, цен и экономики.',
        analyzing: 'Исследую рынок...',
        runAnalysis: 'Начать исследование',
        progressStep: 'Шаг',
        progressOf: 'из',
        dataCollected: 'Собрано',
        dataBlocks: 'блоков данных',
        allDataReady: 'Все данные собраны! Запустите AI-синтез для получения вердикта.',
        nextStepStrategy: 'Перейти к стратегии',
        nextStepMonitoring: 'Настроить мониторинг',
        nextStepProject: 'Создать проект',
        nextStepHint: 'Следующий шаг',
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
          content: 'Нажмите эту кнопку для генерации новых бизнес-идей на основе актуальных трендов.',
        },
        trendCard: {
          title: 'Карточка тренда',
          content: 'Каждая карточка показывает популярность и рост тренда на основе данных Google Trends. Нажмите для детального анализа.',
        },
      },
      welcome: {
        step1Title: 'Добро пожаловать в TrendHunter AI',
        step1Desc: 'Мы находим прибыльные ниши на основе реальных данных Google Trends, анализируем конкуренцию и оцениваем стоимость входа — чтобы вы не тратили время на гадание.',
        step2Title: 'Находите тренды за секунды',
        step2Desc: 'Листайте ленту трендов, фильтруйте по 9 категориям, ищите по ключевым словам. Каждая карточка показывает уровень конкуренции, количество игроков и стоимость входа.',
        step3Title: 'Анализируйте и запускайте',
        step3Desc: 'Нажмите «Анализировать нишу» на любой карточке — получите глубокий анализ: реальные проблемы аудитории, бизнес-план, конкурентов и готовый MVP-проект.',
        getStarted: 'Начать работу',
      },
    },
    help: {
      title: 'Помощь',
      showTour: 'Показать обзор',
      tourDescription: 'Пошаговый тур по функциям',
      documentation: 'Документация',
      githubRepo: 'GitHub репозиторий',
      version: 'Версия',
      hintText: 'Нужна помощь? Нажми сюда для обзора функций',
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
      overallScore: 'Популярность',
      byDate: 'По дате',
      growth: 'Рост тренда',
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
      business: 'Бизнес',
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
      lk: 'Account',
      lkHome: 'Home',
      lkResearch: 'Research',
      lkStrategies: 'Strategies',
      lkRoadmap: 'Roadmap Pro',
      lkProjects: 'Projects',
      lkCredits: 'Buy Credits',
      collapse: 'Collapse',
      sectionDiscover: 'Discover',
      sectionWorkspace: 'Workspace',
    },
    auth: {
      signIn: 'Sign In',
      signOut: 'Sign Out',
      signInWith: 'Sign in with',
      signInWithGoogle: 'Sign in with Google',
      myAccount: 'My Account',
      settings: 'Settings',
      generationsToday: 'Generations today',
      generationsLeft: 'Generations left',
      unlimited: 'Unlimited',
      upgradeToPro: 'Upgrade to Pro',
      connectedAccounts: 'Connected accounts',
      connected: 'Connected',
      connect: 'Connect',
      githubProfile: 'GitHub Profile',
      ideasToday: 'Ideas today',
      unlimitedAccess: 'Unlimited access',
      loginRequired: 'Login required',
      loginToGenerate: 'Sign in to generate ideas and access all platform features',
      limitReached: 'Limit reached',
      limitReachedDescription: 'You have reached your daily limit of 10 ideas. The limit resets at midnight.',
      adminPanel: 'Admin Panel',
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
      heroTitle1: 'Find a profitable niche',
      heroTitle2: 'in 10 minutes',
      heroTitle3: '',
      heroDescription: 'Don\'t guess — analyze real data. Google Trends, competitors, entry costs — all in one place.',
      heroCta: 'Start for free',
      heroDemo: 'View trends',
      heroFeature1: 'Google Trends',
      heroFeature2: 'Competitor analysis',
      heroFeature3: 'Entry cost estimate',
      heroFeature4: 'Business calculator',
      howItWorksTitle: 'How it works',
      step1Title: 'Pick a trend',
      step1Desc: 'See what\'s growing in search right now',
      step2Title: 'Get analysis',
      step2Desc: 'Competitors, entry cost, market situation',
      step3Title: 'Launch a project',
      step3Desc: 'Calculator, monitoring, surveys — all in one place',
      trendingSectionTitle: 'Trending niches this week',
      trendingSectionDesc: 'Real Google Trends data. Updates every 6 hours.',
      ideas: 'Ideas',
      avgGrowth: 'Avg. growth',
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
      noTrendsInCategory: 'No trends in this category. Click "New Ideas" to find fresh trends',
      resetSearch: 'Reset search',
      dataUpdatesAuto: 'Data sourced from Google Trends',
      connectionError: 'Connection error',
      useNicheResearch: 'Use "Niche Research" for manual analysis',
      generateFrom: 'Generate from',
      randomCategory: 'Random',
    },
    trendCard: {
      popularity: 'Popularity',
      growth: 'Trend growth',
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
      potential: 'Potential',
      basedOnMetrics: 'Based on 4 key metrics',
      whyTrending: 'Why is this trending',
      detailedMetrics: 'Detailed metrics',
      detected: 'Detected',
      openDetails: 'Open details',
      analyzeNiche: 'Analyze niche',
      addToFavoritesShort: 'Bookmark',
    },
    trendDetail: {
      tabs: {
        overview: 'Overview',
        analysis: 'Analysis',
        sources: 'Sources',
        competition: 'Competitors',
        venture: 'Investments',
        leads: 'Clients',
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
        overallScore: 'Popularity',
        potential: 'Potential',
        information: 'Information',
        source: 'Source',
        detected: 'Detected',
        status: 'Status',
        nextStep: 'Next Step',
        runAnalysisDescription: 'Start market research: complaints, demand, competitors, pricing and economics.',
        analyzing: 'Researching market...',
        runAnalysis: 'Start Research',
        progressStep: 'Step',
        progressOf: 'of',
        dataCollected: 'Collected',
        dataBlocks: 'data blocks',
        allDataReady: 'All data collected! Run AI Synthesis to get the verdict.',
        nextStepStrategy: 'Go to Strategy',
        nextStepMonitoring: 'Set up monitoring',
        nextStepProject: 'Create project',
        nextStepHint: 'Next step',
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
          content: 'Click this button to generate new business ideas based on current trends.',
        },
        trendCard: {
          title: 'Trend Card',
          content: 'Each card shows popularity and growth rate based on Google Trends data. Click for detailed analysis.',
        },
      },
      welcome: {
        step1Title: 'Welcome to TrendHunter AI',
        step1Desc: 'We find profitable niches using real Google Trends data, analyze competition, and estimate entry costs — so you don\'t waste time guessing.',
        step2Title: 'Find trends in seconds',
        step2Desc: 'Scroll the trend feed, filter by 9 categories, search by keywords. Each card shows competition level, player count, and entry cost.',
        step3Title: 'Analyze and launch',
        step3Desc: 'Click "Analyze niche" on any card — get deep analysis: real audience problems, business plan, competitors, and a ready MVP project.',
        getStarted: 'Get started',
      },
    },
    help: {
      title: 'Help',
      showTour: 'Show tour',
      tourDescription: 'Step-by-step feature tour',
      documentation: 'Documentation',
      githubRepo: 'GitHub repository',
      version: 'Version',
      hintText: 'Need help? Click here for a feature tour',
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
      overallScore: 'Popularity',
      byDate: 'By date',
      growth: 'Trend growth',
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
      business: 'Business',
    },
    errors: {
      apiKeyNotConfigured: 'API key not configured',
      noDataFound: 'No data found',
      networkError: 'Network error',
      serverError: 'Server error',
    },
  },
};
