import { getAdminClient } from './_lib/supabase.mjs'
import { escapeHtml, sendTelegram } from './_lib/telegram.mjs'

export default async function handler() {
  const { data, error } = await getAdminClient()
    .from('invoice_status_summary')
    .select('id, due_date, total_ttc, paid_cents')
    .eq('is_overdue', true)
    .order('due_date')
    .limit(20)
  if (error) throw error
  if (!data?.length) return new Response(null, { status: 204 })
  const lines = data.map(row =>
    `• ${escapeHtml(row.id)} | due ${escapeHtml(row.due_date)} | ${escapeHtml(row.total_ttc)} DH`
  )
  const result = await sendTelegram(`⚠️ Overdue invoices\n${lines.join('\n')}`)
  if (!result.ok) return new Response(JSON.stringify({ error: result.error }), { status: 502 })
  return new Response(null, { status: 204 })
}

export const config = { schedule: '0 7 * * *' }
