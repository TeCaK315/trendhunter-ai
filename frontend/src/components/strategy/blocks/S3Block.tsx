import type { TranslatedBlockOutput, S3Specific } from '@/types/strategy-translated'
import { TopNav, Hero, Section, WhatYouDoBlock, AgentCard, HonestBlock, BridgeBlock, CtaButton, ActionItem } from './shared'

interface S3BlockProps {
  translated: TranslatedBlockOutput
  niche_title: string
  onNext: () => void
}

export default function S3Block({ translated, niche_title, onNext }: S3BlockProps) {
  const spec = translated.specific as S3Specific
  const ch = spec.channel
  const fm = spec.first_message
  const dbd = spec.day_by_day ?? []
  const pc = spec.price_conversation
  const ks = spec.kill_switch

  return (
    <div className="strategy-partner-ui"><div className="page">
      <TopNav blockId="S3" blockName="Первые 10 клиентов" current={4} total={5} />
      <Hero framework="Go-to-market" niche={niche_title} title={translated.headline ?? ''} story={translated.opening_story ?? ''} />

      <Section label="Твой основной канал">
        <div className="insight">
          <div className="insight-kicker">Канал для первых 10 клиентов</div>
          <div className="insight-quote">{ch?.human_name ?? ''}</div>
          <div className="insight-usage">
            <div className="insight-usage-item">
              <div className="insight-usage-label">Где именно</div>
              <div className="insight-usage-text">{ch?.where_exactly ?? ''}</div>
            </div>
            <div className="insight-usage-item">
              <div className="insight-usage-label">Почему именно этот</div>
              <div className="insight-usage-text">{ch?.why_this_one ?? ''}</div>
            </div>
          </div>
        </div>
      </Section>

      <Section label="Почему этот канал сработает для тебя" dot="mid">
        <div className="story">
          <div className="story-body"><p>{translated.why_it_works ?? ''}</p></div>
        </div>
      </Section>

      {fm && (
        <Section label="Твой первый скрипт — копируй и отправляй" dot="purple">
          <div className="action">
            <div className="action-head">Дословный текст первого сообщения</div>
            <div className="action-sub">Не «пример» — готовый к отправке текст. Подставь имя клиента и детали, отправь.</div>
            <div className="script-box">
              <div className="script-label">First message template</div>
              <div className="script-text">{fm.text ?? ''}</div>
              <div className="script-copy">Нажми Copy в Роадмапе чтобы скопировать</div>
            </div>
            <div className="action-grid" style={{ marginTop: 16 }}>
              <ActionItem kind="goal" icon="⏰" label="Когда отправлять" text={fm.when_to_send ?? ''} />
              <ActionItem kind="check" icon="✎" label="Как адаптировать под ситуацию" text={fm.how_to_adapt ?? ''} />
            </div>
          </div>
        </Section>
      )}

      {dbd.length > 0 && (
        <Section label="План на 14 дней — день за днём">
          <div className="action">
            <div className="action-head">Контрольные точки в первые 2 недели</div>
            <div className="action-sub">Каждая точка — конкретное действие утром с целевой метрикой.</div>
            <div className="day-plan">
              {dbd.map((d, i) => (
                <div key={i} className="day-row">
                  <div className="day-label">{d.day ?? ''}</div>
                  <div className="day-content">
                    <div className="day-action">{d.action ?? ''}</div>
                    <div className="day-target">Цель: <strong>{d.target ?? ''}</strong> · Ожидается: {d.expected ?? ''}</div>
                    {d.if_below && <div className="day-fallback">Если ниже: {d.if_below}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Section>
      )}

      {pc && (
        <Section label="Что сказать о цене в разговоре" dot="mid">
          <div className="numbers">
            <div className="numbers-head">Стратегия ценового разговора</div>
            <div className="numbers-grid">
              <div className="num-row">
                <div className="num-metric">{pc.standard_price ?? ''}</div>
                <div className="num-translation"><strong>стандартная цена</strong> — для публичного упоминания.</div>
                <div className="num-compare">для публичного упоминания</div>
              </div>
              <div className="num-row">
                <div className="num-metric">{pc.launch_price ?? ''}</div>
                <div className="num-translation"><strong>стартовая цена</strong> — для первых 10 клиентов.</div>
                <div className="num-compare">private price, не публикуется</div>
              </div>
            </div>
            <div className="script-box" style={{ marginTop: 18 }}>
              <div className="script-label">Что сказать когда спросят о цене</div>
              <div className="script-text">{pc.what_to_say ?? ''}</div>
            </div>
            <div style={{ marginTop: 12, padding: '12px 16px', background: 'rgba(29,158,117,0.06)', borderRadius: 10, fontSize: 13, color: '#E5E5E4', lineHeight: 1.55 }}>
              <strong style={{ color: '#5DCAA5' }}>Когда поднимать цену:</strong> {pc.when_to_raise ?? ''}
            </div>
          </div>
        </Section>
      )}

      {ks && (
        <Section label="Kill switch — когда признать что канал не работает" dot="warn">
          <HonestBlock title="Сигнал остановиться и поменять подход" body={(
            <>
              <strong>Триггер:</strong> {ks.metric_human ?? ''} ({ks.threshold ?? ''}) {ks.time_window ?? ''}
              <br /><br />
              <strong>Что делать если сработал:</strong> {ks.what_to_do_then ?? ''}
            </>
          )} />
        </Section>
      )}

      <Section label="Что делаешь с этим каналом">
        <WhatYouDoBlock head="Твоя работа по привлечению первых 10" data={translated.what_you_do} />
      </Section>

      <Section label="Твой AI помощник для этого блока" dot="purple">
        <AgentCard data={translated.ai_agent_card} />
      </Section>

      <Section label="Другие сценарии для внимания" dot="warn">
        <HonestBlock title="Что ещё может пойти не так" body={translated.honest_limitation ?? ''} />
      </Section>

      <Section label="Мостик к следующему блоку">
        <BridgeBlock label="Далее · S5" nextTitle="Путь к деньгам — когда появятся платежи" body={translated.bridge_to_next ?? ''} />
      </Section>

      <CtaButton
        helper="Принимай канал и скрипт — перейдём к пути к деньгам"
        text="Принять канал и перейти к S5"
        meta={['Блок 4 из 5', 'Последний — S5 · Путь к деньгам']}
        onClick={onNext}
      />
    </div></div>
  )
}
