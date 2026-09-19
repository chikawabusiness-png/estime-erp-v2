import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const telegramBotToken = Deno.env.get('TELEGRAM_BOT_TOKEN')
const telegramChatId = Deno.env.get('TELEGRAM_CHAT_ID')

if (!supabaseUrl || !serviceRoleKey || !telegramBotToken || !telegramChatId) {
  throw new Error('Missing Telegram or Supabase server configuration')
}

const admin = createClient(supabaseUrl, serviceRoleKey)

type Alert = {
  event_type: string
  payload: Record<string, unknown>
  attempts: number
}

function formatValue(value: unknown) {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function shortId(value: unknown) {
  const text = formatValue(value)
  return text.length > 12 ? text.slice(0, 8) : text
}

function eventLabel(eventType: string) {
  const labels: Record<string, string> = {
    'products.insert': 'Nouveau produit',
    'products.update': 'Produit modifié',
    'products.low_stock': 'Stock faible',
    'orders.insert': 'Nouvelle commande',
    'orders.update': 'Commande modifiée',
    'payments.insert': 'Nouveau paiement',
    'payments.update': 'Paiement modifié',
    'deliveries.insert': 'Nouvelle livraison',
    'deliveries.update': 'Livraison modifiée',
    'returns.insert': 'Nouveau retour',
    'returns.update': 'Retour modifié'
  }
  return labels[eventType] || eventType
}

function formatMessage(alert: Alert) {
  const next = (alert.payload.new || {}) as Record<string, unknown>
  const isLowStock = alert.event_type === 'products.low_stock'
  const title = isLowStock ? '⚠️ Alerte stock' : '🔔 Activité ERP'
  const details = isLowStock
    ? [
        `Produit : ${formatValue(next.name)}`,
        `SKU : ${formatValue(next.sku)}`,
        `Stock : ${formatValue(next.stock)}`,
        `Seuil : ${formatValue(next.minimum_stock)}`
      ]
    : [
        next.name ? `Nom : ${formatValue(next.name)}` : null,
        next.status ? `Statut : ${formatValue(next.status)}` : null,
        next.amount !== undefined ? `Montant : ${formatValue(next.amount)} DH` : null,
        next.stock !== undefined ? `Stock : ${formatValue(next.stock)}` : null,
        next.order_number
          ? `N° commande : ${formatValue(next.order_number)}`
          : next.id ? `Référence interne : ${shortId(next.id)}` : null
      ].filter(Boolean)

  return [
    title,
    `Estime Parfum ERP`,
    `Événement : ${eventLabel(alert.event_type)}`,
    ...details,
    `Date : ${new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Casablanca' })}`
  ].join('\n')
}

async function sendTelegram(text: string) {
  const response = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: telegramChatId, text })
  })
  const result = await response.json().catch(() => null)
  if (!response.ok || !result?.ok) {
    throw new Error(result?.description || `Telegram HTTP ${response.status}`)
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  const { data: alerts, error } = await admin
    .from('telegram_alert_queue')
    .select('id,event_type,payload,attempts')
    .is('alert_key', null)
    .is('sent_at', null)
    .lt('attempts', 5)
    .order('created_at')
    .limit(25)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  let sent = 0
  for (const alert of alerts || []) {
    try {
      await sendTelegram(formatMessage(alert))
      const { error: updateError } = await admin
        .from('telegram_alert_queue')
        .update({ sent_at: new Date().toISOString(), attempts: alert.attempts + 1, last_error: null })
        .eq('id', alert.id)
      if (updateError) throw updateError
      sent += 1
    } catch (sendError) {
      const { error: updateError } = await admin
        .from('telegram_alert_queue')
        .update({ attempts: alert.attempts + 1, last_error: String(sendError) })
        .eq('id', alert.id)
      if (updateError) console.error(`Impossible de mettre à jour l'alerte ${alert.id}: ${updateError.message}`)
    }
  }

  return Response.json({ processed: sent, queued: alerts?.length || 0 })
})
