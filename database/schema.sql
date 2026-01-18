-- TrendHunter AI Platform Database Schema
-- PostgreSQL 16+

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For full-text search

-- ==========================================
-- USERS & AUTHENTICATION
-- ==========================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- TRENDS ANALYSIS
-- ==========================================

CREATE TABLE trend_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE trends (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID REFERENCES trend_categories(id) ON DELETE SET NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,

    -- Metrics
    popularity_score INTEGER DEFAULT 0, -- 0-100
    growth_rate DECIMAL(5,2), -- Percentage
    investment_volume DECIMAL(15,2), -- USD
    search_volume INTEGER,

    -- Analysis
    why_trending TEXT, -- Причинно-следственная связь
    key_pain_points TEXT[], -- Массив болевых точек
    target_audience JSONB, -- Целевая аудитория

    -- Metadata
    first_detected_at TIMESTAMP WITH TIME ZONE,
    last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'active', -- active, declining, stable
    metadata JSONB,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for search
CREATE INDEX idx_trends_title ON trends USING gin(to_tsvector('english', title));
CREATE INDEX idx_trends_popularity ON trends(popularity_score DESC);
CREATE INDEX idx_trends_category ON trends(category_id);
CREATE INDEX idx_trends_status ON trends(status);

-- ==========================================
-- TREND SOURCES (откуда получены данные)
-- ==========================================

CREATE TABLE trend_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trend_id UUID REFERENCES trends(id) ON DELETE CASCADE,
    source_type VARCHAR(50) NOT NULL, -- google_trends, reddit, youtube, twitter, crunchbase
    source_url TEXT,
    raw_data JSONB, -- Сырые данные из API
    collected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Metrics from source
    engagement_count INTEGER,
    sentiment_score DECIMAL(3,2), -- -1.0 to 1.0

    CONSTRAINT unique_trend_source UNIQUE(trend_id, source_type, source_url)
);

CREATE INDEX idx_trend_sources_trend ON trend_sources(trend_id);
CREATE INDEX idx_trend_sources_type ON trend_sources(source_type);

-- ==========================================
-- INVESTMENTS (инвестиционные данные)
-- ==========================================

CREATE TABLE investments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trend_id UUID REFERENCES trends(id) ON DELETE SET NULL,
    company_name VARCHAR(255),
    amount DECIMAL(15,2) NOT NULL, -- USD
    funding_round VARCHAR(50), -- seed, series_a, series_b, etc.
    investors TEXT[],
    announced_date DATE,
    source_url TEXT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_investments_trend ON investments(trend_id);
CREATE INDEX idx_investments_amount ON investments(amount DESC);

-- ==========================================
-- MARKET RESEARCH
-- ==========================================

CREATE TABLE market_research (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trend_id UUID REFERENCES trends(id) ON DELETE CASCADE,

    -- Market Analysis
    market_size DECIMAL(15,2), -- USD
    market_growth_rate DECIMAL(5,2), -- Percentage
    competitors JSONB[], -- Array of competitor objects

    -- Customer Analysis
    customer_pain_points TEXT[],
    customer_willingness_to_pay JSONB, -- Price points and data
    existing_solutions JSONB[],

    -- Opportunities
    market_gaps TEXT[],
    opportunities TEXT[],
    threats TEXT[],

    -- AI Analysis
    ai_recommendations TEXT,
    confidence_score DECIMAL(3,2), -- 0.00 to 1.00

    analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB
);

CREATE INDEX idx_market_research_trend ON market_research(trend_id);

-- ==========================================
-- PROJECTS (пользовательские проекты)
-- ==========================================

CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    trend_id UUID REFERENCES trends(id) ON DELETE SET NULL,

    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'planning', -- planning, in_progress, launched, paused, archived

    -- GitHub Integration
    github_repo_url TEXT,
    github_repo_name VARCHAR(255),

    -- Project Data
    research_data JSONB, -- Все исследования
    documents JSONB[], -- Документы проекта
    milestones JSONB[], -- Вехи проекта

    -- Timeline
    start_date DATE,
    target_launch_date DATE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_projects_user ON projects(user_id);
