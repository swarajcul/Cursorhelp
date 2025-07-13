import { supabase } from "./supabase"
import { RoleAccess, ROLES, type UserRole } from "./role-system"

export class SecureProfileCreation {
  /**
   * Create a new user profile with proper default role
   */
  static async createProfile(userId: string, email: string, name?: string): Promise<{
    success: boolean
    profile?: any
    error?: string
  }> {
    try {
      console.log(`🔧 Creating profile for user: ${email}`)
      
      // Check if profile already exists
      const { data: existingProfile, error: checkError } = await supabase
        .from('users')
        .select('id, email, role')
        .eq('id', userId)
        .single()
      
      if (existingProfile) {
        console.log(`✅ Profile already exists for ${email}`)
        return {
          success: true,
          profile: existingProfile
        }
      }
      
      // Get safe default role
      const defaultRole = RoleAccess.getDefaultRole()
      const defaultRoleLevel = RoleAccess.getRoleInfo(defaultRole).level
      
      // Create profile with safe defaults
      const profileData = {
        id: userId,
        email: email,
        name: name || email.split('@')[0] || 'User',
        role: defaultRole,
        role_level: defaultRoleLevel,
        created_at: new Date().toISOString()
      }
      
      console.log(`📝 Creating profile with role: ${defaultRole}`)
      
      const { data: newProfile, error: createError } = await supabase
        .from('users')
        .insert(profileData)
        .select()
        .single()
      
      if (createError) {
        console.error('❌ Profile creation failed:', createError)
        
        // Try to provide more specific error messages
        if (createError.code === '23514') {
          return {
            success: false,
            error: `Invalid role constraint. The role '${defaultRole}' is not allowed. Please contact an administrator.`
          }
        }
        
        return {
          success: false,
          error: `Failed to create profile: ${createError.message}`
        }
      }
      
      console.log(`✅ Profile created successfully for ${email}`)
      
      return {
        success: true,
        profile: newProfile
      }
      
    } catch (error: any) {
      console.error('❌ Profile creation error:', error)
      return {
        success: false,
        error: error.message || 'Unknown error occurred'
      }
    }
  }
  
  /**
   * Update user role (admin only)
   */
  static async updateUserRole(
    currentUserId: string,
    targetUserId: string,
    newRole: UserRole
  ): Promise<{
    success: boolean
    profile?: any
    error?: string
  }> {
    try {
      console.log(`🔧 Updating user role: ${targetUserId} -> ${newRole}`)
      
      // Get current user's profile to verify permissions
      const { data: currentUser, error: currentUserError } = await supabase
        .from('users')
        .select('id, role')
        .eq('id', currentUserId)
        .single()
      
      if (currentUserError || !currentUser) {
        return {
          success: false,
          error: 'Unable to verify your permissions'
        }
      }
      
      // Get target user's profile
      const { data: targetUser, error: targetUserError } = await supabase
        .from('users')
        .select('id, role')
        .eq('id', targetUserId)
        .single()
      
      if (targetUserError || !targetUser) {
        return {
          success: false,
          error: 'Target user not found'
        }
      }
      
      // Validate role assignment
      const validation = RoleAccess.validateRoleAssignment(currentUser.role, newRole)
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error
        }
      }
      
      // Check if user can update this specific user's role
      const canUpdate = RoleAccess.canUpdateUserRole(
        currentUser.role,
        targetUser.role,
        newRole
      )
      
      if (!canUpdate) {
        return {
          success: false,
          error: 'You do not have permission to update this user\'s role'
        }
      }
      
      // Update the role
      const newRoleLevel = RoleAccess.getRoleInfo(newRole).level
      
      const { data: updatedProfile, error: updateError } = await supabase
        .from('users')
        .update({
          role: newRole,
          role_level: newRoleLevel
        })
        .eq('id', targetUserId)
        .select()
        .single()
      
      if (updateError) {
        console.error('❌ Role update failed:', updateError)
        
        if (updateError.code === '23514') {
          return {
            success: false,
            error: `Invalid role constraint. The role '${newRole}' is not allowed in the database.`
          }
        }
        
        return {
          success: false,
          error: `Failed to update role: ${updateError.message}`
        }
      }
      
      console.log(`✅ Role updated successfully: ${targetUserId} -> ${newRole}`)
      
