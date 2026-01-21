import { writable, derived } from 'svelte/store'
import { supabase } from '../lib/supabase'
import type { User, Session } from '@supabase/supabase-js'

interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  error: string | null
}

function createAuthStore() {
  const { subscribe, set, update } = writable<AuthState>({
    user: null,
    session: null,
    loading: true,
    error: null,
  })

  // Initialize auth state
  async function initialize() {
    try {
      const { data: { session }, error } = await supabase.auth.getSession()

      if (error) {
        console.error('Error getting session:', error)
        update(state => ({ ...state, loading: false, error: error.message }))
        return
      }

      set({
        user: session?.user ?? null,
        session,
        loading: false,
        error: null,
      })
    } catch (error) {
      console.error('Error initializing auth:', error)
      update(state => ({
        ...state,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }))
    }
  }

  // Listen to auth state changes
  supabase.auth.onAuthStateChange((_event, session) => {
    update(state => ({
      ...state,
      user: session?.user ?? null,
      session,
      loading: false,
      error: null,
    }))
  })

  // Initialize on creation
  initialize()

  return {
    subscribe,

    signInWithGoogle: async () => {
      update(state => ({ ...state, loading: true, error: null }))

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      })

      if (error) {
        update(state => ({ ...state, loading: false, error: error.message }))
        return { success: false, error: error.message }
      }

      return { success: true }
    },

    signOut: async () => {
      update(state => ({ ...state, loading: true, error: null }))

      const { error } = await supabase.auth.signOut()

      if (error) {
        update(state => ({ ...state, loading: false, error: error.message }))
        return { success: false, error: error.message }
      }

      set({ user: null, session: null, loading: false, error: null })
      return { success: true }
    },

    clearError: () => {
      update(state => ({ ...state, error: null }))
    },
  }
}

export const auth = createAuthStore()

// Derived stores for convenient access
export const user = derived(auth, $auth => $auth.user)
export const isAuthenticated = derived(auth, $auth => $auth.user !== null)
export const isLoading = derived(auth, $auth => $auth.loading)
export const authError = derived(auth, $auth => $auth.error)
