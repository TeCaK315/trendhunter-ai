const {createClient} = require('@supabase/supabase-js');
require('dotenv').config({path:'.env.local'});
const fs = require('fs');
const path = require('path');

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const tid = process.argv[2] || 'trend-1775666689411-1';
  const {data: blocks, error} = await sb.from('block_results').select('*').eq('trend_id', tid).order('block_number');
  if (error) { console.error(error); process.exit(1); }
  const {data: synth} = await sb.from('synthesis_results').select('*').eq('trend_id', tid).maybeSingle();
  const {data: interps} = await sb.from('block_interpretations').select('*').eq('trend_id', tid);

  // map block_id → interpretation
  const interpByBlockId = {};
  for (const i of (interps || [])) interpByBlockId[i.block_id] = i;

  // map block_number → block_id used in interpretations
  const blockIdMap = {
    1: 'problem',
    2: 'demand',
    3: 'sellability',
    4: 'competition',
    5: 'economics',
    6: 'blind_spots',
  };

  const niche = blocks[0]?.block_context?.niche || tid;
  const titles = {
    1: '🩺 Блок 1 — Проблема (Problem)',
    2: '📈 Блок 2 — Спрос (Demand)',
    3: '💰 Блок 3 — Продаваемость (Sellability v2)',
    4: '⚔️ Блок 4 — Конкуренция (Competition)',
    5: '📊 Блок 5 — Экономика (Revenue Sizing v2)',
    6: '🕳️ Блок 6 — Слепые пятна (Blind Spots v2)',
  };

  function renderInterpretation(p, interp) {
    if (!interp) return;
    p('### 💬 Что это значит (Interpretation Layer)');
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
      p('**Что это значит для тебя:** ' + interp.decision_impact);
      p('');
    }
    p('_Сгенерировано: ' + (interp.model_used || 'unknown') + ' · ' + new Date(interp.generated_at).toISOString().slice(0,10) + ' · качество данных: ' + (interp.data_sufficiency || '—') + '_');
    p('');
  }

  const lines = [];
  const p = (s='') => lines.push(s);

  p('# Анализ тренда: ' + niche);
  p('');
  p('**Trend ID:** `' + tid + '`');
  p('**Дата выгрузки:** ' + new Date().toISOString().slice(0,10));
  p('**Источник данных:** Supabase `block_results` + `synthesis_results` + `block_interpretations`');
  p('');
  p('---');
  p('');

  // ── ГЛАВНЫЙ ВЕРДИКТ из synthesis interpretation, в самом начале ──
  if (interpByBlockId.synthesis) {
    const i = interpByBlockId.synthesis;
    p('## 🎯 Главный вердикт');
    p('');
    p('> **' + i.headline + '**');
    p('');
    p(i.main_insight);
    p('');
    if (Array.isArray(i.key_facts)) {
      for (const fact of i.key_facts) p('- ◆ ' + fact);
      p('');
    }
    if (i.decision_impact) {
      p('**Что делать сейчас:** ' + i.decision_impact);
      p('');
    }
    p('---');
    p('');
  }

  p('## Сводка по блокам');
  p('');
  p('| # | Блок | Диагноз | Score | Conflict | Ключевая метрика |');
  p('|---|------|---------|-------|----------|------------------|');
  for (const b of blocks) {
    const km = (b.key_metric || '—').toString().replace(/\|/g,'\\|').slice(0,80);
    p(`| ${b.block_number} | ${b.block_type} | ${b.diagnosis} | ${b.score} | ${b.conflict_weight ?? '—'} | ${km} |`);
  }
  p('');
  if (synth) {
    p(`**AI Синтез:** verdict=\`${synth.verdict || '—'}\`, confidence=${synth.confidence ?? '—'}%`);
  } else {
    p('**AI Синтез:** ⚠️ ещё не запускался для этого тренда');
  }
  p('');
  p('---');
  p('');

  for (const b of blocks) {
    p('## ' + (titles[b.block_number] || 'Block ' + b.block_number));
    p('');
    p(`**Diagnosis:** \`${b.diagnosis}\` &nbsp;&nbsp; **Score:** ${b.score} &nbsp;&nbsp; **Conflict weight:** ${b.conflict_weight}`);
    p('');
    // Interpretation Layer первым делом — главный человеческий вывод
    renderInterpretation(p, interpByBlockId[blockIdMap[b.block_number]]);
    if (b.key_metric) { p('**Ключевая метрика:** ' + b.key_metric); p(''); }
    if (Array.isArray(b.key_factors) && b.key_factors.length) {
      p('**Ключевые факторы:**');
      for (const f of b.key_factors) p('- ' + f);
      p('');
    }
    if (b.block_context) {
      p('<details><summary>📋 block_context</summary>');
      p('');
      p('```json');
      p(JSON.stringify(b.block_context, null, 2));
      p('```');
      p('');
      p('</details>');
      p('');
    }
    if (b.raw_data) {
      p('<details><summary>📦 raw_data (полный pipeline блока)</summary>');
      p('');
      p('```json');
      p(JSON.stringify(b.raw_data, null, 2));
      p('```');
      p('');
      p('</details>');
      p('');
    }
    p('---');
    p('');
  }

  p('## 🧠 Блок 7 — AI Синтез (Optimist / Skeptic / Arbitrator)');
  p('');
  renderInterpretation(p, interpByBlockId.synthesis);
  if (synth) {
    const arb = synth.arbitrator || {};
    p(`**Verdict type:** \`${arb.verdict_type || synth.verdict || '—'}\``);
    p(`**Confidence:** ${arb.confidence != null ? Math.round(arb.confidence * 100) + '%' : (synth.confidence ?? '—')}`);
    p('');
    p('<details><summary>📦 Полный synthesis_results</summary>');
    p('');
    p('```json');
    p(JSON.stringify(synth, null, 2));
    p('```');
    p('');
    p('</details>');
  } else {
    p('> ⚠️ Синтез для этого тренда ещё **не запускался**.');
    p('>');
    p('> Чтобы получить итоговый вердикт оптимиста/скептика/арбитра, нужно открыть тренд в UI и нажать запуск блока «AI Синтез».');
  }
  p('');
  p('---');
  p('');
  p('_Документ сгенерирован автоматически из Supabase. Все данные — снимок на момент выгрузки._');
  p('');

  const outPath = path.join('docs', `TREND_ANALYSIS_${tid.replace(/^trend-/, '')}.md`);
  fs.mkdirSync('docs', {recursive: true});
  fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
  console.log('OK', outPath, lines.length, 'lines,', lines.join('\n').length, 'chars');
})();
