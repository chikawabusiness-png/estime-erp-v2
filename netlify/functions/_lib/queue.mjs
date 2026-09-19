import { getAdminClient } from './supabase.mjs'

export async function claimAlerts(id = null, limit = 20) {
  const { data, error } = await getAdminClient().rpc('claim_telegram_alerts', {
    p_id: id, p_limit: limit
  })
  if (error) throw error
  return data || []
}

export async function markSent(id) {
  const { error } = await getAdminClient().rpc('mark_telegram_alert_sent', { p_id: id })
  if (error) throw error
}

export async function markFailed(id, errorText) {
  const { error } = await getAdminClient().rpc('mark_telegram_alert_failed', {
    p_id: id, p_error: errorText
  })
  if (error) throw error
}
