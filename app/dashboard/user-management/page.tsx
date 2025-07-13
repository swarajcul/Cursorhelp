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

type UserProfile = Database["public"]["Tables"]["users"]["Row"]
type Team = Database["public"]["Tables"]["teams"]["Row"]

export default function UserManagementPage() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const [users, setUsers] = useState<UserProfile[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null)

  useEffect(() => {
    if (profile?.role?.toLowerCase() !== "admin") {
      return
    }

    fetchUsers()
    fetchTeams()
  }, [profile])

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase.from("users").select("*").order("created_at", { ascending: false })

      if (error) throw error
      setUsers(data || [])
    } catch (error) {
      console.error("Error fetching users:", error)
      toast({
        title: "Error",
        description: "Failed to fetch users",
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
      
      // Use the new UserManagementService
      const result = await UserManagementService.updateUser(userId, updates)
      
      if (result.success) {
        // Update local state with the new data
        setUsers(users.map((user) => (user.id === userId ? { ...user, ...updates } : user)))
        
        toast({
          title: "Success",
          description: "User updated successfully",
        })
        
        setEditingUser(null)
      } else {
        // Handle the error
        throw result.error
      }
    } catch (error) {
      console.error("Error updating user:", error)
      
      // Enhanced error reporting
      const errorMessage = error instanceof Error ? error.message : "Failed to update user"
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
