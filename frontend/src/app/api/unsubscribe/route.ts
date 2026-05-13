import { getServerSupabase } from '@/lib/supabase'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const user_id = url.searchParams.get('user_id')

  if (user_id) {
    try {
      const supabase = getServerSupabase()
      await supabase.from('email_unsubscribes').upsert(
        { user_id, unsubscribed_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )
    } catch (e) {
      console.error('[unsubscribe]', e)
    }
  }

  return new Response(
    `<!DOCTYPE html>
<html lang="ru"><head><meta charset="utf-8"><title>Отписка — TrendHunter AI</title>
<style>
  body { background: #0A0A0A; color: #E5E5E4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
         display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
  .card { background: #111; border: 1px solid rgba(255,255,255,0.08); border-radius: 16px;
          padding: 40px; text-align: center; max-width: 400px; }
  h1 { color: #F5F5F4; margin-bottom: 12px; font-weight: 500; }
  p { color: #A3A3A1; font-size: 14px; line-height: 1.6; }
  a { color: #5DCAA5; text-decoration: none; }
  a:hover { text-decoration: underline; }
</style></head><body>
  <div class="card">
    <h1>Готово</h1>
    <p>${user_id ? 'Ты отписался от email уведомлений TrendHunter AI.' : 'Ссылка для отписки недействительна.'}</p>
    <p><a href="/">← Вернуться на сайт</a></p>
  </div>
</body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  )
}
