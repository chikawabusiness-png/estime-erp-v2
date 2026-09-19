import React, { useEffect, useState, useCallback, createContext, useContext } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (user) => {
    if (!user?.id) {
      setProfile(null)
      return
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    if (!error && data) {
      setProfile(data)
      return
    }

    const metadataRole = user.user_metadata?.role
    setProfile({
      id: user.id,
      full_name: user.user_metadata?.full_name || null,
      role: typeof metadataRole === 'string' ? metadataRole : null
    })
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      setSession(s)
      await loadProfile(s?.user)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, s) => {
      setSession(s)
      await loadProfile(s?.user)
    })

    return () => listener.subscription.unsubscribe()
  }, [loadProfile])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }, [])

  const normalizedRole = typeof profile?.role === 'string'
    ? profile.role.trim().toLowerCase()
    : null

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    role: normalizedRole,
    isAdmin: normalizedRole === 'admin' || normalizedRole === 'administrateur',
    loading,
    signOut
  }

  return React.createElement(AuthContext.Provider, { value }, children)
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être utilisé dans un <AuthProvider>')
  return ctx
}
