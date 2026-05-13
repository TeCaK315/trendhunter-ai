import type { TranslatedBlockOutput, S2Specific } from '@/types/strategy-translated'
import { TopNav, Hero, Section, WhatYouDoBlock, AgentCard, HonestBlock, BridgeBlock, CtaButton, ActionItem } from './shared'

interface S2BlockProps {
  translated: TranslatedBlockOutput
  niche_title: string
  onNext: () => void
}

export default function S2Block({ translated, niche_title, onNext }: S2BlockProps) {
  const spec = translated.specific as S2Specific
  const cf = spec.core_feature
  const nov1 = spec.not_in_v1 ?? []
  const assets = spec.ready_assets ?? []
  const cost = spec.estimated_cost

  return (
    <div className="strategy-partner-ui"><div className="page">
      <TopNav blockId="S2" blockName="V1 Продукт" current={3} total={5} />
      <Hero framework="Product v1" niche={niche_title} title={translated.headline ?? ''} story={translated.opening_story ?? ''} />

      <Section label="Одна функция которую ты строишь первой">
        <div className="insight">
          <div className="insight-kicker">Ядро V1 Продукта</div>
          <div className="insight-quote">{cf?.name ?? ''}</div>
          <div className="insight-usage">
            <div className="insight-usage-item">
              <div className="insight-usage-label">Что это делает</div>
              <div className="insight-usage-text">{cf?.description ?? ''}</div>
            </div>
            <div className="insight-usage-item">
              <div className="insight-usage-label">Почему именно эта функция</div>
              <div className="insight-usage-text">{cf?.why_this_one ?? ''}</div>
            </div>
          </div>
        </div>
      </Section>

      <Section label="Почему этого достаточно для v1" dot="mid">
        <div className="story">
          <div className="story-body"><p>{translated.why_it_works ?? ''}</p></div>
        </div>
      </Section>

      {nov1.length > 0 && (
        <Section label="Что НЕ делаем в v1 (и почему)" dot="warn">
          <div className="action">
            <div className="action-head">Сознательный отказ — главная защита от перегруза</div>
            <div className="action-sub">V1 — это минимум который доказывает концепт. Остальное ждёт.</div>
            <div className="action-grid">
              {nov1.map((n, i) => (
                <ActionItem key={i} kind="fallback" icon="✕" label="Выброшено">
                  <>
                    <strong>{n.what ?? ''}</strong>
                    <br />
                    <small>{n.why ?? ''}</small>
                  </>
                </ActionItem>
              ))}
            </div>
          </div>
        </Section>
      )}

      <Section label="Первый шаг в разработке">
        <div className="action">
          <div className="action-head">Что делаешь в понедельник утром</div>
          <div className="action-sub">Не теория — конкретное действие с указанием инструментов.</div>
          <div className="action-grid">
            <ActionItem kind="do" icon="▶" label="Первый шаг" text={spec.first_build_step ?? ''} />
          </div>
          {assets.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div className="action-head" style={{ fontSize: 15, marginBottom: 12 }}>Готовые ассеты чтобы не писать с нуля</div>
              <div className="action-grid">
                {assets.map((a, i) => (
                  <ActionItem key={i} kind="goal" icon="✓" label={a.name ?? ''}>
                    <>
                      {a.purpose ?? ''}
                      <br /><small style={{ color: '#5DCAA5' }}>Стоимость: {a.cost ?? ''}</small>
                    </>
                  </ActionItem>
                ))}
              </div>
            </div>
          )}
        </div>
      </Section>

      <Section label="Сколько это стоит и сколько занимает" dot="mid">
        <div className="numbers">
          <div className="numbers-head">Оценка V1 разработки</div>
          {cost?.context && <div className="numbers-sub">{cost.context}</div>}
          <div className="numbers-grid">
            <div className="num-row">
              <div className="num-metric">${cost?.amount ?? ''}</div>
              <div className="num-translation">
                <strong>общий бюджет</strong> на первую версию. Включает: подписки, домен, hosting, API.
              </div>
              <div className="num-compare">Без зарплат — ты собираешь сам с AI помощниками</div>
            </div>
            <div className="num-row">
              <div className="num-metric">{cost?.time_weeks ?? ''}</div>
              <div className="num-translation">
                <strong>срок разработки</strong> при 10-20 часах в неделю. Реальный таймлайн соло-founder с AI.
              </div>
              <div className="num-compare">Традиционная команда: 3-6 месяцев</div>
            </div>
          </div>
        </div>
      </Section>

      <Section label="Твоя работа над V1">
        <WhatYouDoBlock head="От идеи — к работающему MVP" data={translated.what_you_do} />
      </Section>

      <Section label="Твой AI помощник для V1 разработки" dot="purple">
        <AgentCard data={translated.ai_agent_card} />
      </Section>

      <Section label="Честно: где разработка может забуксовать" dot="warn">
        <HonestBlock title="Риски V1 разработки" body={translated.honest_limitation ?? ''} />
      </Section>

      <Section label="Мостик к следующему блоку">
        <BridgeBlock label="Далее · S3" nextTitle="Первые 10 клиентов — как их получить" body={translated.bridge_to_next ?? ''} />
      </Section>

      <CtaButton
        helper="Подтверди V1 продукт — и перейдём к привлечению клиентов"
        text="Принять V1 и перейти к S3"
        meta={['Блок 3 из 5', 'Следующий — S3 · Первые 10 клиентов']}
        onClick={onNext}
      />
    </div></div>
  )
}
