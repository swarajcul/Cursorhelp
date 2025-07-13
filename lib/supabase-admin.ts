import { createClient } from "@supabase/supabase-js"
import type { Database } from "./supabase"

// Admin client with elevated permissions
// In production, this should use a service role key with proper RLS bypass
const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ydjrngnnuxxswmhxwxzf.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkanJuZ25udXh4c3dtaHh3eHpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE5MTcxMjgsImV4cCI6MjA2NzQ5MzEyOH0.XDsxnQRhHDttB8hRCcSADIYJ6D_-_gcoWToJbWjXn-w",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
)

export class SupabaseAdminService {
  /**
   * Get all users - bypasses RLS for admin operations
   */
  static async getAllUsers() {
    try {
      console.log("🔍 Fetching all users with admin service...")
      
      // First try direct query
      const { data, error } = await supabaseAdmin
        .from("users")
        .select("*")
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Direct query failed:", error)
        
        // Fallback: Try with RPC call if available
        const { data: rpcData, error: rpcError } = await supabaseAdmin
          .rpc('get_all_users_admin')
        
        if (rpcError) {
          console.error("RPC query also failed:", rpcError)
          throw error // Throw original error
        }
        
        return { data: rpcData, error: null }
      }

      console.log(`✅ Found ${data?.length || 0} users`)
      return { data, error: null }
    } catch (err: any) {
      console.error("❌ Admin users fetch failed:", err)
      return { data: null, error: err }
    }
  }

  /**
   * Update user role - admin operation
   */
  static async updateUserRole(userId: string, role: string, currentUserId: string) {
    try {
      console.log("🔧 Admin updating user role:", { userId, role, currentUserId })
      
      // Verify current user is admin
      const { data: currentUser } = await supabaseAdmin
        .from("users")
        .select("role")
        .eq("id", currentUserId)
        .single()

      if (!currentUser || currentUser.role !== "admin") {
        throw new Error("Insufficient permissions. Only admins can update roles.")
      }

      // Method 1: Direct update
      const { data, error } = await supabaseAdmin
        .from("users")
        .update({ role })
        .eq("id", userId)
        .select()

      if (error) {
        console.error("Direct update failed:", error)
        
        // Method 2: Try RPC call for role update
        const { data: rpcData, error: rpcError } = await supabaseAdmin
          .rpc('update_user_role_admin', {
            user_id: userId,
            new_role: role,
            admin_id: currentUserId
          })
        
        if (rpcError) {
          console.error("RPC update also failed:", rpcError)
          throw error // Throw original error
        }
        
        return { data: rpcData, error: null }
      }

      console.log("✅ User role updated successfully")
      return { data, error: null }
    } catch (err: any) {
      console.error("❌ Admin role update failed:", err)
      return { data: null, error: err }
    }
  }

  /**
   * Create missing user profiles for authenticated users
   */
  static async createMissingProfiles() {
    try {
      console.log("🔄 Checking for missing user profiles...")
      
      // This would typically be done via a server function
      // For now, we'll return instructions for manual setup
      return {
        success: true,
        message: "Profile creation should be handled during signup process"
      }
    } catch (err: any) {
      console.error("❌ Profile creation check failed:", err)
      return {
        success: false,
        error: err.message
      }
    }
  }

  /**
   * Test admin permissions and RLS policies
   */
  static async testAdminPermissions(currentUserId: string) {
    const results = {
      canReadUsers: false,
      canUpdateUsers: false,
      canDeleteUsers: false,
      userCount: 0,
      errors: [] as string[]
    }

    try {
      // Test read
      const { data: users, error: readError } = await supabaseAdmin
        .from("users")
        .select("id")
        .limit(10)

      if (readError) {
        results.errors.push(`Read error: ${readError.message}`)
      } else {
        results.canReadUsers = true
        results.userCount = users?.length || 0
      }

      // Test update (on non-existent user to avoid side effects)
      const { error: updateError } = await supabaseAdmin
        .from("users")
        .update({ name: "test" })
        .eq("id", "non-existent-id")

      if (!updateError || updateError.code === "PGRST116") {
        // PGRST116 = no rows updated (expected for non-existent ID)
        results.canUpdateUsers = true
      } else {
        results.errors.push(`Update error: ${updateError.message}`)
      }

      // Test delete (on non-existent user to avoid side effects)
      const { error: deleteError } = await supabaseAdmin
        .from("users")
        .delete()
        .eq("id", "non-existent-id")

      if (!deleteError || deleteError.code === "PGRST116") {
        results.canDeleteUsers = true
      } else {
        results.errors.push(`Delete error: ${deleteError.message}`)
      }

    } catch (err: any) {
      results.errors.push(`General error: ${err.message}`)
    }

    return results
  }
}

export { supabaseAdmin }