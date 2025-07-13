import { createClient } from "@supabase/supabase-js"
import type { Database } from "./supabase"

// Admin client with service role key for bypassing RLS
const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ydjrngnnuxxswmhxwxzf.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkanJuZ25udXh4c3dtaHh3eHpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE5MTcxMjgsImV4cCI6MjA2NzQ5MzEyOH0.XDsxnQRhHDttB8hRCcSADIYJ6D_-_gcoWToJbWjXn-w",
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export class SupabaseAdminService {
  /**
   * Get all users - uses service role to bypass RLS
   */
  static async getAllUsers() {
    try {
      console.log("🔍 Fetching all users with admin service...")
      
      // Use service role client to bypass RLS
      const { data, error } = await supabaseAdmin
        .from("users")
        .select("*")
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Admin users query failed:", error)
        throw error
      }

      console.log(`✅ Found ${data?.length || 0} users`)
      return { data, error: null }
    } catch (err: any) {
      console.error("❌ Admin users fetch failed:", err)
      return { data: null, error: err }
    }
  }

  /**
   * Get all authenticated users from auth.users table
   */
  static async getAllAuthUsers() {
    try {
      console.log("🔍 Fetching auth users...")
      
      // Use admin client to access auth.users
      const { data, error } = await supabaseAdmin.auth.admin.listUsers()

      if (error) {
        console.error("Auth users query failed:", error)
        throw error
      }

      console.log(`✅ Found ${data?.users?.length || 0} auth users`)
      return { data: data.users, error: null }
    } catch (err: any) {
      console.error("❌ Auth users fetch failed:", err)
      return { data: null, error: err }
    }
  }

  /**
   * Create missing profiles for authenticated users
   */
  static async createMissingProfiles() {
    try {
      console.log("🔧 Creating missing profiles...")
      
      // Get all auth users
      const authResult = await this.getAllAuthUsers()
      if (!authResult.data) {
        throw new Error("Failed to get auth users")
      }

      // Get all profile users
      const profileResult = await this.getAllUsers()
      if (!profileResult.data) {
        throw new Error("Failed to get profile users")
      }

      const authUsers = authResult.data
      const profileUsers = profileResult.data
      const profileUserIds = new Set(profileUsers.map(p => p.id))

      // Find missing profiles
      const missingProfiles = authUsers.filter(user => !profileUserIds.has(user.id))
      console.log(`Found ${missingProfiles.length} missing profiles`)

      if (missingProfiles.length === 0) {
        return { success: true, created: 0, message: "No missing profiles found" }
      }

      // Create missing profiles
      let created = 0
      const errors: string[] = []

      for (const user of missingProfiles) {
        try {
          const { error } = await supabaseAdmin.from("users").insert({
            id: user.id,
            email: user.email!,
            name: user.user_metadata?.name || user.user_metadata?.full_name || user.email!.split('@')[0],
            role: 'pending',
            role_level: 10,
            created_at: user.created_at
          })

          if (error) {
            console.error(`Failed to create profile for ${user.email}:`, error)
            errors.push(`${user.email}: ${error.message}`)
          } else {
            created++
            console.log(`✅ Created profile for ${user.email}`)
          }
        } catch (err: any) {
          console.error(`Exception creating profile for ${user.email}:`, err)
          errors.push(`${user.email}: ${err.message}`)
        }
      }

      return {
        success: true,
        created,
        errors,
        message: `Created ${created} profiles. ${errors.length} errors.`
      }
    } catch (err: any) {
      console.error("❌ Create missing profiles failed:", err)
      return { success: false, error: err.message }
    }
  }

  /**
   * Update user role - admin operation
   */
  static async updateUserRole(userId: string, role: string, currentUserId: string) {
    try {
      console.log("🔧 Admin updating user role:", { userId, role, currentUserId })
      
      // Verify current user is admin using service role
      const { data: currentUser } = await supabaseAdmin
        .from("users")
        .select("role")
        .eq("id", currentUserId)
        .single()

      if (!currentUser || currentUser.role !== "admin") {
        throw new Error("Insufficient permissions. Only admins can update roles.")
      }

      // Update user role using service role
      const { data, error } = await supabaseAdmin
        .from("users")
        .update({ role })
        .eq("id", userId)
        .select()

      if (error) {
        console.error("Role update failed:", error)
        throw error
      }

      console.log("✅ User role updated successfully")
      return { data, error: null }
    } catch (err: any) {
      console.error("❌ Role update failed:", err)
      return { data: null, error: err }
    }
  }

  /**
   * Delete user - admin operation
   */
  static async deleteUser(userId: string, currentUserId: string) {
    try {
      console.log("🗑️ Admin deleting user:", { userId, currentUserId })
      
      // Verify current user is admin
      const { data: currentUser } = await supabaseAdmin
        .from("users")
        .select("role")
        .eq("id", currentUserId)
        .single()

      if (!currentUser || currentUser.role !== "admin") {
        throw new Error("Insufficient permissions. Only admins can delete users.")
      }

      // Delete user profile
      const { error: profileError } = await supabaseAdmin
        .from("users")
        .delete()
        .eq("id", userId)

      if (profileError) {
        console.error("Profile deletion failed:", profileError)
        throw profileError
      }

      // Delete auth user
      const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId)

      if (authError) {
        console.error("Auth user deletion failed:", authError)
        // Don't throw here as profile is already deleted
      }

      console.log("✅ User deleted successfully")
      return { success: true, error: null }
    } catch (err: any) {
      console.error("❌ User deletion failed:", err)
      return { success: false, error: err }
    }
  }

  /**
   * Test admin permissions
   */
  static async testAdminPermissions(currentUserId: string) {
    try {
      console.log("🧪 Testing admin permissions...")
      
      const tests = {
        canReadUsers: false,
        canReadAuthUsers: false,
        isAdmin: false,
        canBypassRLS: false,
        errors: [] as string[]
      }

      // Test 1: Can read users table
      try {
        const { data, error } = await supabaseAdmin.from("users").select("count").limit(1)
        if (!error) {
          tests.canReadUsers = true
        } else {
          tests.errors.push(`Users table: ${error.message}`)
        }
      } catch (err: any) {
        tests.errors.push(`Users table: ${err.message}`)
      }

      // Test 2: Can read auth users
      try {
        const { data, error } = await supabaseAdmin.auth.admin.listUsers()
        if (!error) {
          tests.canReadAuthUsers = true
        } else {
          tests.errors.push(`Auth users: ${error.message}`)
        }
      } catch (err: any) {
        tests.errors.push(`Auth users: ${err.message}`)
      }

      // Test 3: Is admin
      try {
        const { data, error } = await supabaseAdmin
          .from("users")
          .select("role")
          .eq("id", currentUserId)
          .single()
        
        if (!error && data?.role === "admin") {
          tests.isAdmin = true
        } else {
          tests.errors.push(`Admin check: ${error?.message || "Not admin"}`)
        }
      } catch (err: any) {
        tests.errors.push(`Admin check: ${err.message}`)
      }

      // Test 4: Can bypass RLS
      tests.canBypassRLS = tests.canReadUsers

      return tests
    } catch (err: any) {
      console.error("❌ Permission test failed:", err)
      return {
        canReadUsers: false,
        canReadAuthUsers: false,
        isAdmin: false,
        canBypassRLS: false,
        errors: [err.message]
      }
    }
  }
}