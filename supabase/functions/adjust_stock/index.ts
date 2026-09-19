// supabase/functions/adjust_stock/index.ts
// Deno Edge Function: verifies the caller's JWT, then calls the
// `adjust_stock` RPC using the service-role key so RLS is bypassed safely.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return json({ success: false, error: 'Missing Authorization header' }, 401)
    }

    // Client scoped to the caller's JWT, used only to verify identity.
    const userClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } }
    })

    const jwt = authHeader.replace('Bearer ', '')
    const { data: userData, error: userError } = await userClient.auth.getUser(jwt)

    if (userError || !userData?.user) {
      return json({ success: false, error: 'Invalid or expired token' }, 401)
    }

    const body = await req.json().catch(() => ({}))
    const { product_id, delta, comment } = body as {
      product_id?: string
      delta?: number
      comment?: string
    }

    if (!product_id || typeof delta !== 'number' || delta === 0) {
      return json(
        { success: false, error: 'product_id (uuid) and non-zero delta (integer) are required' },
        400
      )
    }

    // Admin client (service role) to actually run the RPC.
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    const { data, error } = await adminClient.rpc('adjust_stock', {
      p_product_id: product_id,
      p_delta: delta,
      p_comment: comment ?? null
    })

    if (error) {
      return json({ success: false, error: error.message }, 400)
    }

    return json({ success: true, new_stock: data })
  } catch (err) {
    return json({ success: false, error: (err as Error).message }, 500)
  }
})
