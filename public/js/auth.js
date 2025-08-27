// public/js/auth.js
import { supabase } from './supabaseClient.js'

// Sign up
export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw error
  return data
}

// Login
export async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  if (error) throw error
  return data
}

// Get session (returns { session } or null)
export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data?.session ?? null
}

// Optional: listen to auth state changes to update UI
export function setupAuthListener(onChange) {
  supabase.auth.onAuthStateChange((event, session) => {
    onChange(event, session)
  })
}
