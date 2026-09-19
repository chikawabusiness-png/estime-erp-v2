import { claimAlerts, markFailed, markSent } from './_lib/queue.mjs'
import { escapeHtml, sendTelegram } from './_lib/telegram.mjs'

export default async function handler() {
  const rows = await claimAlerts(null, 20)
  for (const row of rows) {
    const p = row.payload || {}
    const text = `${row.event_type === 'invoice.created' ? '🧾' : '💳'} ${escapeHtml(p.invoice_number)} | Order ${escapeHtml(p.order_number)} | ${escapeHtml(p.payment_amount ?? p.amount_ttc)} DH`
    const result = await sendTelegram(text)
    if (result.ok) await markSent(row.id)
    else await markFailed(row.id, result.error)
  }
  return new Response(JSON.stringify({ processed: rows.length }), { headers: { 'content-type': 'application/json' } })
}

export const config = { schedule: '*/10 * * * *' }
