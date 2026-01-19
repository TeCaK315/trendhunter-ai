/**
 * Product Templates Index
 *
 * Шаблоны для генерации различных типов продуктов:
 * - Landing + Waitlist - лендинг со сбором email
 * - SaaS Dashboard - базовое SaaS приложение с авторизацией
 * - AI Wrapper - обёртка над AI API с интерфейсом
 * - E-commerce - базовый магазин с каталогом
 */

export type ProductType = 'landing' | 'saas' | 'ai-wrapper' | 'ecommerce';

export interface ProductTemplate {
  id: ProductType;
  name: string;
  description: string;
  icon: string;
  features: string[];
  techStack: string[];
  estimatedTime: string;
  complexity: 'low' | 'medium' | 'high';
}

export const productTemplates: ProductTemplate[] = [
  {
    id: 'landing',
    name: 'Landing + Waitlist',
    description: 'Лендинг с формой сбора email и интеграцией с базой данных',
    icon: '🚀',
    features: [
      'Hero секция с CTA',
      'Features секция',
      'Форма сбора email',
      'Хранение в Supabase',
      'Email уведомления',
      'Аналитика конверсий',
    ],
    techStack: ['Next.js', 'Tailwind CSS', 'Supabase', 'Resend'],
    estimatedTime: '1-2 дня',
    complexity: 'low',
  },
  {
    id: 'saas',
    name: 'SaaS Dashboard',
    description: 'Полноценное SaaS приложение с авторизацией и дашбордом',
    icon: '📊',
    features: [
      'Авторизация (OAuth)',
      'Личный кабинет',
      'Dashboard с метриками',
      'Настройки профиля',
      'Billing (Stripe)',
      'API для интеграций',
    ],
    techStack: ['Next.js', 'Tailwind CSS', 'Supabase Auth', 'Stripe', 'Prisma'],
    estimatedTime: '1-2 недели',
    complexity: 'medium',
  },
  {
    id: 'ai-wrapper',
    name: 'AI Wrapper',
    description: 'Интерфейс для AI модели с историей чатов и настройками',
    icon: '🤖',
    features: [
      'Чат интерфейс',
      'История диалогов',
      'Streaming ответов',
      'Выбор модели',
      'Системные промпты',
      'Экспорт чатов',
    ],
    techStack: ['Next.js', 'Tailwind CSS', 'OpenAI API', 'Supabase'],
    estimatedTime: '3-5 дней',
    complexity: 'medium',
  },
  {
    id: 'ecommerce',
    name: 'E-commerce Lite',
    description: 'Минималистичный магазин с каталогом и корзиной',
    icon: '🛒',
    features: [
      'Каталог товаров',
      'Страница товара',
      'Корзина',
      'Checkout (Stripe)',
      'История заказов',
      'Админ панель',
    ],
    techStack: ['Next.js', 'Tailwind CSS', 'Stripe', 'Supabase'],
    estimatedTime: '1-2 недели',
    complexity: 'high',
  },
];

export function getTemplate(type: ProductType): ProductTemplate | undefined {
  return productTemplates.find(t => t.id === type);
}
