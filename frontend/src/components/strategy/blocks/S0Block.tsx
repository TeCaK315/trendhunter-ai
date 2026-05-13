import type { TranslatedBlockOutput, S0Specific } from '@/types/strategy-translated'
import { TopNav, Hero, Section, WhatYouDoBlock, NumbersBlock, AgentCard, HonestBlock, BridgeBlock, CtaButton, ActionItem } from './shared'

interface S0BlockProps {
  translated: TranslatedBlockOutput
  niche_title: string
  onNext: () => void
}

export default function S0Block({ translated, niche_title, onNext }: S0BlockProps) {
  const spec = translated.specific as S0Specific
  const vb = spec.versus_block

  return (
    <div className="strategy-partner-ui"><div className="page">
      <TopNav blockId="S0" blockName="Угол атаки" current={1} total={5} />
      <Hero framework="Positioning framework" niche={niche_title} title={translated.headline ?? ''} story={translated.opening_story ?? ''} />

      <Section label="Фраза которую ты скажешь клиенту">
        <div className="insight">
          <div className="insight-kicker">Твоя позиция в одной фразе</div>
          <div className="insight-quote">{spec.positioning_quote ?? ''}</div>
          <div className="insight-usage">
            <div className="insight-usage-item">
              <div className="insight-usage-label">Где использовать</div>
              <div className="insight-usage-text">Первое сообщение клиенту. Лендинг hero. Ответ на «чем вы отличаетесь».</div>
            </div>
            <div className="insight-usage-item">
              <div className="insight-usage-label">Как проверить что работает</div>
              <div className="insight-usage-text">Скажи живому человеку. Если переспрашивает — фраза размытая. Если «а, понятно, покажи» — ты на правильном пути.</div>
            </div>
          </div>
        </div>
      </Section>

      <Section label="Почему у тебя есть шанс выиграть" dot="mid">
        <div className="story">
          <div className="story-head">{vb?.you?.advantage ?? ''}</div>
          {translated.why_it_works_intro && <div className="story-sub">{translated.why_it_works_intro}</div>}
          <div className="story-body">
            <p>{translated.why_it_works ?? ''}</p>
            <div className="story-vs">
              <div className="vs-side them">
                <div className="vs-label">{vb?.them?.name ?? ''}</div>
                <div className="vs-name">{vb?.them?.size ?? ''}</div>
                <div className="vs-desc">{vb?.them?.weakness ?? ''}</div>
                <div className="vs-source">{vb?.them?.source ?? ''}</div>
              </div>
              <div className="vs-separator">vs</div>
              <div className="vs-side you">
                <div className="vs-label">Ты</div>
                <div className="vs-name">{vb?.you?.description ?? ''}</div>
                <div className="vs-desc">{vb?.you?.advantage ?? ''}</div>
                <div className="vs-source">{vb?.you?.window_months ?? ''}</div>
              </div>
            </div>
            <div className="story-conclusion">
              <strong>{vb?.you?.window_months ?? ''}</strong> — за это время нужно занять позицию у первых 50-100 клиентов.
            </div>
          </div>
        </div>
      </Section>

      <Section label="Что именно ты делаешь с этим углом">
        <WhatYouDoBlock head="От понимания угла — к первому действию" data={translated.what_you_do} />
      </Section>

      {spec.alternatives_rejected && spec.alternatives_rejected.length > 0 && (
        <Section label="Почему другие подходы не подошли" dot="purple">
          <div className="action">
            <div className="action-head">Мы рассмотрели альтернативы — вот почему отказались</div>
            <div className="action-sub">Каждый отвергнутый путь — с конкретной причиной из данных рынка.</div>
            <div className="action-grid">
              {spec.alternatives_rejected.map((a, i) => (
                <ActionItem key={i} kind="fallback" icon="✕" label={a.human_name ?? ''} text={a.reason ?? ''} />
              ))}
            </div>
          </div>
        </Section>
      )}

      <Section label="Данные под твоим углом — что они значат тебе" dot="mid">
        <NumbersBlock head="Цифры переведённые в действия и время" rows={translated.your_numbers ?? []} />
      </Section>

      <Section label="Твой AI помощник для этого блока" dot="purple">
        <AgentCard data={translated.ai_agent_card} />
      </Section>

      <Section label="Честно: где твой угол может не сработать" dot="warn">
        <HonestBlock title="Сценарии которые нужно мониторить" body={translated.honest_limitation ?? ''} />
      </Section>

      <Section label="Мостик к следующему блоку">
        <BridgeBlock label="Далее · S1" nextTitle="Первый клиент — кто он конкретно" body={translated.bridge_to_next ?? ''} />
      </Section>

      <CtaButton
        helper="Прими этот угол — и перейдём к твоему первому клиенту"
        text="Принять угол и перейти к S1"
        meta={['Блок 1 из 5', 'Следующий — S1 · Первый клиент']}
        onClick={onNext}
      />
    </div></div>
  )
}
