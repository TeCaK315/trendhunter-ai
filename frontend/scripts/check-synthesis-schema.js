const {createClient} = require('@supabase/supabase-js');
require('dotenv').config({path:'.env.local'});
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const {data} = await sb.from('synthesis_results').select('*').limit(1);
  console.log('=== EXISTING COLUMNS ===');
  for (const [k,v] of Object.entries(data[0] || {})) {
    console.log('  ', k, '→', v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);
  }

  console.log('\n=== TEST INSERT (full payload from route.ts) ===');
  const testRow = {
    trend_id: 'test-schema-check-' + Date.now(),
    user_id: 'fcba45f3-ac9d-9f2a-1270-45aec20f8bf3',
    niche: 'test',
    conflicts: [],
    skeptic: {},
    optimist: {},
    arbitrator: {},
    strategic_delta: null,
    sales_text: '',
    bridge_text: '',
    is_blind_spot: false,
    created_at: new Date().toISOString(),
  };
  const {data: ins, error: insErr} = await sb
    .from('synthesis_results')
    .upsert(testRow, {onConflict:'trend_id,user_id'})
    .select();
  if (insErr) {
    console.log('FAIL ❌');
    console.log('  message:', insErr.message);
    console.log('  code:   ', insErr.code);
    console.log('  details:', insErr.details);
    console.log('  hint:   ', insErr.hint);
  } else {
    console.log('OK ✅ rows=' + ins.length);
    await sb.from('synthesis_results').delete().eq('trend_id', testRow.trend_id);
    console.log('  (cleanup done)');
  }
})();
