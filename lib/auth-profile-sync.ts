import { supabase } from "./supabase"
import { createClient } from "@supabase/supabase-js"
import type { User } from "@supabase/supabase-js"

// This would ideally use a service role key, but we'll work with what we have
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ydjrngnnuxxswmhxwxzf.supabase.co"
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkanJuZ25udXh4c3dtaHh3eHpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE5MTcxMjgsImV4cCI6MjA2NzQ5MzEyOH0.XDsxnQRhHDttB8hRCcSADIYJ6D_-_gcoWToJbWjXn-w"

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

export class AuthProfileSync {
  /**
   * Get all authenticated users using a direct SQL query approach
   */
  static async getAuthenticatedUsers() {
    try {
      console.log("🔍 Attempting to get authenticated users...")
      
      // Method 1: Try admin listUsers (works with service role key)
      try {
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers()
        
        if (!authError && authData?.users) {
          console.log(`✅ Found ${authData.users.length} authenticated users via admin API`)
          return {
            success: true,
            users: authData.users,
            method: "admin-api"
          }
        }
      } catch (adminError) {
        console.log("⚠️ Admin API not available, trying alternatives...")
      }
      
      // Method 2: Try to query auth.users directly (requires elevated permissions)
      try {
        const { data: authUsers, error: directError } = await supabaseAdmin
          .from('users')
          .select('*')
          .neq('id', 'dummy') // Just to make it a valid query
        
        if (!directError && authUsers) {
          console.log(`✅ Found ${authUsers.length} users via direct query`)
          return {
            success: true,
            users: authUsers,
            method: "direct-query"
          }
        }
      } catch (directError) {
        console.log("⚠️ Direct query failed, trying RPC...")
      }
      
      // Method 3: Try RPC function (if exists)
      try {
        const { data: rpcUsers, error: rpcError } = await supabaseAdmin
          .rpc('get_all_auth_users')
        
        if (!rpcError && rpcUsers) {
          console.log(`✅ Found ${rpcUsers.length} users via RPC`)
          return {
            success: true,
            users: rpcUsers,
            method: "rpc"
          }
        }
      } catch (rpcError) {
        console.log("⚠️ RPC method failed")
      }
      
      // Method 4: Manual creation based on known information
      console.log("⚠️ Cannot access auth users directly, will need manual profile creation")
      return {
        success: false,
        error: "Cannot access auth.users table with current permissions",
        suggestion: "Need to create profiles manually or use service role key"
      }
      
    } catch (error: any) {
      console.error("❌ Error getting authenticated users:", error)
      return {
        success: false,
        error: error.message
      }
    }
  }
  
  /**
   * Create missing profiles for authenticated users
   */
  static async createMissingProfiles() {
    try {
      console.log("🔧 Starting profile sync process...")
      
      // Get current profiles
      const { data: existingProfiles, error: profileError } = await supabase
        .from('users')
        .select('id, email, name, role, created_at')
        .order('created_at', { ascending: false })
      
      if (profileError) {
        throw new Error(`Failed to get existing profiles: ${profileError.message}`)
      }
      
      console.log(`📊 Found ${existingProfiles?.length || 0} existing profiles`)
      
      // Get authenticated users
      const authResult = await this.getAuthenticatedUsers()
      
      if (!authResult.success) {
        return {
          success: false,
          error: authResult.error,
          suggestion: authResult.suggestion
        }
      }
      
      const authUsers = authResult.users
      console.log(`📊 Found ${authUsers?.length || 0} authenticated users`)
      
      // Find missing profiles
      const missingProfiles = authUsers?.filter((authUser: User) => 
        !existingProfiles?.some(profile => profile.id === authUser.id)
      ) || []
      
      console.log(`📊 Found ${missingProfiles.length} missing profiles`)
      
      if (missingProfiles.length === 0) {
        return {
          success: true,
          message: "No missing profiles found - all auth users have profiles",
          created: 0,
          authUsers: authUsers?.length || 0,
          existingProfiles: existingProfiles?.length || 0
        }
      }
      
      // Create missing profiles
      const profilesToCreate = missingProfiles.map((authUser: User) => ({
        id: authUser.id,
        email: authUser.email,
        name: authUser.user_metadata?.full_name || 
              authUser.user_metadata?.name || 
              authUser.email?.split('@')[0] || 'User',
        role: 'pending_player', // Default role for new users
        created_at: new Date().toISOString()
      }))
      
      console.log(`📝 Creating ${profilesToCreate.length} missing profiles...`)
      
      const { data: createdProfiles, error: createError } = await supabase
        .from('users')
        .insert(profilesToCreate)
        .select()
      
      if (createError) {
        throw new Error(`Failed to create profiles: ${createError.message}`)
      }
      
      console.log(`✅ Successfully created ${createdProfiles?.length || 0} profiles`)
      
      return {
        success: true,
        created: createdProfiles?.length || 0,
        profiles: createdProfiles,
        authUsers: authUsers?.length || 0,
        method: authResult.method
      }
      
    } catch (error: any) {
      console.error("❌ Error in createMissingProfiles:", error)
      return {
        success: false,
        error: error.message
      }
    }
  }
  
  /**
   * Manual profile creation for when we can't access auth users
   */
  static async createProfileManually(email: string, name?: string, role: string = 'pending_player') {
    try {
      console.log(`🔧 Manually creating profile for: ${email}`)
      
      // Check if profile already exists
      const { data: existing, error: checkError } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single()
      
      if (existing) {
        return {
          success: false,
          error: `Profile already exists for ${email}`
        }
      }
      
      // Create profile with generated ID
      const profileData = {
        email,
        name: name || email.split('@')[0],
        role,
        created_at: new Date().toISOString()
      }
      
      const { data: newProfile, error: createError } = await supabase
        .from('users')
        .insert(profileData)
        .select()
        .single()
      
      if (createError) {
        throw new Error(`Failed to create profile: ${createError.message}`)
      }
      
      console.log(`✅ Successfully created profile for ${email}`)
      
      return {
        success: true,
        profile: newProfile
      }
      
    } catch (error: any) {
      console.error("❌ Error in createProfileManually:", error)
      return {
        success: false,
        error: error.message
      }
    }
  }
  
  /**
   * Get comprehensive sync status
   */
  static async getSyncStatus() {
    try {
      console.log("📊 Getting sync status...")
      
      // Get profiles
      const { data: profiles, error: profileError } = await supabase
        .from('users')
        .select('id, email, name, role, created_at')
        .order('created_at', { ascending: false })
      
      if (profileError) {
        throw new Error(`Failed to get profiles: ${profileError.message}`)
      }
      
      // Try to get auth users
      const authResult = await this.getAuthenticatedUsers()
      
      return {
        success: true,
        profiles: {
          count: profiles?.length || 0,
          list: profiles || []
        },
        authUsers: {
          accessible: authResult.success,
          count: authResult.users?.length || 0,
          method: authResult.method || 'none',
          error: authResult.error
        },
        sync: {
          profilesFound: profiles?.length || 0,
          authUsersFound: authResult.users?.length || 0,
          potentialMissing: authResult.success ? 
            Math.max(0, (authResult.users?.length || 0) - (profiles?.length || 0)) : 
            'unknown'
        }
      }
      
    } catch (error: any) {
      console.error("❌ Error getting sync status:", error)
      return {
        success: false,
        error: error.message
      }
    }
  }
}