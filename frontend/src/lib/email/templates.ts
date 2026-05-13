export type EmailTriggerType = 'trial_ending' | 'discount_open' | 'discount_ending'

export interface EmailTemplateData {
  niche_title?: string
  hours_left?: number
  discount_percent?: number
  roadmap_url?: string
  unsubscribe_url?: string
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://trendhunter.ai'

const baseStyles = `
  body { margin: 0; padding: 0; background: #0A0A0A; color: #E5E5E4;
         font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
  .container { max-width: 560px; margin: 0 auto; padding: 40px 24px; }
  .card { background: #111111; border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px; padding: 32px; }
  .badge { display: inline-block; font-size: 11px; font-weight: 600;
           letter-spacing: .12em; text-transform: uppercase;
           padding: 4px 12px; border-radius: 20px; margin-bottom: 20px; }
  .badge-amber { color: #FAC775; background: rgba(250,199,117,0.12);
                 border: 1px solid rgba(250,199,117,0.3); }
  .badge-teal  { color: #5DCAA5; background: rgba(93,202,165,0.12);
                 border: 1px solid rgba(93,202,165,0.3); }
  .badge-red   { color: #F09595; background: rgba(240,149,149,0.12);
                 border: 1px solid rgba(240,149,149,0.3); }
  h1 { font-size: 24px; font-weight: 500; color: #F5F5F4;
       letter-spacing: -0.02em; margin: 0 0 12px; }
  p { font-size: 14px; color: #A3A3A1; line-height: 1.6; margin: 0 0 20px; }
  .cta { display: inline-block; padding: 12px 24px; background: #1D9E75;
         color: #ffffff; text-decoration: none; border-radius: 10px;
         font-size: 14px; font-weight: 500; margin-bottom: 24px; }
  .footer { margin-top: 24px; padding-top: 16px;
            border-top: 1px solid rgba(255,255,255,0.06);
            font-size: 12px; color: #6E6E6B; }
  .footer a { color: #6E6E6B; }
`

export function buildEmailTemplate(
  triggerType: EmailTriggerType,
  data: EmailTemplateData
): { subject: string; html: string } {
  const niche = data.niche_title ?? 'твоя ниша'
  const hours = data.hours_left ?? 24
  const discount = data.discount_percent ?? 30
  const roadmapUrl = data.roadmap_url ?? `${APP_URL}/lk/roadmap`
  const unsubUrl = data.unsubscribe_url ?? `${APP_URL}/api/unsubscribe`

  if (triggerType === 'trial_ending') {
    return {
      subject: `Твой триал TrendHunter заканчивается через ${hours} часов`,
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${baseStyles}</style></head><body>
        <div class="container">
          <div class="card">
            <span class="badge badge-amber">ТРИАЛ</span>
            <h1>Осталось ${hours} часов</h1>
            <p>Твой бесплатный доступ к Роадмапу для ниши <strong style="color:#F5F5F4">${niche}</strong> заканчивается через ${hours} часов.</p>
            <p>После окончания триала у тебя будет 48 часов чтобы продолжить со скидкой <strong style="color:#5DCAA5">−${discount}%</strong>.</p>
            <a href="${roadmapUrl}" class="cta">Продолжить работу →</a>
            <p style="font-size:13px">История чата и все метрики сохранены. AI Стратег ждёт.</p>
          </div>
          <div class="footer">TrendHunter AI · <a href="${unsubUrl}">Отписаться</a></div>
        </div>
      </body></html>`,
    }
  }

  if (triggerType === 'discount_open') {
    return {
      subject: `Скидка −${discount}% на Роадмап Pro — 48 часов`,
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${baseStyles}</style></head><body>
        <div class="container">
          <div class="card">
            <span class="badge badge-teal">СКИДКА −${discount}%</span>
            <h1>Твой триал закончился</h1>
            <p>Ты работал над нишей <strong style="color:#F5F5F4">${niche}</strong>. Продолжи со скидкой <strong style="color:#5DCAA5">−${discount}%</strong> — она действует 48 часов.</p>
            <p>AI Стратег помнит весь контекст — история чата, метрики и стратегия сохранены.</p>
            <a href="${roadmapUrl}" class="cta">Продолжить со скидкой →</a>
            <p style="font-size:13px;color:#6E6E6B">Скидка истекает через 48 часов. После — полная цена.</p>
          </div>
          <div class="footer">TrendHunter AI · <a href="${unsubUrl}">Отписаться</a></div>
        </div>
      </body></html>`,
    }
  }

  // discount_ending
  return {
    subject: `Скидка на Роадмап Pro истекает через ${hours} часов`,
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${baseStyles}</style></head><body>
      <div class="container">
        <div class="card">
          <span class="badge badge-red">ОСТАЛОСЬ ${hours} ЧАСОВ</span>
          <h1>Скидка истекает скоро</h1>
          <p>Скидка <strong style="color:#5DCAA5">−${discount}%</strong> на Роадмап Pro для ниши <strong style="color:#F5F5F4">${niche}</strong> истекает через ${hours} часов.</p>
          <p>После — только полная цена.</p>
          <a href="${roadmapUrl}" class="cta">Использовать скидку →</a>
        </div>
        <div class="footer">TrendHunter AI · <a href="${unsubUrl}">Отписаться</a></div>
      </div>
    </body></html>`,
  }
}
