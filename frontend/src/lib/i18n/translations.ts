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
  };

  // Favorites
  favorites: {
    title: string;
    empty: string;
    emptyDescription: string;
    goToHome: string;
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
    },
    favorites: {
      title: 'Избранное',
      empty: 'Пока пусто',
      emptyDescription: 'Добавляйте интересные идеи в избранное, чтобы вернуться к ним позже',
      goToHome: 'Перейти к потоку идей',
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
    },
    favorites: {
      title: 'Favorites',
      empty: 'Empty',
      emptyDescription: 'Add interesting ideas to favorites to return to them later',
      goToHome: 'Go to ideas feed',
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
