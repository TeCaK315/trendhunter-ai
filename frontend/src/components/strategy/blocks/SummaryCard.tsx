interface SummaryLines {
  version?: number
  angle?: string
  versus_them?: string
  versus_weakness?: string
  window?: string
  client_who?: string
  client_where?: string
  price_monthly?: string
  core_feature?: string
  first_build_step?: string
  estimated_amount?: string
  estimated_time?: string
  channel_name?: string
  channel_where?: string
  kill_switch?: string
  day_by_day?: Array<{ day?: string; action?: string; target?: string }>
  days_to_revenue?: string
  first_action?: string
  kill_switch_date?: string
  day_30?: string
  day_90?: string
}

interface SummaryCardData {
  niche?: string
  lines?: SummaryLines
  generated_at?: string
}

interface Props {
  data: SummaryCardData
  onRoadmap: () => void
}

const dash = (v?: string) => (v && v.length > 0 ? v : '—')

export default function SummaryCard({ data, onRoadmap }: Props) {
  const l = data.lines ?? {}
  const dbd = l.day_by_day ?? []

  return (
    <div className="strategy-partner-ui"><div className="page">
      <header className="topnav">
        <div className="nav-left">
          <div className="brand">
            <div className="brand-mark">TH</div>
            <span>TrendHunter AI</span>
          </div>
          <div className="nav-separator" />
          <div className="block-location">
            <span className="block-id">SUM</span>
            <span className="block-name">Summary Card</span>
          </div>
        </div>
        <div className="nav-right">
          <div className="progress">
            <div className="pdot done" />
            <div className="pdot done" />
            <div className="pdot done" />
            <div className="pdot done" />
            <div className="pdot done" />
            <span className="progress-text">готово ✓</span>
          </div>
        </div>
      </header>

      <section className="summary-hero">
        <div className="summary-hero-kicker">Твоя стратегия готова</div>
        <h1 className="summary-hero-title">{data.niche ?? 'Ваша ниша'}</h1>
        <p className="summary-hero-niche">{dash(l.angle)}</p>
      </section>

      <div className="summary-grid">
        <div className="summary-card">
          <div className="summary-card-head">
            <span className="summary-card-id">S0</span>
            <span className="summary-card-name">Угол атаки</span>
          </div>
          <div className="summary-card-content">
            <div className="summary-item">
              <div className="summary-item-label">Позиция</div>
              <div className="summary-item-value">{dash(l.angle)}</div>
            </div>
            <div className="summary-item">
              <div className="summary-item-label">Против кого играешь</div>
              <div className="summary-item-value"><strong>{dash(l.versus_them)}</strong> · {dash(l.versus_weakness)}</div>
            </div>
            <div className="summary-item">
              <div className="summary-item-label">Твоё окно</div>
              <div className="summary-item-value"><strong>{dash(l.window)}</strong></div>
            </div>
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-card-head">
            <span className="summary-card-id">S1</span>
            <span className="summary-card-name">Первый клиент</span>
          </div>
          <div className="summary-card-content">
            <div className="summary-item">
              <div className="summary-item-label">Кто он</div>
              <div className="summary-item-value">{dash(l.client_who)}</div>
            </div>
            <div className="summary-item">
              <div className="summary-item-label">Где искать</div>
              <div className="summary-item-value">{dash(l.client_where)}</div>
            </div>
            <div className="summary-item">
              <div className="summary-item-label">Цена</div>
              <div className="summary-item-value"><strong>${dash(l.price_monthly)}/мес</strong></div>
            </div>
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-card-head">
            <span className="summary-card-id">S2</span>
            <span className="summary-card-name">V1 Продукт</span>
          </div>
          <div className="summary-card-content">
            <div className="summary-item">
              <div className="summary-item-label">Главная функция</div>
              <div className="summary-item-value">{dash(l.core_feature)}</div>
            </div>
            <div className="summary-item">
              <div className="summary-item-label">Первый шаг</div>
              <div className="summary-item-value">{dash(l.first_build_step)}</div>
            </div>
            <div className="summary-item">
              <div className="summary-item-label">Бюджет и срок</div>
              <div className="summary-item-value"><strong>${dash(l.estimated_amount)}</strong> · {dash(l.estimated_time)}</div>
            </div>
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-card-head">
            <span className="summary-card-id">S3</span>
            <span className="summary-card-name">Первые 10 клиентов</span>
          </div>
          <div className="summary-card-content">
            <div className="summary-item">
              <div className="summary-item-label">Канал</div>
              <div className="summary-item-value"><strong>{dash(l.channel_name)}</strong></div>
            </div>
            <div className="summary-item">
              <div className="summary-item-label">Где именно</div>
              <div className="summary-item-value">{dash(l.channel_where)}</div>
            </div>
            <div className="summary-item">
              <div className="summary-item-label">Kill switch</div>
              <div className="summary-item-value">{dash(l.kill_switch)}</div>
            </div>
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-card-head">
            <span className="summary-card-id">S5</span>
            <span className="summary-card-name">Путь к деньгам</span>
          </div>
          <div className="summary-card-content" style={{ gridTemplateColumns: '1fr 1fr 1fr', display: 'grid', gap: 16 }}>
            <div className="summary-item">
              <div className="summary-item-label">Первый доход</div>
              <div className="summary-item-value"><strong>через {dash(l.days_to_revenue)} дней</strong></div>
            </div>
            <div className="summary-item">
              <div className="summary-item-label">День 30</div>
              <div className="summary-item-value">{dash(l.day_30)}</div>
            </div>
            <div className="summary-item">
              <div className="summary-item-label">Kill switch date</div>
              <div className="summary-item-value"><strong>{dash(l.kill_switch_date)}</strong></div>
            </div>
          </div>
        </div>
      </div>

      <div className="action-plan">
        <div className="action-plan-head">Первые шаги после выхода из стратегии</div>
        <div className="action-plan-sub">Что делаешь сегодня, завтра и в первые 2 недели. Конкретно.</div>
        <div className="action-plan-list">
          <div className="plan-item">
            <div className="plan-day">СЕЙЧАС</div>
            <div className="plan-action">{dash(l.first_action)}</div>
            <div className="plan-metric">—</div>
          </div>
          {[0, 1, 2, 3].map((i) => {
            const d = dbd[i]
            if (!d) return null
            return (
              <div key={i} className="plan-item">
                <div className="plan-day">{d.day ?? '—'}</div>
                <div className="plan-action">{d.action ?? '—'}</div>
                <div className="plan-metric">{d.target ?? ''}</div>
              </div>
            )
          })}
          <div className="plan-item">
            <div className="plan-day">ДЕНЬ 30</div>
            <div className="plan-action">{dash(l.day_30)}</div>
            <div className="plan-metric">—</div>
          </div>
          <div className="plan-item">
            <div className="plan-day">ДЕНЬ 90</div>
            <div className="plan-action">{dash(l.day_90)}</div>
            <div className="plan-metric">—</div>
          </div>
        </div>
      </div>

      <div className="cta-wrap">
        <div className="cta-helper">Стратегия готова. Дальше — пошаговая реализация в Роадмапе.</div>
        <button type="button" className="cta-btn" onClick={onRoadmap}>
          Открыть ЛК Роадмап
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M3 9h12M10 4l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="cta-meta">
          <span>5 блоков стратегии завершены</span>
          <span className="cta-meta-dot" />
          <span>AI помощники настроены</span>
        </div>
      </div>

      <div className="footer-note">
        Эту карту можно сохранить в PDF или распечатать. Полные блоки S0-S5 доступны в разделе Стратегия.
      </div>
    </div></div>
  )
}
