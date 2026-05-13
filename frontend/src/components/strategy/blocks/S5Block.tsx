import type { TranslatedBlockOutput, S5Specific } from '@/types/strategy-translated'
import { TopNav, Hero, Section, WhatYouDoBlock, AgentCard, HonestBlock, BridgeBlock, CtaButton, ActionItem } from './shared'

interface S5BlockProps {
  translated: TranslatedBlockOutput
  niche_title: string
  onNext: () => void
}

export default function S5Block({ translated, niche_title, onNext }: S5BlockProps) {
  const spec = translated.specific as S5Specific
  const tl = spec.timeline
  const ms = spec.milestones
  const calc = spec.calculator
  const act = spec.first_action_today
  const ib = spec.if_behind

  return (
    <div className="strategy-partner-ui"><div className="page">
      <TopNav blockId="S5" blockName="Путь к деньгам" current={5} total={5} />
      <Hero framework="Revenue path" niche={niche_title} title={translated.headline ?? ''} story={translated.opening_story ?? ''} />

      <Section label="Когда появятся первые деньги">
        <div className="insight">
          <div className="insight-kicker">Таймлайн до первого дохода</div>
          <div className="insight-quote">{tl?.days_to_first_revenue ?? ''} дней — {tl?.human_text ?? ''}</div>
          <div className="insight-usage">
            <div className="insight-usage-item">
              <div className="insight-usage-label">Что происходит каждую неделю</div>
              <div className="insight-usage-text">{tl?.what_happens_weekly ?? ''}</div>
            </div>
            <div className="insight-usage-item">
              <div className="insight-usage-label">Главное понимать</div>
              <div className="insight-usage-text">{translated.main_insight ?? ''}</div>
            </div>
          </div>
        </div>
      </Section>

      {ms && (
        <Section label="Вехи на 30 и 90 дней" dot="mid">
          <div className="action">
            <div className="action-head">Контрольные точки чтобы не терять направление</div>
            <div className="action-sub">Не «к концу года» — конкретные точки с измеримыми результатами.</div>
            <div className="action-grid">
              <ActionItem kind="do" icon="30" label="День 30 — первая веха">
                <>
                  <strong>{ms.day_30?.what ?? ''}</strong>
                  <br />
                  <small>Критерий успеха: {ms.day_30?.success_metric ?? ''}</small>
                </>
              </ActionItem>
              <ActionItem kind="goal" icon="90" label="День 90 — контрольная точка">
                <>
                  <strong>{ms.day_90?.what ?? ''}</strong>
                  <br />
                  <small>Критерий успеха: {ms.day_90?.success_metric ?? ''}</small>
                </>
              </ActionItem>
            </div>
          </div>
        </Section>
      )}

      {calc && (
        <Section label="Твои цифры — калькулятор дохода">
          <div className="numbers">
            <div className="numbers-head">Твоя математика выхода в доход</div>
            {calc.human_math && <div className="numbers-sub">{calc.human_math}</div>}
            <div className="numbers-grid">
              <div className="num-row">
                <div className="num-metric">${calc.monthly_price ?? ''}</div>
                <div className="num-translation"><strong>цена подписки</strong> на одного клиента в месяц</div>
                <div className="num-compare">стабильная recurring revenue</div>
              </div>
              <div className="num-row">
                <div className="num-metric">${calc.cac_real ?? ''}</div>
                <div className="num-translation"><strong>реальный CAC</strong> через выбранный канал (S3).</div>
                <div className="num-compare">ROI через 1-2 мес подписки</div>
              </div>
              <div className="num-row">
                <div className="num-metric">{calc.months_to_revenue ?? ''}</div>
                <div className="num-translation"><strong>месяцев до первого recurring дохода</strong>.</div>
                <div className="num-compare">стабильный поток с 3-го месяца</div>
              </div>
            </div>
          </div>
        </Section>
      )}

      {act && (
        <Section label="Что делаешь прямо сегодня" dot="purple">
          <div className="action">
            <div className="action-head">Первое действие — в ближайшие 2 часа</div>
            <div className="action-sub">Не «когда будет время» — именно сегодня.</div>
            <div className="action-grid">
              <ActionItem kind="do" icon="▶" label="Конкретное действие" text={act.what ?? ''} />
              <ActionItem kind="goal" icon="⏱" label="Сколько займёт" text={act.time_needed ?? ''} />
              <ActionItem kind="check" icon="✓" label="Что получить в результате" text={act.result ?? ''} />
            </div>
          </div>
        </Section>
      )}

      {ib && (
        <Section label="Если отстаёшь от плана" dot="warn">
          <HonestBlock title="Сигналы отставания и что делать" body={(
            <>
              <strong>Как понять что отстаёшь:</strong> {ib.signs ?? ''}
              <br /><br />
              <strong>Что делать:</strong> {ib.what_to_do ?? ''}
            </>
          )} />
        </Section>
      )}

      {(spec.kill_switch_date || spec.kill_switch_explanation) && (
        <Section label="Kill switch — финальная дата решения" dot="warn">
          <div className="story">
            <div className="story-head">{spec.kill_switch_date ?? ''}</div>
            <div className="story-sub">Конкретная дата когда принимаешь решение — продолжать или менять идею</div>
            <div className="story-body">
              <p>{spec.kill_switch_explanation ?? ''}</p>
              <div className="story-conclusion">
                <strong>Важно:</strong> это не дедлайн провала. Это точка рефлексии.
              </div>
            </div>
          </div>
        </Section>
      )}

      <Section label="Твоя работа по пути к деньгам">
        <WhatYouDoBlock head="От стратегии — к первым платежам" data={translated.what_you_do} />
      </Section>

      <Section label="Твой AI помощник для этого блока" dot="purple">
        <AgentCard data={translated.ai_agent_card} />
      </Section>

      <Section label="Честно: что может пойти не так по деньгам" dot="warn">
        <HonestBlock title="Риски финансового пути" body={translated.honest_limitation ?? ''} />
      </Section>

      <Section label="Стратегия готова — что дальше">
        <BridgeBlock label="Финал · Summary Card" nextTitle="Сводная карта твоей стратегии" body={translated.bridge_to_next ?? ''} />
      </Section>

      <CtaButton
        helper="Получи сводную карту — и переходи в Роадмап к действиям"
        text="Получить Summary Card"
        meta={['Блок 5 из 5', 'Стратегия готова', 'Дальше — В Роадмап']}
        onClick={onNext}
      />
    </div></div>
  )
}
