// Выгрузка только Блока 6 (Слепые пятна) + Блока 7 (AI Синтез) для одного тренда.
// Запуск: node scripts/export-block6-7.js <trend-id>

const {createClient} = require('@supabase/supabase-js');
require('dotenv').config({path:'.env.local'});
const fs = require('fs');
const path = require('path');

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const tid = process.argv[2] || 'trend-1775666689411-1';

  // Все источники сразу — параллельно
  const [block6Res, synthRes, interpsRes] = await Promise.all([
    sb.from('block_results').select('*').eq('trend_id', tid).eq('block_number', 6).maybeSingle(),
    sb.from('synthesis_results').select('*').eq('trend_id', tid).order('created_at', {ascending: false}).limit(1).maybeSingle(),
    sb.from('block_interpretations').select('*').eq('trend_id', tid).in('block_id', ['blind_spots', 'synthesis']),
  ]);

  const block6 = block6Res.data;
  const synth = synthRes.data;
  const interpByBlockId = {};
  for (const i of (interpsRes.data || [])) interpByBlockId[i.block_id] = i;

  const niche = block6?.block_context?.niche || synth?.niche || tid;

  const lines = [];
  const p = (s = '') => lines.push(s);

  const renderInterpretation = (interp, label) => {
    if (!interp) {
      p(`> ⚠️ Interpretation Layer для **${label}** ещё не сгенерирован.`);
      p('');
      return;
    }
    p('### 💬 Interpretation Layer');
    p('');
    p('> **' + interp.headline + '**');
    p('');
    p(interp.main_insight);
    p('');
    if (Array.isArray(interp.key_facts) && interp.key_facts.length) {
      for (const fact of interp.key_facts) p('- ◆ ' + fact);
      p('');
    }
    if (interp.decision_impact) {
      p('**' + (label === 'synthesis' ? 'Что делать сейчас' : 'Для твоего решения') + ':** ' + interp.decision_impact);
      p('');
    }
    p('_Сгенерировано: ' + (interp.model_used || 'unknown') + ' · ' + new Date(interp.generated_at).toISOString().slice(0, 10) + ' · качество данных: ' + (interp.data_sufficiency || '—') + '_');
    p('');
  };

  // ── HEADER ──────────────────────────────────────────
  p('# Блоки 6 и 7 — анализ тренда: ' + niche);
  p('');
  p('**Trend ID:** `' + tid + '`');
  p('**Дата выгрузки:** ' + new Date().toISOString().slice(0, 10));
  p('**Источники:** Supabase `block_results` (block 6) + `synthesis_results` (block 7) + `block_interpretations`');
  p('');
  p('---');
  p('');

  // ══════════════════════════════════════════════════════════
  // БЛОК 6 — СЛЕПЫЕ ПЯТНА
  // ══════════════════════════════════════════════════════════
  p('## 🕳️ Блок 6 — Слепые пятна (Blind Spots v2)');
  p('');

  if (!block6) {
    p('> ⚠️ Блок 6 ещё не запускался для этого тренда.');
    p('');
  } else {
    p(`**Diagnosis:** \`${block6.diagnosis}\` &nbsp;&nbsp; **Score:** ${block6.score} &nbsp;&nbsp; **Conflict weight:** ${block6.conflict_weight}`);
    p('');
    if (block6.key_metric) { p('**Ключевая метрика:** ' + block6.key_metric); p(''); }

    renderInterpretation(interpByBlockId.blind_spots, 'blind_spots');

    // Список пятен из raw_data
    const spots = block6.raw_data?.spots ?? [];
    if (spots.length > 0) {
      p('### Найденные слепые пятна');
      p('');
      spots.forEach((spot, i) => {
        const typeRu =
          spot.type === 'STRUCTURAL' ? 'Структурная проблема'
          : spot.type === 'CONTRADICTION' ? 'Противоречие в данных'
          : spot.type === 'BEHAVIORAL' ? 'Поведенческий паттерн'
          : spot.type === 'TIMING' ? 'Фактор времени'
          : spot.type === 'UNKNOWN' ? 'Неожиданный сигнал'
          : spot.type;
        const impactRu =
          (spot.impact || '').toUpperCase() === 'HIGH' ? 'Высокий риск'
          : (spot.impact || '').toUpperCase() === 'MEDIUM' ? 'Средний риск'
          : 'Низкий риск';

        p(`#### Пятно #${i + 1} — ${spot.title || 'Без названия'}`);
        p('');
        p(`**Тип:** ${typeRu} &nbsp;&nbsp; **Серьёзность:** ${impactRu}`);
        p('');
        if (spot.insight) {
          p('**Инсайт:**');
          p('');
          p('> ' + String(spot.insight).split('\n').join('\n> '));
          p('');
        }
        if (spot.action) {
          p('**→ Что делать:** ' + spot.action);
          p('');
        }
        if (Array.isArray(spot.data_signals) && spot.data_signals.length) {
          p('**Данные-сигналы:**');
          for (const sig of spot.data_signals) p('- ' + sig);
          p('');
        }
        if (Array.isArray(spot.depends_on_blocks) && spot.depends_on_blocks.length) {
          p('_На основе данных блоков ' + spot.depends_on_blocks.join(', ') + '_');
          p('');
        }
        p('---');
        p('');
      });
    }

    // Unknown mode (если активен)
    if (block6.raw_data?.mode === 'unknown' && block6.raw_data?.unknown_data) {
      const u = block6.raw_data.unknown_data;
      p('### ⚠️ UNKNOWN mode');
      p('');
      if (u.reason) { p(u.reason); p(''); }
      if (Array.isArray(u.questions) && u.questions.length) {
        p('**Открытые вопросы:**');
        for (const q of u.questions) p('- ' + q);
        p('');
      }
      if (u.bet_frame) { p('_' + u.bet_frame + '_'); p(''); }
    }

    // Контекст
    if (block6.block_context) {
      p('<details><summary>📋 block_context (raw)</summary>');
      p('');
      p('```json');
      p(JSON.stringify(block6.block_context, null, 2));
      p('```');
      p('');
      p('</details>');
      p('');
    }
    if (block6.raw_data) {
      p('<details><summary>📦 raw_data (полный pipeline)</summary>');
      p('');
      p('```json');
      p(JSON.stringify(block6.raw_data, null, 2));
      p('```');
      p('');
      p('</details>');
      p('');
    }
  }

  p('---');
  p('');

  // ══════════════════════════════════════════════════════════
  // БЛОК 7 — AI СИНТЕЗ
  // ══════════════════════════════════════════════════════════
  p('## 🧠 Блок 7 — AI Синтез (Skeptic / Optimist / Arbitrator)');
  p('');

  if (!synth) {
    p('> ⚠️ AI Синтез для этого тренда ещё не запускался.');
    p('');
  } else {
    const arb = synth.arbitrator || {};
    p(`**Verdict type:** \`${arb.verdict_type || '—'}\``);
    p(`**Confidence:** ${arb.confidence != null ? Math.round(arb.confidence * 100) + '%' : '—'}`);
    p(`**Создан:** ${synth.created_at}`);
    p(`**Режим Blind Spot:** ${synth.is_blind_spot ? '✅ да (Skeptic = Opus)' : '— нет (Skeptic = Sonnet)'}`);
    p('');

    renderInterpretation(interpByBlockId.synthesis, 'synthesis');

    // Вердикт арбитра
    p('### 🎯 Вердикт арбитра');
    p('');
    if (arb.verdict_reasoning) {
      p('**Обоснование:**');
      p('');
      p('> ' + String(arb.verdict_reasoning).split('\n').join('\n> '));
      p('');
    }
    if (arb.verdict_condition) {
      p('**Условие:** ' + arb.verdict_condition);
      p('');
    }
    if (arb.bridge_text || synth.bridge_text) {
      p('**Мост к Strategy:**');
      p('');
      p('> ' + String(arb.bridge_text || synth.bridge_text).split('\n').join('\n> '));
      p('');
    }
    if (Array.isArray(arb.priority_actions) && arb.priority_actions.length) {
      p('### Приоритетные действия');
      p('');
      arb.priority_actions.forEach((a, i) => {
        p(`**${i + 1}. ${a.action || '?'}**`);
        if (a.timeline) p(`_Сроки: ${a.timeline}_`);
        if (a.addresses) p(`_Адресует: ${a.addresses}_`);
        p('');
      });
    }
    if (Array.isArray(arb.confidence_factors) && arb.confidence_factors.length) {
      p('### Факторы уверенности');
      p('');
      for (const f of arb.confidence_factors) p('- ' + (typeof f === 'string' ? f : JSON.stringify(f)));
      p('');
    }

    // Strategic Delta
    if (synth.strategic_delta) {
      const d = synth.strategic_delta;
      p('### 📈 Strategic Delta');
      p('');
      if (d.show === false) {
        p('> Не показывается (`show: false`).');
        p('');
      } else {
        if (d.standard_path && d.strategic_path) {
          p('| Параметр | Standard | Strategic |');
          p('|---|---|---|');
          p(`| Revenue/год | $${(d.standard_path.revenue_annual ?? 0).toLocaleString()} | $${(d.strategic_path.revenue_annual ?? 0).toLocaleString()} |`);
          p(`| Месяцев до выручки | ${d.standard_path.months_to_revenue ?? '—'} | ${d.strategic_path.months_to_revenue ?? '—'} |`);
          p(`| Вероятность успеха | ${Math.round((d.standard_path.success_probability ?? 0) * 100)}% | ${Math.round((d.strategic_path.success_probability ?? 0) * 100)}% |`);
          p('');
        }
        if (d.delta_revenue != null) p(`**Δ Revenue:** $${(d.delta_revenue).toLocaleString()}/год`);
        if (d.delta_months != null) p(`**Δ Время:** ${d.delta_months} мес`);
        if (d.delta_probability != null) p(`**Δ Вероятность:** +${Math.round(d.delta_probability * 100)}%`);
        if (d.uplift_multiplier != null) p(`**Uplift multiplier:** ×${d.uplift_multiplier}`);
        p('');
        if (Array.isArray(d.gap_drivers) && d.gap_drivers.length) {
          p('**Gap drivers:**');
          for (const g of d.gap_drivers) {
            const title = typeof g === 'string' ? g : (g.title || '?');
            const src = typeof g === 'object' ? (g.source || '') : '';
            p('- ◆ ' + title + (src && src !== 'generic' ? ` _(${src})_` : ''));
          }
          p('');
        }
        if (d.verdict_frame) { p('**Verdict frame:** ' + d.verdict_frame); p(''); }
        if (d.cta_text) { p('**CTA:** ' + d.cta_text); p(''); }
      }
    }

    // Sales Architect
    if (synth.sales_text) {
      p('### 💼 Sales Architect');
      p('');
      p(synth.sales_text);
      p('');
    }

    // Skeptic
    p('### 🔻 Skeptic');
    p('');
    p('<details><summary>📦 Полный JSON</summary>');
    p('');
    p('```json');
    p(JSON.stringify(synth.skeptic ?? {}, null, 2));
    p('```');
    p('');
    p('</details>');
    p('');

    // Optimist
    p('### 🔺 Optimist');
    p('');
    p('<details><summary>📦 Полный JSON</summary>');
    p('');
    p('```json');
    p(JSON.stringify(synth.optimist ?? {}, null, 2));
    p('```');
    p('');
    p('</details>');
    p('');

    // Conflicts
    if (Array.isArray(synth.conflicts) && synth.conflicts.length) {
      p('### ⚠️ Conflict Detection');
      p('');
      for (const c of synth.conflicts) {
        p(`- **${c.type || '?'}** (weight: ${c.weight ?? '—'}) — ${c.pair || ''}: ${c.mechanism || c.description || ''}`);
      }
      p('');
    }
  }

  p('---');
  p('');
  p('_Документ сгенерирован автоматически. Все данные — снимок на момент выгрузки._');
  p('');

  const outPath = path.join('docs', 'TREND_' + tid.replace(/^trend-/, '') + '_BLOCK6_7.md');
  fs.mkdirSync('docs', {recursive: true});
  fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
  console.log('OK', outPath, lines.length, 'lines,', lines.join('\n').length, 'chars');
})();
