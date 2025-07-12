import { createClient } from "@supabase/supabase-js"

// Use environment variables if available, otherwise fall back to hardcoded values
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ydjrngnnuxxswmhxwxzf.supabase.co"

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkanJuZ25udXh4c3dtaHh3eHpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE5MTcxMjgsImV4cCI6MjA2NzQ5MzEyOH0.XDsxnQRhHDttB8hRCcSADIYJ6D_-_gcoWToJbWjXn-w"

/**
 * Fail fast if env vars are missing.
 * Doing this early avoids the "Failed to construct 'URL': Invalid URL" runtime crash.
 */
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Supabase credentials are missing.\n" +
      "Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY " +
      "in your environment variables.",
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Add connection test function with better debugging
export const testConnection = async () => {
  try {
    console.log("Testing Supabase connection...")
    console.log("URL:", supabaseUrl)
    console.log("Key (first 10 chars):", supabaseAnonKey.slice(0, 10) + "...")

    // Test basic connection first
    const { data: authData, error: authError } = await supabase.auth.getSession()
    console.log("Auth test:", { authData, authError })

    // Test if we can access any table (this might fail due to RLS)
    const { data, error } = await supabase.from("users").select("count").limit(1)
    console.log("Database test:", { data, error })

    if (error) {
      console.error("Supabase connection error:", error)
      // If it's an RLS error, that means connection works but policies are blocking
      if (error.code === "PGRST301" || error.message.includes("RLS")) {
        console.log("Connection works, but RLS is blocking access")
        return true
      }
      return false
    }
    console.log("Supabase connected successfully")
    return true
  } catch (err) {
    console.error("Connection test failed:", err)
    return false
  }
}

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          name: string | null
          role: "admin" | "manager" | "coach" | "player" | "analyst"
          team_id: string | null
          avatar_url: string | null
          created_at: string
        }
        Insert: {
          id: string
          email: string
          name?: string | null
          role?: "admin" | "manager" | "coach" | "player" | "analyst"
          team_id?: string | null
          avatar_url?: string | null
        }
        Update: {
          name?: string | null
          role?: "admin" | "manager" | "coach" | "player" | "analyst"
          team_id?: string | null
          avatar_url?: string | null
        }
      }
      teams: {
        Row: {
          id: string
          name: string
          tier: string | null
          coach_id: string | null
          status: string | null
          created_at: string
        }
        Insert: {
          name: string
          tier?: string | null
          coach_id?: string | null
          status?: string | null
        }
        Update: {
          name?: string
          tier?: string | null
          coach_id?: string | null
          status?: string | null
        }
      }
      performances: {
        Row: {
          id: string
          team_id: string | null
          player_id: string
          match_number: number
          slot: number
          map: string
          placement: number | null
          kills: number
          assists: number
          damage: number
          survival_time: number
          added_by: string | null
          created_at: string
        }
        Insert: {
          team_id?: string | null
          player_id: string
          match_number: number
          slot: number
          map: string
          placement?: number | null
          kills?: number
          assists?: number
          damage?: number
          survival_time?: number
          added_by?: string | null
        }
        Update: {
          team_id?: string | null
          match_number?: number
          slot?: number
          map?: string
          placement?: number | null
          kills?: number
          assists?: number
          damage?: number
          survival_time?: number
        }
      }
      rosters: {
        Row: {
          id: string
          team_id: string
          user_id: string
          in_game_role: string | null
          contact_number: string | null
          device_info: string | null
          created_at: string
        }
        Insert: {
          team_id: string
          user_id: string
          in_game_role?: string | null
          contact_number?: string | null
          device_info?: string | null
        }
        Update: {
          team_id?: string
          user_id?: string
          in_game_role?: string | null
          contact_number?: string | null
          device_info?: string | null
        }
      }
      slots: {
        Row: {
          id: string
          team_id: string
          organizer: string
          time_range: string
          number_of_slots: number
          slot_rate: number
          match_count: number | null
          notes: string | null
          date: string // DATE type in SQL, string in TS
          created_at: string
        }
        Insert: {
          team_id: string
          organizer: string
          time_range: string
          number_of_slots: number
          slot_rate: number
          match_count?: number | null
          notes?: string | null
          date: string
        }
        Update: {
          team_id?: string
          organizer?: string
          time_range?: string
          number_of_slots?: number
          slot_rate?: number
          match_count?: number | null
          notes?: string | null
          date?: string
        }
      }
      slot_expenses: {
        Row: {
          id: string
          slot_id: string
          team_id: string
          rate: number
          number_of_slots: number
          total: number
          created_at: string
        }
        Insert: {
          slot_id: string
          team_id: string
          rate: number
          number_of_slots: number
          total: number
        }
        Update: {
          slot_id?: string
          team_id?: string
          rate?: number
          number_of_slots?: number
          total?: number
        }
      }
      prize_pools: {
        Row: {
          id: string
          slot_id: string
          total_amount: number
          breakdown: Json | null // JSONB type in SQL
          created_at: string
        }
        Insert: {
          slot_id: string
          total_amount: number
          breakdown?: Json | null
        }
        Update: {
          slot_id?: string
          total_amount?: number
          breakdown?: Json | null
        }
      }
      winnings: {
        Row: {
          id: string
          slot_id: string
          team_id: string
          position: number
          amount_won: number
          created_at: string
        }
        Insert: {
          slot_id: string
          team_id: string
          position: number
          amount_won: number
        }
        Update: {
          slot_id?: string
          team_id?: string
          position?: number
          amount_won?: number
        }
      }
      tier_defaults: {
        Row: {
          id: string
          tier: string
          default_slot_rate: number
          created_at: string
          updated_at: string
        }
        Insert: {
          tier: string
          default_slot_rate: number
        }
        Update: {
          tier?: string
          default_slot_rate?: number
          updated_at?: string
        }
      }
    }
  }
}

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export const SUPABASE_URL_DEBUG = supabaseUrl
export const SUPABASE_ANON_DEBUG = supabaseAnonKey.slice(0, 8) + "…"
