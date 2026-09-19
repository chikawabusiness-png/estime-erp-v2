import { claimAlerts, markFailed, markSent } from './_lib/queue.mjs'
import { escapeHtml, sendTelegram } from './_lib/telegram.mjs'
import { timingSafeEqual } from 'node:crypto'

function authorized(request) {
  const expected = process.env.ALERT_KEY || ''
  const supplied = request.headers.get('x-alert-key') || ''
  const a = Buffer.from(supplied)
  const b = Buffer.from(expected)
  return expected.length > 0 && a.length === b.length && timingSafeEqual(a, b)
}

export default async function handler(request) {
  if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
  if (!authorized(request)) return new Response('Forbidden', { status: 403 })
  const body = await request.json().catch(() => null)
  const record = body?.record
  if (!record?.alert_key) return new Response(null, { status: 204 })
  const rows = await claimAlerts(record.id, 1)
  if (rows.length === 0) return new Response(null, { status: 204 })
  const row = rows[0]
  const payload = row.payload || {}
  const text = row.event_type === 'invoice.created'
    ? `🧾 New invoice ${escapeHtml(payload.invoice_number)} | Order ${escapeHtml(payload.order_number)} | ${escapeHtml(payload.amount_ttc)} DH`
    : `💳 Payment ${escapeHtml(payload.invoice_number)} | Order ${escapeHtml(payload.order_number)} | ${escapeHtml(payload.payment_amount)} DH`
  const result = await sendTelegram(text)
  if (result.ok) await markSent(row.id)
  else await markFailed(row.id, result.error)
  return new Response(null, { status: result.ok ? 204 : 502 })
}

export const config = { path: '/.netlify/functions/telegram-alert' }
