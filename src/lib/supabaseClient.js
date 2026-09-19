import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const isKeyLikelyUrl = Boolean(supabaseAnonKey && /^https?:\/\//i.test(supabaseAnonKey))
const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey && !isKeyLikelyUrl)

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.error(
    'Variables Supabase manquantes : vérifiez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY.'
  )
}

if (isKeyLikelyUrl) {
  // eslint-disable-next-line no-console
  console.error(
    'VITE_SUPABASE_ANON_KEY contient une URL au lieu de la clé anon : corrigez la variable dans Netlify puis relancez un déploiement.'
  )
}

const fallbackError = new Error(
  'Supabase n’est pas configuré. Ajoutez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans votre .env ou dans Netlify.'
)

const makeQueryResult = () => ({
  data: null,
  error: isSupabaseConfigured ? null : fallbackError
})

const makeFallbackQuery = () => {
  const query = makeQueryResult()

  query.select = () => query
  query.insert = () => query
  query.update = () => query
  query.delete = () => query
  query.eq = () => query
  query.order = () => query
  query.not = () => query
  query.in = () => query
  query.single = () => query
  query.maybeSingle = () => query
  query.limit = () => query
  query.range = () => query

  return query
}

const fallbackAuth = {
  getSession: async () => ({ data: { session: null }, error: isSupabaseConfigured ? null : fallbackError }),
  getUser: async () => ({ data: { user: null }, error: isSupabaseConfigured ? null : fallbackError }),
  onAuthStateChange: () => ({
    data: { subscription: { unsubscribe: () => undefined } },
    error: isSupabaseConfigured ? null : fallbackError
  }),
  signInWithPassword: async () => ({ data: { user: null, session: null }, error: isSupabaseConfigured ? null : fallbackError }),
  signUp: async () => ({ data: { user: null, session: null }, error: isSupabaseConfigured ? null : fallbackError }),
  signOut: async () => ({ error: isSupabaseConfigured ? null : fallbackError })
}

const fallbackStorage = {
  from: () => ({
    upload: async () => ({ data: null, error: fallbackError }),
    remove: async () => ({ data: null, error: fallbackError }),
    getPublicUrl: () => ({ data: { publicUrl: '' }, error: fallbackError })
  })
}

export const isSupabaseReady = isSupabaseConfigured

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true }
    })
  : {
      auth: fallbackAuth,
      from: () => makeFallbackQuery(),
      storage: fallbackStorage,
      rpc: async () => makeQueryResult(),
      removeChannel: () => undefined,
      channel: () => ({ subscribe: () => ({ unsubscribe: () => undefined }) })
    }
