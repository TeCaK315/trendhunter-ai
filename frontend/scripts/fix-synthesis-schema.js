// Применяет недостающие колонки в synthesis_results через прямой Postgres-коннект.
// Service role key через Supabase JS не даёт DDL — нужен POSTGRES_URL.
const fs = require('fs');
require('dotenv').config({path:'.env.local'});

const url = process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
if (!url) {
  console.log('❌ Не найден POSTGRES_URL / DATABASE_URL в .env.local');
  console.log('   Доступные env, похожие на БД:');
  for (const k of Object.keys(process.env)) {
    if (/postgres|database|supabase/i.test(k)) console.log('     -', k);
  }
  console.log('\nВыполни SQL вручную в Supabase Dashboard → SQL Editor:');
  console.log('---');
  console.log(fs.readFileSync(__dirname + '/../sql/add_synthesis_columns.sql', 'utf8'));
  process.exit(1);
}

(async () => {
  const {Client} = require('pg');
  const client = new Client({connectionString: url, ssl: {rejectUnauthorized: false}});
  await client.connect();
  const sql = fs.readFileSync(__dirname + '/../sql/add_synthesis_columns.sql', 'utf8');
  console.log('Running SQL...');
  await client.query(sql);
  console.log('✅ Done');
  await client.end();
})();
