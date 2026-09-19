function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]))
}

export { escapeHtml }

export async function sendTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return { ok: false, error: 'Missing Telegram configuration' }
  let lastError = 'Telegram request failed'
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
        signal: controller.signal
      })
      const body = await response.json().catch(() => null)
      if (response.ok && body?.ok) return { ok: true }
      const retryAfter = body?.parameters?.retry_after
      lastError = body?.description || `Telegram HTTP ${response.status}`
      if (response.status === 429 && retryAfter) return { ok: false, error: lastError, retryAfter }
    } catch (error) {
      lastError = error?.name === 'AbortError' ? 'Telegram request timed out' : String(error?.message || error)
    } finally {
      clearTimeout(timeout)
    }
  }
  return { ok: false, error: lastError }
}