CREATE INDEX idx_projects_trend ON projects(trend_id);
CREATE INDEX idx_projects_status ON projects(status);

-- ==========================================
-- PROJECT TASKS (задачи проектов)
-- ==========================================

CREATE TABLE project_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,

    title VARCHAR(500) NOT NULL,
    description TEXT,
    week_number INTEGER, -- Номер недели с начала проекта
    status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, completed, blocked
    priority VARCHAR(20) DEFAULT 'medium', -- low, medium, high, urgent

    -- Task Details
    checklist JSONB[], -- Подзадачи
    attachments JSONB[],
    assigned_to VARCHAR(100), -- AI agent or user

    -- Timeline
    due_date DATE,
    completed_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_project_tasks_project ON project_tasks(project_id);
CREATE INDEX idx_project_tasks_status ON project_tasks(status);
CREATE INDEX idx_project_tasks_week ON project_tasks(week_number);

-- ==========================================
-- AI AGENTS & CHATS
-- ==========================================

CREATE TABLE ai_agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    agent_type VARCHAR(50) NOT NULL, -- trend_analyzer, market_researcher, developer, etc.
    description TEXT,
    system_prompt TEXT,
    capabilities TEXT[],
    model_config JSONB, -- Model configuration (temperature, etc.)
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ai_chats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES ai_agents(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,

    title VARCHAR(255),
    messages JSONB[], -- Массив сообщений
    context_data JSONB, -- Контекст для агента

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ai_chats_project ON ai_chats(project_id);
CREATE INDEX idx_ai_chats_agent ON ai_chats(agent_id);
CREATE INDEX idx_ai_chats_user ON ai_chats(user_id);

-- ==========================================
-- FAVORITES (избранные тренды)
-- ==========================================

CREATE TABLE favorites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    trend_id UUID REFERENCES trends(id) ON DELETE CASCADE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT unique_user_favorite UNIQUE(user_id, trend_id)
);

CREATE INDEX idx_favorites_user ON favorites(user_id);
CREATE INDEX idx_favorites_trend ON favorites(trend_id);

-- ==========================================
-- DOCUMENTS (документы проектов)
-- ==========================================

CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,

    title VARCHAR(255) NOT NULL,
    doc_type VARCHAR(50), -- research, specification, design, code, report
    content TEXT,
    file_url TEXT,
    mime_type VARCHAR(100),

    -- Versioning
    version INTEGER DEFAULT 1,
    parent_id UUID REFERENCES documents(id) ON DELETE SET NULL,

    -- AI Generated
    generated_by_ai BOOLEAN DEFAULT false,
    ai_agent_id UUID REFERENCES ai_agents(id) ON DELETE SET NULL,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_documents_project ON documents(project_id);
CREATE INDEX idx_documents_type ON documents(doc_type);

-- ==========================================
-- ANALYTICS (аналитика использования)
-- ==========================================

CREATE TABLE analytics_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    event_type VARCHAR(100) NOT NULL,
    event_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_analytics_user ON analytics_events(user_id);
CREATE INDEX idx_analytics_type ON analytics_events(event_type);
CREATE INDEX idx_analytics_created ON analytics_events(created_at DESC);

-- ==========================================
-- FUNCTIONS & TRIGGERS
-- ==========================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updated_at
CREATE TRIGGER update_trends_updated_at BEFORE UPDATE ON trends
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_tasks_updated_at BEFORE UPDATE ON project_tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_chats_updated_at BEFORE UPDATE ON ai_chats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- INITIAL DATA
-- ==========================================

