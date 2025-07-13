import { supabase } from "./supabase"

export class ProfileFixer {
  /**
   * Check for users who have auth records but no profile records
   */
  static async findMissingProfiles() {
    try {
      console.log("🔍 Checking for missing profiles...")
      
      // Get all users from the users table
      const { data: profiles, error: profileError } = await supabase
        .from("users")
        .select("id, email, name, role, created_at")
        .order("created_at", { ascending: false })
      
      if (profileError) {
        console.error("Error fetching profiles:", profileError)
        return { success: false, error: profileError }
      }
      
      console.log(`📊 Found ${profiles?.length || 0} user profiles`)
      
      // Try to get auth users (this might not work with anon key)
      const { data: authData, error: authError } = await supabase.auth.admin.listUsers()
      
      if (authError) {
        console.log("⚠️ Could not fetch auth users (expected with anon key)")
        return {
          success: true,
          profiles: profiles || [],
          authUsers: null,
          message: "Could not compare with auth users due to permissions"
        }
      }
      
      const authUsers = authData?.users || []
      console.log(`📊 Found ${authUsers.length} auth users`)
      
      // Find auth users without profiles
      const missingProfiles = authUsers.filter(authUser => 
        !profiles?.some(profile => profile.id === authUser.id)
      )
      
      return {
        success: true,
        profiles: profiles || [],
        authUsers: authUsers,
        missingProfiles: missingProfiles,
        summary: {
          totalProfiles: profiles?.length || 0,
          totalAuthUsers: authUsers.length,
          missingProfileCount: missingProfiles.length
        }
      }
    } catch (error: any) {
      console.error("❌ Error in findMissingProfiles:", error)
      return { success: false, error: error.message }
    }
  }
  
  /**
   * Create missing profiles for authenticated users
   */
  static async createMissingProfiles() {
    try {
      console.log("🔧 Creating missing profiles...")
      
      const result = await this.findMissingProfiles()
      
      if (!result.success) {
        return result
      }
      
      const { missingProfiles } = result
      
      if (!missingProfiles || missingProfiles.length === 0) {
        return {
          success: true,
          message: "No missing profiles found",
          created: 0
        }
      }
      
      const profilesToCreate = missingProfiles.map(authUser => ({
        id: authUser.id,
        email: authUser.email,
        name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'User',
        role: 'pending_player', // Default role for new users
        created_at: new Date().toISOString()
      }))
      
      console.log(`📝 Creating ${profilesToCreate.length} missing profiles...`)
      
      const { data, error } = await supabase
        .from("users")
        .insert(profilesToCreate)
        .select()
      
      if (error) {
        console.error("❌ Error creating profiles:", error)
        return { success: false, error: error.message }
      }
      
      console.log(`✅ Successfully created ${data?.length || 0} profiles`)
      
      return {
        success: true,
        created: data?.length || 0,
        profiles: data
      }
    } catch (error: any) {
      console.error("❌ Error in createMissingProfiles:", error)
      return { success: false, error: error.message }
    }
  }
  
  /**
   * Check RLS policies and permissions
   */
  static async checkRLSPolicies() {
    try {
      console.log("🔍 Checking RLS policies...")
      
      const tests = []
      
      // Test 1: Direct select from users table
      const { data: selectData, error: selectError } = await supabase
        .from("users")
        .select("id, email, role")
        .limit(10)
      
      tests.push({
        name: "Direct users select",
        success: !selectError,
        error: selectError?.message,
        count: selectData?.length || 0
      })
      
      // Test 2: Count query
      const { count, error: countError } = await supabase
        .from("users")
        .select("*", { count: "exact", head: true })
      
      tests.push({
        name: "Users count query",
        success: !countError,
        error: countError?.message,
        count: count || 0
      })
      
      // Test 3: Test with current user context
      const { data: currentUser } = await supabase.auth.getUser()
      
      tests.push({
        name: "Current user context",
        success: !!currentUser?.user,
        userId: currentUser?.user?.id,
        userRole: currentUser?.user?.user_metadata?.role
      })
      
      // Test 4: Test update permissions
      const { error: updateError } = await supabase
        .from("users")
        .update({ name: "test" })
        .eq("id", "non-existent-id")
      
      tests.push({
        name: "Update permissions test",
        success: !updateError || updateError.code === "PGRST116",
        error: updateError?.message
      })
      
      return {
        success: true,
        tests: tests,
        summary: {
          totalTests: tests.length,
          passed: tests.filter(t => t.success).length,
          failed: tests.filter(t => !t.success).length
        }
      }
    } catch (error: any) {
      console.error("❌ Error in checkRLSPolicies:", error)
      return { success: false, error: error.message }
    }
  }
  
  /**
   * Get comprehensive database diagnostics
   */
  static async getDatabaseDiagnostics() {
    try {
      console.log("📊 Running database diagnostics...")
      
      const results = {
        timestamp: new Date().toISOString(),
        missingProfiles: await this.findMissingProfiles(),
        rlsPolicies: await this.checkRLSPolicies(),
        connectionTest: await this.testConnection(),
        userStats: await this.getUserStats()
      }
      
      return {
        success: true,
        diagnostics: results
      }
    } catch (error: any) {
      console.error("❌ Error in getDatabaseDiagnostics:", error)
      return { success: false, error: error.message }
    }
  }
  
  /**
   * Test database connection
   */
  static async testConnection() {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("count")
        .limit(1)
      
      return {
        success: !error,
        error: error?.message,
        connected: !error
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        connected: false
      }
    }
  }
  
  /**
   * Get user statistics
   */
  static async getUserStats() {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("role")
      
      if (error) {
        return { success: false, error: error.message }
      }
      
      const stats = data?.reduce((acc: any, user) => {
        acc[user.role] = (acc[user.role] || 0) + 1
        return acc
      }, {}) || {}
      
      return {
        success: true,
        totalUsers: data?.length || 0,
        roleBreakdown: stats
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      }
    }
  }
}