      return {
        success: true,
        profile: updatedProfile
      }
      
    } catch (error: any) {
      console.error('❌ Role update error:', error)
      return {
        success: false,
        error: error.message || 'Unknown error occurred'
      }
    }
  }
  
  /**
   * Create admin profile (emergency use only)
   */
  static async createAdminProfile(userId: string, email: string, name: string): Promise<{
    success: boolean
    profile?: any
    error?: string
  }> {
    try {
      console.log(`🚨 Creating ADMIN profile for: ${email}`)
      
      // This is a special case - create with admin role directly
      const profileData = {
        id: userId,
        email: email,
        name: name,
        role: ROLES.ADMIN,
        role_level: 100,
        created_at: new Date().toISOString()
      }
      
      const { data: newProfile, error: createError } = await supabase
        .from('users')
        .insert(profileData)
        .select()
        .single()
      
      if (createError) {
        console.error('❌ Admin profile creation failed:', createError)
        return {
          success: false,
          error: `Failed to create admin profile: ${createError.message}`
        }
      }
      
      console.log(`✅ Admin profile created successfully for ${email}`)
      
      return {
        success: true,
        profile: newProfile
      }
      
    } catch (error: any) {
      console.error('❌ Admin profile creation error:', error)
      return {
        success: false,
        error: error.message || 'Unknown error occurred'
      }
    }
  }
  
  /**
   * Batch create profiles with default role
   */
  static async batchCreateProfiles(users: Array<{
    id: string
    email: string
    name?: string
  }>): Promise<{
    success: boolean
    created: number
    errors: string[]
    profiles?: any[]
  }> {
    try {
      console.log(`🔧 Batch creating ${users.length} profiles`)
      
      const defaultRole = RoleAccess.getDefaultRole()
      const defaultRoleLevel = RoleAccess.getRoleInfo(defaultRole).level
      
      const profilesToCreate = users.map(user => ({
        id: user.id,
        email: user.email,
        name: user.name || user.email.split('@')[0] || 'User',
        role: defaultRole,
        role_level: defaultRoleLevel,
        created_at: new Date().toISOString()
      }))
      
      const { data: createdProfiles, error: createError } = await supabase
        .from('users')
        .insert(profilesToCreate)
        .select()
      
      if (createError) {
        console.error('❌ Batch profile creation failed:', createError)
        return {
          success: false,
          created: 0,
          errors: [createError.message]
        }
      }
      
      console.log(`✅ Batch created ${createdProfiles?.length || 0} profiles`)
      
      return {
        success: true,
        created: createdProfiles?.length || 0,
        errors: [],
        profiles: createdProfiles
      }
      
    } catch (error: any) {
      console.error('❌ Batch profile creation error:', error)
      return {
        success: false,
        created: 0,
        errors: [error.message || 'Unknown error occurred']
      }
    }
  }
  
  /**
   * Get database schema information for debugging
   */
  static async getDatabaseConstraints(): Promise<{
    success: boolean
    constraints?: any
    error?: string
  }> {
    try {
      // Try to get constraint information
      const { data, error } = await supabase
        .rpc('get_table_constraints', { table_name: 'users' })
      
      if (error) {
        console.log('⚠️ Could not fetch constraints (expected with limited permissions)')
        return {
          success: false,
          error: 'Unable to fetch database constraints'
        }
      }
      
      return {
        success: true,
        constraints: data
      }
      
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      }
    }
  }
  
  /**
   * Test profile creation with different roles
   */
  static async testRoleConstraints(): Promise<{
    success: boolean
    results: Array<{
      role: string
      valid: boolean
      error?: string
    }>
  }> {
    const results: Array<{
      role: string
      valid: boolean
      error?: string
    }> = []
    
    const testRoles = RoleAccess.getAllRoles()
    
    for (const role of testRoles) {
      try {
        // Test with a dummy UUID and email
        const testId = 'test-' + Math.random().toString(36).substring(7)
        const testEmail = `test-${role}@example.com`
        
        const { data, error } = await supabase
          .from('users')
          .insert({
            id: testId,
            email: testEmail,
            name: `Test ${role}`,
            role: role,
            role_level: RoleAccess.getRoleInfo(role).level
          })
          .select()
        
        if (error) {
          results.push({
            role: role,
            valid: false,
            error: error.message
          })
        } else {
          results.push({
            role: role,
            valid: true
          })
          
          // Clean up test record
          await supabase
            .from('users')
            .delete()
            .eq('id', testId)
        }
        
      } catch (error: any) {
        results.push({
          role: role,
          valid: false,
          error: error.message
        })
      }
    }
    
    return {
      success: true,
      results: results
    }
  }
}