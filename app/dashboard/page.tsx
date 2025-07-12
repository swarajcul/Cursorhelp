"use client"

import { useAuth } from "@/hooks/use-auth"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, User, BarChart3, Shield, DollarSign, CalendarCheck, Wallet, Trophy } from "lucide-react"
import Link from "next/link"
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import type { Database } from "@/lib/supabase"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"

type Team = Database["public"]["Tables"]["teams"]["Row"]
type SlotExpense = Database["public"]["Tables"]["slot_expenses"]["Row"]
type Winning = Database["public"]["Tables"]["winnings"]["Row"]

export default function DashboardPage() {
  const { profile, loading } = useAuth()
  const [teamStats, setTeamStats] = useState({
    totalSlotsBooked: 0,
    totalExpense: 0,
    totalWinnings: 0,
    netProfit: 0,
  })
  const [teams, setTeams] = useState<Team[]>([])
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)

  useEffect(() => {
    if (profile) {
      fetchTeams()
    }
  }, [profile])

  useEffect(() => {
    if (selectedTeamId) {
      fetchTeamStats(selectedTeamId)
    } else {
      setTeamStats({
        totalSlotsBooked: 0,
        totalExpense: 0,
        totalWinnings: 0,
        netProfit: 0,
      })
    }
  }, [selectedTeamId])

  const fetchTeams = async () => {
    try {
      let query = supabase.from("teams").select("id, name").order("name")
      if (profile?.role === "coach") {
        query = query.eq("coach_id", profile.id)
      } else if (profile?.role === "player") {
        query = query.eq("id", profile.team_id!)
      }
      const { data, error } = await query
      if (error) throw error
      setTeams(data || [])
      if (data && data.length > 0 && !selectedTeamId) {
        setSelectedTeamId(data[0].id) // Auto-select first team
      }
    } catch (error) {
      console.error("Error fetching teams for dashboard:", error)
    }
  }

  const safeSelect = async <T,>(table: string, column: string, teamId: string): Promise<T[]> => {
    try {
      const { data, error } = await supabase.from(table).select(column).eq("team_id", teamId)
      if (error) throw error
      return data as T[]
    } catch (err: any) {
      // ── Table not yet created ────────────────────────────────
      if (err?.code === "42P01" || String(err?.message).includes("does not exist")) {
        console.warn(`[Dashboard] Table "${table}" missing – defaulting to 0`)
        return [] as T[]
      }
      throw err
    }
  }

  const fetchTeamStats = async (teamId: string) => {
    try {
      // Slots count (uses head+count)
      let slotsCount = 0
      try {
        const { count, error } = await supabase
          .from("slots")
          .select("*", { count: "exact", head: true })
          .eq("team_id", teamId)
        if (error) throw error
        slotsCount = count || 0
      } catch (err: any) {
        if (err?.code === "42P01") {
          console.warn('[Dashboard] Table "slots" missing – defaulting to 0')
          slotsCount = 0
        } else {
          throw err
        }
      }

      // Expenses & Winnings
      const expenses = await safeSelect<Database["public"]["Tables"]["slot_expenses"]["Row"]>(
        "slot_expenses",
        "total",
        teamId,
      )
      const winnings = await safeSelect<Database["public"]["Tables"]["winnings"]["Row"]>(
        "winnings",
        "amount_won",
        teamId,
      )

      const totalExpense = expenses.reduce((sum, e) => sum + (e.total || 0), 0)
      const totalWinnings = winnings.reduce((sum, w) => sum + (w.amount_won || 0), 0)

      setTeamStats({
        totalSlotsBooked: slotsCount,
        totalExpense,
        totalWinnings,
        netProfit: totalWinnings - totalExpense,
      })
    } catch (error) {
      console.error("Error fetching team stats:", error)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-48 mb-2"></div>
          <div className="h-4 bg-muted rounded w-64"></div>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Loading your profile...</p>
        </div>
      </div>
    )
  }

  const getRoleDescription = (role: string) => {
    switch (role) {
      case "admin":
        return "Full system access and user management"
      case "manager":
        return "Team management and performance oversight"
      case "coach":
        return "Team coaching and performance tracking"
      case "player":
        return "View personal performance and team stats"
      case "analyst":
        return "Performance analysis and reporting"
      default:
        return "Standard user access"
    }
  }

  const getAvailableModules = (role: string) => {
    const modules = []

    if (role === "admin") {
      modules.push({
        title: "User Management",
        description: "Manage users, roles, and team assignments",
        icon: Users,
        href: "/dashboard/user-management",
      })
    }

    if (["admin", "manager", "coach", "player"].includes(role)) {
      modules.push({
        title: "Team Management",
        description: "Manage teams, rosters, slots, expenses, and prize pools",
        icon: Shield,
        href: "/dashboard/team-management",
      })
    }

    modules.push({
      title: "Profile Management",
      description: "Update your personal information and settings",
      icon: User,
      href: "/dashboard/profile",
    })

    modules.push({
      title: "Performance Tracking",
      description: "Track and analyze performance metrics",
      icon: BarChart3,
      href: "/dashboard/performance",
    })

    return modules
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Welcome to Raptor Esports CRM</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Your Role: {profile?.role?.toUpperCase()}
          </CardTitle>
          <CardDescription>{getRoleDescription(profile?.role || "")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            <p>Name: {profile?.name || "Not set"}</p>
            <p>Email: {profile?.email}</p>
            {profile?.team_id && <p>Team: {teams.find((t) => t.id === profile.team_id)?.name || profile.team_id}</p>}
          </div>
        </CardContent>
      </Card>

      {["admin", "manager", "coach", "player"].includes(profile.role.toLowerCase()) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Team Overview
            </CardTitle>
            <CardDescription>
              <Select value={selectedTeamId || ""} onValueChange={setSelectedTeamId}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select Team" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedTeamId ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Slots Booked</CardTitle>
                    <CalendarCheck className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{teamStats.totalSlotsBooked}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">₹{teamStats.totalExpense}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Winnings</CardTitle>
                    <Trophy className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">₹{teamStats.totalWinnings}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
                    <Wallet className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div
                      className={`text-2xl font-bold ${teamStats.netProfit >= 0 ? "text-green-500" : "text-red-500"}`}
                    >
                      ₹{teamStats.netProfit}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground">Select a team to view its overview.</div>
            )}
          </CardContent>
        </Card>
      )}

      <div>
        <h2 className="text-2xl font-semibold mb-4">Available Modules</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {getAvailableModules(profile?.role || "").map((module) => (
            <Link key={module.title} href={module.href}>
              <Card className="cursor-pointer hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <module.icon className="h-5 w-5" />
                    {module.title}
                  </CardTitle>
                  <CardDescription>{module.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