-- Categories
INSERT INTO trend_categories (name, description, icon) VALUES
    ('Technology', 'Tech innovations and software trends', 'laptop'),
    ('AI & ML', 'Artificial Intelligence and Machine Learning', 'brain'),
    ('Business', 'Business models and entrepreneurship', 'briefcase'),
    ('Healthcare', 'Health and wellness trends', 'heart'),
    ('Finance', 'FinTech and financial services', 'dollar-sign'),
    ('E-commerce', 'Online retail and marketplaces', 'shopping-cart'),
    ('Education', 'EdTech and learning platforms', 'book'),
    ('Sustainability', 'Green tech and eco-friendly solutions', 'leaf'),
    ('Entertainment', 'Media and entertainment industry', 'film'),
    ('Social', 'Social networks and community platforms', 'users');

-- AI Agents
INSERT INTO ai_agents (name, agent_type, description, system_prompt, capabilities) VALUES
    (
        'Trend Analyzer',
        'trend_analyzer',
        'Анализирует тренды и выявляет закономерности',
        'Ты эксперт по анализу трендов. Твоя задача - анализировать данные о трендах, выявлять причинно-следственные связи и прогнозировать развитие. Используй данные об инвестициях, поисковых запросах и социальных сетях для комплексного анализа.',
        ARRAY['trend_analysis', 'pattern_recognition', 'forecasting']
    ),
    (
        'Market Researcher',
        'market_researcher',
        'Исследует рынок и анализирует конкурентов',
        'Ты эксперт по исследованию рынка. Анализируй размер рынка, конкурентов, ценообразование и находи возможности. Выявляй пробелы на рынке и рекомендуй стратегии входа.',
        ARRAY['market_analysis', 'competitor_research', 'pricing_strategy']
    ),
    (
        'Pain Point Detector',
        'pain_point_detector',
        'Выявляет болевые точки аудитории',
        'Ты эксперт по анализу потребностей пользователей. Изучай отзывы, комментарии и обсуждения, чтобы выявить настоящие проблемы людей. Определяй, за что они готовы платить.',
        ARRAY['sentiment_analysis', 'user_research', 'problem_identification']
    ),
    (
        'Product Strategist',
        'product_strategist',
        'Разрабатывает продуктовые стратегии',
        'Ты эксперт по продуктовой стратегии. На основе исследования рынка и болевых точек создавай рекомендации по продукту, ценообразованию и позиционированию.',
        ARRAY['product_strategy', 'pricing', 'positioning', 'mvp_planning']
    ),
    (
        'Developer Assistant',
        'developer',
        'Помогает в разработке и архитектуре',
        'Ты опытный разработчик. Помогай с выбором технологий, проектированием архитектуры и написанием кода. Давай практичные советы и следуй best practices.',
        ARRAY['coding', 'architecture', 'tech_stack_selection']
    ),
    (
        'Marketing Strategist',
        'marketing',
        'Создает маркетинговые стратегии',
        'Ты эксперт по маркетингу. Разрабатывай стратегии продвижения, определяй каналы привлечения и создавай контент-планы.',
        ARRAY['marketing_strategy', 'content_planning', 'channel_selection']
    ),
    (
        'Sales Expert',
        'sales',
        'Разрабатывает стратегии продаж',
        'Ты эксперт по продажам. Помогай с воронкой продаж, ценообразованием и стратегиями конверсии.',
        ARRAY['sales_strategy', 'conversion_optimization', 'pricing']
    );

COMMENT ON TABLE trends IS 'Собранные тренды из различных источников';
COMMENT ON TABLE trend_sources IS 'Источники данных о трендах (Google, Reddit, YouTube, etc.)';
COMMENT ON TABLE investments IS 'Инвестиционные данные по трендам';
COMMENT ON TABLE market_research IS 'Результаты исследования рынка для трендов';
COMMENT ON TABLE projects IS 'Пользовательские проекты на основе трендов';
COMMENT ON TABLE project_tasks IS 'Задачи проектов с недельным планированием';
COMMENT ON TABLE ai_chats IS 'История чатов с AI агентами';
COMMENT ON TABLE documents IS 'Документы проектов (исследования, спецификации, код)';
COMMENT ON TABLE favorites IS 'Избранные тренды пользователей';
