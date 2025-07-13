"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/use-auth"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Trash2, Edit } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import type { Database } from "@/lib/supabase"
import { UserManagementService } from "@/lib/user-management"
import { SupabaseAdminService } from "@/lib/supabase-admin"
import { SessionManager } from "@/lib/session-manager"
import { ProfileFixer } from "@/lib/profile-fixer"
import { AuthProfileSync } from "@/lib/auth-profile-sync"
import { SecureProfileCreation } from "@/lib/secure-profile-creation"
import { RoleAccess, ROLE_CONFIG } from "@/lib/role-system"

type UserProfile = Database["public"]["Tables"]["users"]["Row"]
type Team = Database["public"]["Tables"]["teams"]["Row"]

export default function UserManagementPage() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const [users, setUsers] = useState<UserProfile[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null)
  const [debugInfo, setDebugInfo] = useState<any>(null)
  const [showDebug, setShowDebug] = useState(false)
  const [showManualCreate, setShowManualCreate] = useState(false)
  const [manualEmail, setManualEmail] = useState("")
  const [manualName, setManualName] = useState("")

  useEffect(() => {
    if (profile?.role?.toLowerCase() !== "admin") {
      return
    }

    fetchUsers()
    fetchTeams()
    
    // Set up real-time subscription for user changes
    const subscription = supabase
      .channel('user-management-changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'users' 
        }, 
        (payload) => {
          console.log('📡 Real-time user change detected:', payload)
          // Refresh users list when changes occur
          fetchUsers()
        }
      )
      .subscribe()

    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe()
    }
  }, [profile])

  const fetchUsers = async () => {
    try {
      console.log("🔍 Fetching users for admin panel...")
      
      // Try admin service first
      const { data: adminData, error: adminError } = await SupabaseAdminService.getAllUsers()
      
      if (adminData && !adminError) {
        console.log(`✅ Admin service found ${adminData.length} users`)
        setUsers(adminData)
        return
      }
      
      console.log("⚠️ Admin service failed, trying direct query...")
      
      // Fallback to direct query
      const { data, error } = await supabase.from("users").select("*").order("created_at", { ascending: false })

      if (error) {
        console.error("❌ Direct query also failed:", error)
        throw error
      }
      
      console.log(`✅ Direct query found ${data?.length || 0} users`)
      setUsers(data || [])
    } catch (error: any) {
      console.error("❌ Error fetching users:", error)
      toast({
        title: "Error",
        description: `Failed to fetch users: ${error.message}`,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchTeams = async () => {
    try {
      const { data, error } = await supabase.from("teams").select("*").order("name")

      if (error) throw error
      setTeams(data || [])
    } catch (error) {
      console.error("Error fetching teams:", error)
    }
  }

  const updateUser = async (userId: string, updates: Partial<UserProfile>) => {
    try {
      console.log("🔧 Attempting to update user:", userId, updates)
      
      // If updating role, use admin service
      if (updates.role && profile?.id) {
        const { data, error } = await SupabaseAdminService.updateUserRole(
          userId, 
          updates.role, 
          profile.id
        )
        
        if (error) {
          throw error
        }
        
        console.log("✅ Role updated via admin service")
      }
      
      // For other updates, use the standard service
      if (Object.keys(updates).some(key => key !== 'role')) {
        const result = await UserManagementService.updateUser(userId, updates)
        
        if (!result.success) {
          throw result.error
        }
      }
      
      // Update local state optimistically
      setUsers(users.map((user) => (user.id === userId ? { ...user, ...updates } : user)))
      
      toast({
        title: "Success",
        description: "User updated successfully",
      })
      
      setEditingUser(null)
      
      // Refresh to ensure we have latest data
      setTimeout(() => fetchUsers(), 500)
      
    } catch (error: any) {
      console.error("❌ Error updating user:", error)
      
      const errorMessage = error?.message || "Failed to update user"
      console.error("Detailed error:", {
        message: errorMessage,
        error: error,
        userId,
        updates
      })
      
      toast({
        title: "Error", 
        description: `Failed to update user: ${errorMessage}`,
        variant: "destructive",
      })
    }
  }



  const deleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user?")) {
      return
    }

    try {
      const { error } = await supabase.from("users").delete().eq("id", userId)

      if (error) throw error

      setUsers(users.filter((user) => user.id !== userId))

      toast({
        title: "Success",
        description: "User deleted successfully",
      })
    } catch (error) {
      console.error("Error deleting user:", error)
      toast({
        title: "Error",
        description: "Failed to delete user",
        variant: "destructive",
      })
    }
  }

  const runDiagnostics = async () => {
    if (!profile?.id) return
    
    try {
      console.log("🔍 Running comprehensive diagnostics...")
      
      const results = {
        timestamp: new Date().toISOString(),
        currentUser: {
          id: profile.id,
          email: profile.email,
          role: profile.role
        },
        sessionInfo: SessionManager.getSessionStatus(),
        adminPermissions: await SupabaseAdminService.testAdminPermissions(profile.id),
        userCounts: {
          visible: users.length,
          expected: 7 // User mentioned 7 users in database
        },
        profileDiagnostics: await ProfileFixer.getDatabaseDiagnostics(),
        syncStatus: await AuthProfileSync.getSyncStatus(),
        supabaseConnectionTest: await (async () => {
          try {
            const { data, error } = await supabase.from('users').select('count', { count: 'exact' })
            return {
              success: !error,
              error: error?.message,
              count: data?.length || 0
            }
          } catch (e: any) {
            return {
              success: false,
              error: e.message,
              count: 0
            }
          }
        })()
      }
      
      console.log("📊 Diagnostic results:", results)
      setDebugInfo(results)
      setShowDebug(true)
      
    } catch (error) {
      console.error("❌ Diagnostics failed:", error)
      toast({
        title: "Diagnostic Error",
        description: "Failed to run diagnostics",
        variant: "destructive"
      })
    }
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "admin":
        return "destructive"
      case "manager":
        return "default"
      case "coach":
        return "secondary"
      case "player":
        return "outline"
      case "analyst":
        return "secondary"
      case "pending_player":
        return "outline" // Yellow/warning style would be ideal
      case "awaiting_approval":
        return "outline" // Orange/warning style would be ideal
      default:
        return "outline"
    }
  }

  if (profile?.role?.toLowerCase() !== "admin") {
    return (
      <Alert>
        <AlertDescription>You don't have permission to access this page.</AlertDescription>
      </Alert>
    )
  }

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
        <p className="text-muted-foreground">Manage users, roles, and team assignments</p>
        
        {/* Debug section - remove in production */}
        {profile?.role === "admin" && (
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h3 className="font-semibold text-yellow-800 mb-2">Debug Tools</h3>
            <Button
              size="sm"
              variant="outline"
              onClick={() => UserManagementService.testRLSPolicies()}
              className="mr-2"
            >
              Test RLS Policies
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                const permissions = await UserManagementService.testDatabasePermissions()
                console.log("Database permissions test:", permissions)
                toast({
                  title: "Database Permissions Test",
                  description: `Read: ${permissions.canRead}, Update: ${permissions.canUpdate}, Insert: ${permissions.canInsert}, Delete: ${permissions.canDelete}`,
                })
              }}
              className="mr-2"
            >
              Test DB Permissions
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={runDiagnostics}
              className="mr-2"
            >
              Run Full Diagnostics
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                try {
                  const result = await AuthProfileSync.createMissingProfiles()
                  
                  if (result.success) {
                    toast({
                      title: "Profile Sync Complete",
                      description: `Created ${result.created} missing profiles`,
                    })
                    // Refresh the user list
                    fetchUsers()
                  } else {
                    toast({
                      title: "Profile Sync Failed",
                      description: result.error || "Unknown error",
                      variant: "destructive"
                    })
                  }
                } catch (error: any) {
                  toast({
                    title: "Profile Sync Error",
                    description: error.message,
                    variant: "destructive"
                  })
                }
              }}
              className="mr-2"
            >
              Sync Missing Profiles
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                try {
                  const status = await AuthProfileSync.getSyncStatus()
                  console.log("Sync Status:", status)
                  
                  toast({
                    title: "Sync Status",
                    description: `Profiles: ${status.profiles?.count || 0}, Auth Users: ${status.authUsers?.accessible ? status.authUsers.count : 'Unknown'}`,
                  })
                } catch (error: any) {
                  toast({
                    title: "Sync Status Error",
                    description: error.message,
                    variant: "destructive"
                  })
                }
              }}
              className="mr-2"
            >
              Check Sync Status
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowManualCreate(true)}
              className="mr-2"
            >
              Manual Create Profile
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={async () => {
                const confirmed = window.confirm(
                  "EMERGENCY: Create admin profile for current session?\n\n" +
                  "This will create an admin profile for the currently logged-in user.\n" +
                  "Only use this if you're locked out due to missing admin profile."
                )
                
                if (!confirmed) return
                
                try {
                  const { data: { user } } = await supabase.auth.getUser()
                  
                  if (!user) {
                    toast({
                      title: "Error",
                      description: "No authenticated user found",
                      variant: "destructive"
                    })
                    return
                  }
                  
                  const result = await SecureProfileCreation.createAdminProfile(
                    user.id,
                    user.email || '',
                    user.user_metadata?.name || user.email?.split('@')[0] || 'Admin'
                  )
                  
                  if (result.success) {
                    toast({
                      title: "Emergency Admin Created",
                      description: `Admin profile created for ${user.email}`,
                    })
                    // Refresh the page to load the new profile
                    window.location.reload()
                  } else {
                    toast({
                      title: "Emergency Admin Failed",
                      description: result.error || "Unknown error",
                      variant: "destructive"
                    })
                  }
                } catch (error: any) {
                  toast({
                    title: "Emergency Admin Error",
                    description: error.message,
                    variant: "destructive"
                  })
                }
              }}
              className="mr-2"
            >
              🚨 Emergency Admin
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                const hasPermission = await UserManagementService.checkUpdatePermission()
                console.log("Current profile:", profile)
                console.log("Users:", users)
                console.log("Has update permission:", hasPermission)
                toast({
                  title: "Current State",
                  description: `Profile: ${profile?.role}, Has Permission: ${hasPermission}`,
                })
              }}
            >
              Log Current State
            </Button>
            
            {showDebug && debugInfo && (
              <div className="mt-4 p-3 bg-gray-50 border rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-semibold">Diagnostic Results</h4>
                  <Button size="sm" variant="ghost" onClick={() => setShowDebug(false)}>
                    Close
                  </Button>
                </div>
                                 <pre className="text-xs overflow-auto max-h-64 whitespace-pre-wrap">
                   {JSON.stringify(debugInfo, null, 2)}
                 </pre>
               </div>
             )}
             
             {showManualCreate && (
               <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                 <div className="flex justify-between items-center mb-3">
                   <h4 className="font-semibold text-blue-800">Manually Create Missing Profile</h4>
                   <Button size="sm" variant="ghost" onClick={() => setShowManualCreate(false)}>
                     Close
                   </Button>
                 </div>
                 <div className="space-y-3">
                   <div>
                     <label className="block text-sm font-medium text-gray-700 mb-1">
                       Email Address
                     </label>
                     <input
                       type="email"
                       value={manualEmail}
                       onChange={(e) => setManualEmail(e.target.value)}
                       className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                       placeholder="user@example.com"
                     />
                   </div>
                   <div>
                     <label className="block text-sm font-medium text-gray-700 mb-1">
                       Name (Optional)
                     </label>
                     <input
                       type="text"
                       value={manualName}
                       onChange={(e) => setManualName(e.target.value)}
                       className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                       placeholder="User Name"
                     />
                   </div>
                   <Button
                     size="sm"
                     onClick={async () => {
                       if (!manualEmail) {
                         toast({
                           title: "Error",
                           description: "Email is required",
                           variant: "destructive"
                         })
                         return
                       }
                       
                       try {
                         const result = await AuthProfileSync.createProfileManually(
                           manualEmail,
                           manualName || undefined,
                           'pending_player'
                         )
                         
                         if (result.success) {
                           toast({
                             title: "Profile Created",
                             description: `Profile created for ${manualEmail}`,
                           })
                           setManualEmail("")
                           setManualName("")
                           setShowManualCreate(false)
                           fetchUsers()
                         } else {
                           toast({
                             title: "Profile Creation Failed",
                             description: result.error || "Unknown error",
                             variant: "destructive"
                           })
                         }
                       } catch (error: any) {
                         toast({
                           title: "Profile Creation Error",
                           description: error.message,
                           variant: "destructive"
                         })
                       }
                     }}
                     className="mr-2"
                   >
                     Create Profile
                   </Button>
                 </div>
               </div>
             )}
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>Manage user roles and team assignments</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Team</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.name || "Not set"}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Badge variant={getRoleBadgeVariant(user.role)}>{user.role}</Badge>
                  </TableCell>
                  <TableCell>{teams.find((t) => t.id === user.team_id)?.name || "No team"}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setEditingUser(user)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => deleteUser(user.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {editingUser && (
        <Card>
          <CardHeader>
            <CardTitle>Edit User</CardTitle>
            <CardDescription>Update user role and team assignment</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  value={editingUser.role}
                  onValueChange={(value) => setEditingUser({ ...editingUser, role: value as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="coach">Coach</SelectItem>
                    <SelectItem value="player">Player</SelectItem>
                    <SelectItem value="analyst">Analyst</SelectItem>
                    <SelectItem value="pending_player">Pending Player</SelectItem>
                    <SelectItem value="awaiting_approval">Awaiting Approval</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Team</Label>
                <Select
                  value={editingUser.team_id || "none"}
                  onValueChange={(value) =>
                    setEditingUser({
                      ...editingUser,
                      team_id: value === "none" ? null : value,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select team" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No team</SelectItem>
                    {teams.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() =>
                  updateUser(editingUser.id, {
                    role: editingUser.role,
                    team_id: editingUser.team_id,
                  })
                }
              >
                Save Changes
              </Button>
              <Button variant="outline" onClick={() => setEditingUser(null)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
