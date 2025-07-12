"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useAuth } from "@/hooks/use-auth"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { Edit, Trash2 } from "lucide-react"
import type { Database } from "@/lib/supabase"

type Team = Database["public"]["Tables"]["teams"]["Row"]
type UserProfile = Database["public"]["Tables"]["users"]["Row"]

const TEAM_TIERS = ["God", "T1", "T2", "T3", "T4"]
const TEAM_STATUSES = ["active", "archived"]

export default function TeamsPage() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const [teams, setTeams] = useState<Team[]>([])
  const [coaches, setCoaches] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [formLoading, setFormLoading] = useState(false)
  const [editingTeam, setEditingTeam] = useState<Team | null>(null)
  const [newTeamName, setNewTeamName] = useState("")
  const [newTeamTier, setNewTeamTier] = useState<string>("T4")
  const [newTeamCoach, setNewTeamCoach] = useState<string | null>(null)
  const [newTeamStatus, setNewTeamStatus] = useState<string>("active")

  useEffect(() => {
    fetchTeams()
    fetchCoaches()
  }, [profile])

  const fetchTeams = async () => {
    setLoading(true)
    try {
      let query = supabase.from("teams").select("*, coach:coach_id(name, email)").order("name")

      if (profile?.role === "coach") {
        query = query.eq("coach_id", profile.id)
      } else if (profile?.role === "player") {
        query = query.eq("id", profile.team_id!)
      }

      const { data, error } = await query

      if (error) throw error
      setTeams(data || [])
    } catch (error: any) {
      console.error("Error fetching teams:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to fetch teams",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchCoaches = async () => {
    try {
      const { data, error } = await supabase.from("users").select("id, name, email").eq("role", "coach")
      if (error) throw error
      setCoaches(data || [])
    } catch (error) {
      console.error("Error fetching coaches:", error)
    }
  }

  const handleCreateOrUpdateTeam = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormLoading(true)
    try {
      if (editingTeam) {
        // Update team
        const { error } = await supabase
          .from("teams")
          .update({
            name: newTeamName,
            tier: newTeamTier,
            coach_id: newTeamCoach,
            status: newTeamStatus,
          })
          .eq("id", editingTeam.id)

        if (error) throw error
        toast({ title: "Success", description: "Team updated successfully." })
      } else {
        // Create team
        const { error } = await supabase.from("teams").insert({
          name: newTeamName,
          tier: newTeamTier,
          coach_id: newTeamCoach,
          status: newTeamStatus,
        })

        if (error) throw error
        toast({ title: "Success", description: "Team created successfully." })
      }
      resetForm()
      fetchTeams()
    } catch (error: any) {
      console.error("Error saving team:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to save team.",
        variant: "destructive",
      })
    } finally {
      setFormLoading(false)
    }
  }

  const handleDeleteTeam = async (teamId: string) => {
    if (!confirm("Are you sure you want to delete this team? This action cannot be undone.")) {
      return
    }
    setFormLoading(true)
    try {
      const { error } = await supabase.from("teams").delete().eq("id", teamId)
      if (error) throw error
      toast({ title: "Success", description: "Team deleted successfully." })
      fetchTeams()
    } catch (error: any) {
      console.error("Error deleting team:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to delete team.",
        variant: "destructive",
      })
    } finally {
      setFormLoading(false)
    }
  }

  const startEditing = (team: Team) => {
    setEditingTeam(team)
    setNewTeamName(team.name)
    setNewTeamTier(team.tier || "T4")
    setNewTeamCoach(team.coach_id)
    setNewTeamStatus(team.status || "active")
  }

  const resetForm = () => {
    setEditingTeam(null)
    setNewTeamName("")
    setNewTeamTier("T4")
    setNewTeamCoach(null)
    setNewTeamStatus("active")
  }

  const canManage = profile?.role && ["admin", "manager"].includes(profile.role.toLowerCase())

  if (loading) {
    return <div>Loading teams...</div>
  }

  return (
    <div className="space-y-6">
      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle>{editingTeam ? "Edit Team" : "Create New Team"}</CardTitle>
            <CardDescription>
              {editingTeam ? `Editing ${editingTeam.name}` : "Add a new esports team to the CRM."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateOrUpdateTeam} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="teamName">Team Name</Label>
                <Input
                  id="teamName"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="e.g., Raptor Alpha"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="teamTier">Tier</Label>
                <Select value={newTeamTier} onValueChange={setNewTeamTier}>
                  <SelectTrigger id="teamTier">
                    <SelectValue placeholder="Select Tier" />
                  </SelectTrigger>
                  <SelectContent>
                    {TEAM_TIERS.map((tier) => (
                      <SelectItem key={tier} value={tier}>
                        {tier}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="teamCoach">Coach Assigned</Label>
                <Select
                  value={newTeamCoach || ""}
                  onValueChange={(value) => setNewTeamCoach(value === "none" ? null : value)}
                >
                  <SelectTrigger id="teamCoach">
                    <SelectValue placeholder="Select Coach" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Coach</SelectItem>
                    {coaches.map((coach) => (
                      <SelectItem key={coach.id} value={coach.id}>
                        {coach.name || coach.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="teamStatus">Status</Label>
                <Select value={newTeamStatus} onValueChange={setNewTeamStatus}>
                  <SelectTrigger id="teamStatus">
                    <SelectValue placeholder="Select Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {TEAM_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 flex gap-2">
                <Button type="submit" disabled={formLoading}>
                  {formLoading ? "Saving..." : editingTeam ? "Update Team" : "Create Team"}
                </Button>
                {editingTeam && (
                  <Button type="button" variant="outline" onClick={resetForm} disabled={formLoading}>
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All Teams</CardTitle>
          <CardDescription>Overview of all registered esports teams.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Coach</TableHead>
                <TableHead>Status</TableHead>
                {canManage && <TableHead>Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {teams.map((team) => (
                <TableRow key={team.id}>
                  <TableCell className="font-medium">{team.name}</TableCell>
                  <TableCell>{team.tier}</TableCell>
                  <TableCell>
                    {(team.coach as UserProfile)?.name || (team.coach as UserProfile)?.email || "N/A"}
                  </TableCell>
                  <TableCell>{team.status}</TableCell>
                  {canManage && (
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => startEditing(team)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleDeleteTeam(team.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {teams.length === 0 && <div className="text-center py-8 text-muted-foreground">No teams found.</div>}
        </CardContent>
      </Card>
    </div>
  )
}
