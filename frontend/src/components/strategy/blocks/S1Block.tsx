import type { TranslatedBlockOutput, S1Specific } from '@/types/strategy-translated'
import { TopNav, Hero, Section, WhatYouDoBlock, NumbersBlock, AgentCard, HonestBlock, BridgeBlock, CtaButton, ActionItem } from './shared'

interface S1BlockProps {
  translated: TranslatedBlockOutput
  niche_title: string
  onNext: () => void
}

export default function S1Block({ translated, niche_title, onNext }: S1BlockProps) {
  const spec = translated.specific as S1Specific
  const portrait = spec.client_portrait
  const fq = spec.filter_questions ?? []
  const pp = spec.price_point

  return (
    <div className="strategy-partner-ui"><div className="page">
      <TopNav blockId="S1" blockName="Первый клиент" current={2} total={5} />
      <Hero framework="Customer profile" niche={niche_title} title={translated.headline ?? ''} story={translated.opening_story ?? ''} />

      <Section label="Твой первый клиент — живой портрет">
        <div className="insight">
          <div className="insight-kicker">Кто он конкретно</div>
          <div className="insight-quote">{portrait?.who ?? ''}</div>
          <div className="insight-usage">
            <div className="insight-usage-item">
              <div className="insight-usage-label">В какой момент ищет решение</div>
              <div className="insight-usage-text">{portrait?.when_searching ?? ''}</div>
            </div>
            <div className="insight-usage-item">
              <div className="insight-usage-label">Где его найти</div>
              <div className="insight-usage-text">{portrait?.where_to_find ?? ''}</div>
            </div>
          </div>
        </div>
      </Section>

      <Section label="Что заставляет его начать искать" dot="mid">
        <div className="story">
          <div className="story-head">Триггер — момент когда он готов платить</div>
          <div className="story-body">
            <p>{portrait?.pain_moment ?? ''}</p>
            <div className="story-conclusion">
              <strong>Триггер:</strong> {spec.primary_trigger ?? ''}
            </div>
          </div>
        </div>
      </Section>

      <Section label="Почему именно этот клиент" dot="mid">
        <div className="story">
          <div className="story-body"><p>{translated.why_it_works ?? ''}</p></div>
        </div>
      </Section>

      <Section label="3 вопроса чтобы отличить подходящего от неподходящего" dot="purple">
        <div className="action">
          <div className="action-head">Задай эти 3 вопроса в первом разговоре</div>
          <div className="action-sub">Не все клиенты — твои. Эти вопросы помогут быстро отсечь тех кому не подойдёт.</div>
          <div className="action-grid">
            {[0, 1, 2].map((i) => {
              const q = fq[i]
              if (!q) return null
              const kinds = ['do', 'goal', 'check'] as const
              return (
                <ActionItem key={i} kind={kinds[i]} icon={String(i + 1)} label={`Вопрос ${i + 1}`}>
                  <>
                    <strong>{q.question ?? ''}</strong>
                    <br /><br />
                    ✔ Подходящий ответ: <em>{q.qualifying_answer ?? ''}</em>
                    <br />
                    <small style={{ color: '#A3A3A1' }}>{q.why_matters ?? ''}</small>
                  </>
                </ActionItem>
              )
            })}
          </div>
        </div>
      </Section>

      <Section label="Сколько он готов платить">
        <div className="numbers">
          <div className="numbers-head">Ценовая точка для твоего клиента</div>
          {pp?.explanation && <div className="numbers-sub">{pp.explanation}</div>}
          <div className="numbers-grid">
            <div className="num-row">
              <div className="num-metric">${pp?.monthly ?? ''}</div>
              <div className="num-translation">
                <strong>в месяц</strong> — рекомендуемая ценовая точка для первых 10 клиентов.
              </div>
              <div className="num-compare">{pp?.comparison ?? ''}</div>
            </div>
          </div>
        </div>
      </Section>

      <Section label="Что делаешь с этим портретом">
        <WhatYouDoBlock head="От портрета — к первому разговору" data={translated.what_you_do} />
      </Section>

      <Section label="Данные по твоему клиенту" dot="mid">
        <NumbersBlock head="Метрики под этот профиль" rows={translated.your_numbers ?? []} />
      </Section>

      <Section label="Твой AI помощник для этого блока" dot="purple">
        <AgentCard data={translated.ai_agent_card} />
      </Section>

      <Section label="Честно: где этот портрет может не сработать" dot="warn">
        <HonestBlock title="Сценарии для внимания" body={translated.honest_limitation ?? ''} />
      </Section>

      <Section label="Мостик к следующему блоку">
        <BridgeBlock label="Далее · S2" nextTitle="V1 Продукт — что именно строить" body={translated.bridge_to_next ?? ''} />
      </Section>

      <CtaButton
        helper="Подтверди портрет клиента — и перейдём к продукту"
        text="Принять портрет и перейти к S2"
        meta={['Блок 2 из 5', 'Следующий — S2 · V1 Продукт']}
        onClick={onNext}
      />
    </div></div>
  )
}
