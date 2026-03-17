import type { BlockContext, BlockResult } from '../types';
import { createDesignTokens } from '../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);
  const projectName = ctx.safe.projectName;

  return {
    'src/lib/email-templates.ts': `const PROJECT_NAME = '${projectName}';
const PRIMARY_COLOR = '${t.primary}';
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

function layout(content: string): string {
  return \`<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5}
.container{max-width:600px;margin:0 auto;background:#fff}
.header{background:\${PRIMARY_COLOR};padding:30px;text-align:center}
.header h1{color:#fff;margin:0;font-size:24px}
.body{padding:30px}
.footer{padding:20px 30px;text-align:center;color:#999;font-size:12px;border-top:1px solid #eee}
.btn{display:inline-block;padding:12px 30px;background:\${PRIMARY_COLOR};color:#fff!important;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px}
</style></head><body>
<div class="container">
<div class="header"><h1>\${PROJECT_NAME}</h1></div>
<div class="body">\${content}</div>
<div class="footer">
<p>\${PROJECT_NAME} &copy; \${new Date().getFullYear()}</p>
<p>Если вы не совершали это действие, проигнорируйте это письмо.</p>
</div>
</div></body></html>\`;
}

export function welcomeEmail(name: string): { subject: string; html: string } {
  return {
    subject: \`Добро пожаловать в \${PROJECT_NAME}!\`,
    html: layout(\`
      <h2 style="margin:0 0 15px;color:#333">Привет, \${name}! 👋</h2>
      <p style="color:#666;line-height:1.6">Спасибо за регистрацию в <strong>\${PROJECT_NAME}</strong>. Мы рады видеть вас!</p>
      <p style="color:#666;line-height:1.6">Чтобы начать работу, перейдите в дашборд:</p>
      <p style="text-align:center;margin:25px 0">
        <a href="\${BASE_URL}/dashboard" class="btn">Перейти в дашборд</a>
      </p>
      <p style="color:#666;line-height:1.6">Если у вас есть вопросы — просто ответьте на это письмо.</p>
    \`),
  };
}

export function resetPasswordEmail(name: string, resetUrl: string): { subject: string; html: string } {
  return {
    subject: \`Сброс пароля — \${PROJECT_NAME}\`,
    html: layout(\`
      <h2 style="margin:0 0 15px;color:#333">Сброс пароля</h2>
      <p style="color:#666;line-height:1.6">Привет, \${name}. Мы получили запрос на сброс пароля.</p>
      <p style="text-align:center;margin:25px 0">
        <a href="\${resetUrl}" class="btn">Сбросить пароль</a>
      </p>
      <p style="color:#999;font-size:13px">Ссылка действительна 1 час. Если вы не запрашивали сброс — проигнорируйте это письмо.</p>
    \`),
  };
}

export function notificationEmail(name: string, title: string, message: string, actionUrl?: string, actionLabel?: string): { subject: string; html: string } {
  const actionBlock = actionUrl && actionLabel
    ? \`<p style="text-align:center;margin:25px 0"><a href="\${actionUrl}" class="btn">\${actionLabel}</a></p>\`
    : '';

  return {
    subject: \`\${title} — \${PROJECT_NAME}\`,
    html: layout(\`
      <h2 style="margin:0 0 15px;color:#333">\${title}</h2>
      <p style="color:#666;line-height:1.6">Привет, \${name}.</p>
      <p style="color:#666;line-height:1.6">\${message}</p>
      \${actionBlock}
    \`),
  };
}

export function invoiceEmail(name: string, invoiceId: string, amount: string, dueDate: string, payUrl?: string): { subject: string; html: string } {
  return {
    subject: \`Счёт \${invoiceId} — \${PROJECT_NAME}\`,
    html: layout(\`
      <h2 style="margin:0 0 15px;color:#333">Новый счёт</h2>
      <p style="color:#666;line-height:1.6">Привет, \${name}. Вам выставлен счёт:</p>
      <table style="width:100%;border-collapse:collapse;margin:20px 0">
        <tr><td style="padding:8px;color:#666;border-bottom:1px solid #eee">Номер счёта</td>
            <td style="padding:8px;font-weight:bold;text-align:right;border-bottom:1px solid #eee">\${invoiceId}</td></tr>
        <tr><td style="padding:8px;color:#666;border-bottom:1px solid #eee">Сумма</td>
            <td style="padding:8px;font-weight:bold;text-align:right;border-bottom:1px solid #eee">\${amount}</td></tr>
        <tr><td style="padding:8px;color:#666">Оплатить до</td>
            <td style="padding:8px;font-weight:bold;text-align:right">\${dueDate}</td></tr>
      </table>
      \${payUrl ? \`<p style="text-align:center;margin:25px 0"><a href="\${payUrl}" class="btn">Оплатить</a></p>\` : ''}
    \`),
  };
}
`,
  };
}
