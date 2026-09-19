import test from 'node:test'
import assert from 'node:assert/strict'
import { escapeHtml, sendTelegram } from '../netlify/functions/_lib/telegram.mjs'

test('escapes Telegram HTML values', () => {
  assert.equal(escapeHtml('<Client & "test">'), '&lt;Client &amp; &quot;test&quot;&gt;')
})

test('retries once after a failed request', async () => {
  const originalFetch = globalThis.fetch
  const originalToken = process.env.TELEGRAM_BOT_TOKEN
  const originalChat = process.env.TELEGRAM_CHAT_ID
  let calls = 0
  process.env.TELEGRAM_BOT_TOKEN = 'test-token'
  process.env.TELEGRAM_CHAT_ID = 'test-chat'
  globalThis.fetch = async () => {
    calls += 1
    if (calls === 1) return new Response('{}', { status: 500 })
    return new Response('{"ok":true}', { status: 200 })
  }
  try {
    const result = await sendTelegram('test')
    assert.equal(result.ok, true)
    assert.equal(calls, 2)
  } finally {
    globalThis.fetch = originalFetch
    if (originalToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN
    else process.env.TELEGRAM_BOT_TOKEN = originalToken
    if (originalChat === undefined) delete process.env.TELEGRAM_CHAT_ID
    else process.env.TELEGRAM_CHAT_ID = originalChat
  }
})
