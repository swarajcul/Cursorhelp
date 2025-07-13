"use client"

import type React from "react"

import { useState, useEffect, createContext, useContext } from "react"
import { supabase } from "@/lib/supabase"
import { SessionManager } from "@/lib/session-manager"
import { SecureProfileCreation } from "@/lib/secure-profile-creation"
import type { Session } from "@supabase/supabase-js"

type AuthContextType = {
  session: Session | null
  user: any
  profile: any
  loading: boolean
  error: string | null
  signIn: (email: string, password: string) => Promise<{ error: any | null }>
  signUp: (email: string, password: string, name: string) => Promise<{ error: any | null }>
  signOut: () => Promise<void>
  retryProfileCreation: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Check session manager first
        const isValid = SessionManager.isSessionValid()
        console.log('🔍 Session validity check:', isValid)
        
        if (!isValid) {
          console.log('⚠️ Session expired, clearing auth state')
          setSession(null)
          setUser(null)
          return
        }
        
        // Get current session from Supabase
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Session fetch error:', error)
          setSession(null)
          setUser(null)
          return
        }
        
        if (session) {
          console.log('✅ Valid session found:', session.user?.email)
          SessionManager.extendSession() // Update activity
        }
        
        setSession(session)
        setUser(session?.user || null)
      } catch (error) {
        console.error('Auth initialization error:', error)
        setSession(null)
        setUser(null)
      }
    }

    initializeAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("🔐 Auth state change:", event, session?.user?.email)
        
        if (event === 'SIGNED_IN' && session) {
          SessionManager.extendSession()
        } else if (event === 'SIGNED_OUT') {
          // Clear session data when user signs out
          await SessionManager.logout()
        }
        
        setSession(session)
        setUser(session?.user || null)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (user) {
      fetchProfile(user.id)
    } else {
      setProfile(null)
      setLoading(false)
    }
  }, [user])

  const fetchProfile = async (userId: string) => {
    try {
      setError(null)

      // 1 – Do we already have a profile?
      const { data: existing, error: selectErr } = await supabase.from("users").select("*").eq("id", userId).single()

      if (selectErr && selectErr.code !== "PGRST116") {
        // PGRST116 = row not found (that’s fine – we’ll create below)
        throw selectErr
      }

      if (existing) {
        // Profile exists, use it
        setProfile(existing)
        return
      }

      // 2 – Profile doesn't exist, create it using secure profile creation
      console.log("🔧 Creating profile for user:", userId, user?.email)
      
      const profileResult = await SecureProfileCreation.createProfile(
        userId,
        user?.email!,
        user?.user_metadata?.name || user?.user_metadata?.full_name || undefined
      )

      if (!profileResult.success) {
        throw new Error(profileResult.error || "Profile creation failed")
      }

      // 3 – Set the created profile
      setProfile(profileResult.profile)
    } catch (err: any) {
      console.error("Profile creation / fetch error:", err)
      setError(err.message || "Could not create / fetch profile")
    } finally {
      setLoading(false)
    }
  }

  const retryProfileCreation = () => {
    if (user) {
      setLoading(true)
      setError(null)
      fetchProfile(user.id)
    }
  }

  const signIn = async (email: string, password: string): Promise<{ error: any | null }> => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      return { error }
    } catch (err: any) {
      console.error("Sign-in exception:", err)
      return { error: err }
    }
  }

  const signUp = async (email: string, password: string, name: string): Promise<{ error: any | null }> => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name,
          },
          emailRedirectTo: process.env.NODE_ENV === 'production' 
            ? 'https://dev.raptorofficial.in/auth/confirm'
            : `${window.location.origin}/auth/confirm`
        },
      })
      return { error }
    } catch (err: any) {
      console.error("Sign-up exception:", err)
      return { error: err }
    }
  }

  const signOut = async () => {
    setLoading(true)
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    } catch (err: any) {
      console.error("Sign out error:", err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const value = { session, user, profile, loading, error, signIn, signUp, signOut, retryProfileCreation }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
