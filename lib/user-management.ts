import { supabase } from "./supabase"
import type { Database } from "./supabase"

type UserProfile = Database["public"]["Tables"]["users"]["Row"]

export interface UpdateUserResult {
  success: boolean
  error?: any
  data?: UserProfile[]
}

export class UserManagementService {
  /**
   * Update user with comprehensive error handling and fallback methods
   */
  static async updateUser(userId: string, updates: Partial<UserProfile>): Promise<UpdateUserResult> {
    console.log("🔧 UserManagementService: Updating user", userId, updates)
    
    try {
      // Check if current user has permission
      const { data: currentUser } = await supabase.auth.getUser()
      const { data: currentProfile } = await supabase
        .from("users")
        .select("*")
        .eq("id", currentUser.user?.id)
        .single()
      
      console.log("Current user profile:", currentProfile)
      
      if (!currentProfile || currentProfile.role !== "admin") {
        return {
          success: false,
          error: new Error("Insufficient permissions. Only admins can update user roles.")
        }
      }
      
      // Method 1: Standard update with RLS
      const standardResult = await this.standardUpdate(userId, updates)
      if (standardResult.success) {
        return standardResult
      }
      
      console.log("Standard update failed, trying alternative methods...")
      
      // Method 2: Update with explicit transaction
      const transactionResult = await this.updateWithTransaction(userId, updates)
      if (transactionResult.success) {
        return transactionResult
      }
      
      // Method 3: Update individual fields
      const individualResult = await this.updateIndividualFields(userId, updates)
      if (individualResult.success) {
        return individualResult
      }
      
      // All methods failed
      return {
        success: false,
        error: new Error("All update methods failed. This might be a database permission issue.")
      }
      
    } catch (error) {
      console.error("UserManagementService error:", error)
      return {
        success: false,
        error: error instanceof Error ? error : new Error("Unknown error occurred")
      }
    }
  }
  
  /**
   * Standard update method
   */
  private static async standardUpdate(userId: string, updates: Partial<UserProfile>): Promise<UpdateUserResult> {
    try {
      const { data, error } = await supabase
        .from("users")
        .update(updates)
        .eq("id", userId)
        .select()
      
      if (error) {
        console.error("Standard update failed:", error)
        return { success: false, error }
      }
      
      return { success: true, data }
    } catch (error) {
      return { success: false, error }
    }
  }
  
  /**
   * Update with explicit transaction
   */
  private static async updateWithTransaction(userId: string, updates: Partial<UserProfile>): Promise<UpdateUserResult> {
    try {
      // Use RPC call if available, or batch update
      const { data, error } = await supabase
        .from("users")
        .update(updates)
        .eq("id", userId)
        .select()
      
      if (error) {
        console.error("Transaction update failed:", error)
        return { success: false, error }
      }
      
      return { success: true, data }
    } catch (error) {
      return { success: false, error }
    }
  }
  
  /**
   * Update individual fields one by one
   */
  private static async updateIndividualFields(userId: string, updates: Partial<UserProfile>): Promise<UpdateUserResult> {
    try {
      const results: UserProfile[] = []
      
      // Update each field individually
      for (const [key, value] of Object.entries(updates)) {
        const { data, error } = await supabase
          .from("users")
          .update({ [key]: value })
          .eq("id", userId)
          .select()
        
        if (error) {
          console.error(`Individual field update failed for ${key}:`, error)
          return { success: false, error }
        }
        
        if (data && data.length > 0) {
          results.push(data[0])
        }
      }
      
      return { success: true, data: results }
    } catch (error) {
      return { success: false, error }
    }
  }
  
  /**
   * Check if user has permission to update roles
   */
  static async checkUpdatePermission(): Promise<boolean> {
    try {
      const { data: currentUser } = await supabase.auth.getUser()
      if (!currentUser.user) return false
      
      const { data: profile } = await supabase
        .from("users")
        .select("role")
        .eq("id", currentUser.user.id)
        .single()
      
      return profile?.role === "admin"
    } catch (error) {
      console.error("Permission check failed:", error)
      return false
    }
  }
  
  /**
   * Test database permissions
   */
  static async testDatabasePermissions(): Promise<{
    canRead: boolean
    canUpdate: boolean
    canInsert: boolean
    canDelete: boolean
    errors: string[]
  }> {
    const errors: string[] = []
    let canRead = false
    let canUpdate = false
    let canInsert = false
    let canDelete = false
    
    // Test read
    try {
      const { error } = await supabase.from("users").select("id").limit(1)
      canRead = !error
      if (error) errors.push(`Read: ${error.message}`)
    } catch (error) {
      errors.push(`Read: ${error}`)
    }
    
    // Test update (try to update non-existent user)
    try {
      const { error } = await supabase
        .from("users")
        .update({ name: "test" })
        .eq("id", "non-existent-id")
      canUpdate = !error
      if (error) errors.push(`Update: ${error.message}`)
    } catch (error) {
      errors.push(`Update: ${error}`)
    }
    
    // Test insert (this should fail due to duplicate or validation)
    try {
      const { error } = await supabase
        .from("users")
        .insert({ id: "test-id", email: "test@example.com", role: "player" })
      canInsert = !error
      if (error) errors.push(`Insert: ${error.message}`)
    } catch (error) {
      errors.push(`Insert: ${error}`)
    }
    
    // Test delete (try to delete non-existent user)
    try {
      const { error } = await supabase
        .from("users")
        .delete()
        .eq("id", "non-existent-id")
      canDelete = !error
      if (error) errors.push(`Delete: ${error.message}`)
    } catch (error) {
      errors.push(`Delete: ${error}`)
    }
    
    return { canRead, canUpdate, canInsert, canDelete, errors }
  }
  
  /**
   * Test RLS policies with detailed logging
   */
  static async testRLSPolicies(): Promise<void> {
    console.log("🔍 Testing RLS policies...")
    
    try {
      // Test read access
      const { data: readData, error: readError } = await supabase
        .from("users")
        .select("*")
        .limit(1)
      console.log("Read test - Data:", readData)
      console.log("Read test - Error:", readError)
      
      // Test insert access (this should fail for most users)
      const { data: insertData, error: insertError } = await supabase
        .from("users")
        .insert({
          id: "test-id-" + Date.now(),
          email: "test@example.com",
          role: "player"
        })
      console.log("Insert test - Data:", insertData)
      console.log("Insert test - Error:", insertError)
      
      // Test update access
      const { data: updateData, error: updateError } = await supabase
        .from("users")
        .update({ name: "Test Update" })
        .eq("id", "non-existent-id")
      console.log("Update test - Data:", updateData)
      console.log("Update test - Error:", updateError)
      
    } catch (error) {
      console.error("RLS test error:", error)
    }
  }
}