const {createClient} = require('@supabase/supabase-js');
require('dotenv').config({path:'.env.local'});
const fs = require('fs');
const path = require('path');

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const tid = process.argv[2] || 'trend-1775666689411-1';
  const {data: s, error} = await sb.from('synthesis_results').select('*').eq('trend_id', tid).order('created_at', {ascending:false}).limit(1).single();
  if (error || !s) { console.error('NOT FOUND', error); process.exit(1); }

  const lines = [];
  const p = (x='') => lines.push(x);

  p('# 🧠 Блок 7 — AI Синтез');
  p('');
  p('**Тренд:** ' + (s.niche || tid));
  p('**Trend ID:** `' + tid + '`');
  p('**Создан:** ' + s.created_at);
  p('**Режим Blind Spot:** ' + (s.is_blind_spot ? '✅ да (Skeptic = Opus)' : '— нет (Skeptic = Sonnet)'));
  p('');
  p('---');
  p('');

  // ===== ВЕРДИКТ =====
  const arb = s.arbitrator || {};
  p('## 🎯 Вердикт арбитра');
  p('');
  p('| | |');
  p('|---|---|');
  p('| **Тип вердикта** | `' + (arb.verdict_type || '—') + '` |');
  p('| **Уверенность** | ' + (arb.confidence != null ? Math.round(arb.confidence * 100) + '%' : '—') + ' |');
  if (arb.verdict_label) p('| **Label** | ' + arb.verdict_label + ' |');
  p('');
  if (arb.verdict_reasoning) {
    p('### Обоснование');
    p('');
    p('> ' + String(arb.verdict_reasoning).split('\n').join('\n> '));
    p('');
  }
  if (arb.bridge_text || s.bridge_text) {
    p('### Мост к Strategy');
    p('');
    p('> ' + String(arb.bridge_text || s.bridge_text).split('\n').join('\n> '));
    p('');
  }
  if (Array.isArray(arb.conditions) && arb.conditions.length) {
    p('### Условия (что должно быть верно для GO)');
    p('');
    for (const c of arb.conditions) p('- ' + (typeof c === 'string' ? c : JSON.stringify(c)));
    p('');
  }
  if (Array.isArray(arb.actions) && arb.actions.length) {
    p('### Приоритетные действия');
    p('');
    for (const a of arb.actions) {
      if (typeof a === 'string') p('- ' + a);
      else p('- **' + (a.title || a.action || '?') + '** — ' + (a.description || a.why || ''));
    }
    p('');
  }
  if (Array.isArray(arb.confidence_factors) && arb.confidence_factors.length) {
    p('### Факторы уверенности');
    p('');
    for (const f of arb.confidence_factors) {
      if (typeof f === 'string') p('- ' + f);
      else p('- ' + JSON.stringify(f));
    }
    p('');
  }
  p('---');
  p('');

  // ===== STRATEGIC DELTA =====
  if (s.strategic_delta) {
    const d = s.strategic_delta;
    p('## 📈 Strategic Delta');
    p('');
    if (d.show === false) {
      p('> Strategic Delta скрыта (` show: false `) — стандартный путь и стратегический не различаются достаточно для показа.');
      p('');
    } else {
      p('| Метрика | Standard | Strategic |');
      p('|---|---|---|');
      if (d.standard && d.strategic) {
        const fields = ['revenue', 'speed', 'probability', 'cac', 'payback'];
        for (const k of Object.keys(d.standard)) {
          p('| ' + k + ' | ' + JSON.stringify(d.standard[k]) + ' | ' + JSON.stringify(d.strategic?.[k] ?? '—') + ' |');
        }
      }
      p('');
      if (d.uplift_multiplier != null) p('**Uplift multiplier:** ×' + d.uplift_multiplier);
      if (d.speed_multiplier != null) p('  &nbsp; **Speed:** ×' + d.speed_multiplier);
      if (d.probability_boost != null) p('  &nbsp; **Probability boost:** +' + d.probability_boost);
      p('');
      if (Array.isArray(d.gap_drivers) && d.gap_drivers.length) {
        p('**Gap drivers:**');
        for (const g of d.gap_drivers) p('- ' + (typeof g === 'string' ? g : JSON.stringify(g)));
        p('');
      }
      if (d.verdict_frame) { p('**Verdict frame:** ' + d.verdict_frame); p(''); }
      if (d.cta_text) { p('**CTA:** ' + d.cta_text); p(''); }
    }
    p('---');
    p('');
  }

  // ===== SALES ARCHITECT =====
  if (s.sales_text) {
    p('## 💼 Sales Architect');
    p('');
    p(s.sales_text);
    p('');
    p('---');
    p('');
  }

  // ===== СКЕПТИК =====
  const sk = s.skeptic || {};
  p('## 🔻 Скептик');
  p('');
  if (sk.summary) { p('> ' + String(sk.summary).split('\n').join('\n> ')); p(''); }
  if (Array.isArray(sk.risks) && sk.risks.length) {
    p('### Риски');
    p('');
    for (const r of sk.risks) {
      if (typeof r === 'string') p('- ' + r);
      else p('- **' + (r.title || r.name || '?') + '** — ' + (r.description || r.detail || '') + (r.severity ? ' _(severity: ' + r.severity + ')_' : ''));
    }
    p('');
  }
  if (Array.isArray(sk.kill_switches) && sk.kill_switches.length) {
    p('### Kill switches');
    p('');
    for (const k of sk.kill_switches) p('- ' + (typeof k === 'string' ? k : JSON.stringify(k)));
    p('');
  }
  p('<details><summary>📦 Полный JSON скептика</summary>');
  p('');
  p('```json');
  p(JSON.stringify(sk, null, 2));
  p('```');
  p('');
  p('</details>');
  p('');
  p('---');
  p('');

  // ===== ОПТИМИСТ =====
  const op = s.optimist || {};
  p('## 🔺 Оптимист');
  p('');
  if (op.summary) { p('> ' + String(op.summary).split('\n').join('\n> ')); p(''); }
  if (Array.isArray(op.opportunities) && op.opportunities.length) {
    p('### Возможности');
    p('');
    for (const o of op.opportunities) {
      if (typeof o === 'string') p('- ' + o);
      else p('- **' + (o.title || o.name || '?') + '** — ' + (o.description || o.detail || ''));
    }
    p('');
  }
  if (op.asymmetric_advantage) { p('**Асимметричное преимущество:** ' + (typeof op.asymmetric_advantage === 'string' ? op.asymmetric_advantage : JSON.stringify(op.asymmetric_advantage))); p(''); }
  if (Array.isArray(op.neutralization_conditions) && op.neutralization_conditions.length) {
    p('### Условия нейтрализации рисков');
    p('');
    for (const c of op.neutralization_conditions) p('- ' + (typeof c === 'string' ? c : JSON.stringify(c)));
    p('');
  }
  p('<details><summary>📦 Полный JSON оптимиста</summary>');
  p('');
  p('```json');
  p(JSON.stringify(op, null, 2));
  p('```');
  p('');
  p('</details>');
  p('');
  p('---');
  p('');

  // ===== АРБИТР =====
  p('## ⚖️ Арбитр (полный JSON)');
  p('');
  p('```json');
  p(JSON.stringify(arb, null, 2));
  p('```');
  p('');
  p('---');
  p('');

  // ===== КОНФЛИКТЫ =====
  if (Array.isArray(s.conflicts) && s.conflicts.length) {
    p('## ⚠️ Conflict Detection');
    p('');
    for (const c of s.conflicts) {
      p('- **' + (c.type || '?') + '** ' + (c.severity ? '`' + c.severity + '`' : '') + ' — ' + (c.description || c.detail || ''));
    }
    p('');
    p('<details><summary>📦 Полный JSON конфликтов</summary>');
    p('');
    p('```json');
    p(JSON.stringify(s.conflicts, null, 2));
    p('```');
    p('');
    p('</details>');
    p('');
    p('---');
    p('');
  }

  p('_Документ сгенерирован автоматически из таблицы `synthesis_results`. Снимок на момент выгрузки._');
  p('');

  const outPath = path.join('docs', 'TREND_' + tid.replace(/^trend-/,'') + '_BLOCK7_SYNTHESIS.md');
  fs.mkdirSync('docs', {recursive: true});
  fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
  console.log('OK', outPath, lines.length, 'lines,', lines.join('\n').length, 'chars');
})();
