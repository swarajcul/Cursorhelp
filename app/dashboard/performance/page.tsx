"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/hooks/use-auth"
import { supabase } from "@/lib/supabase"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AddPerformance } from "@/components/performance/add-performance"
import { OCRExtract } from "@/components/performance/ocr-extract"
import { PerformanceDashboard } from "@/components/performance/performance-dashboard"
import { PlayerPerformanceSubmit } from "@/components/performance/player-performance-submit"
import type { Database } from "@/lib/supabase"

type Performance = Database["public"]["Tables"]["performances"]["Row"]
type UserProfile = Database["public"]["Tables"]["users"]["Row"]

export default function PerformancePage() {
  const { profile } = useAuth()
  const [performances, setPerformances] = useState<Performance[]>([])
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPerformances()
    fetchUsers()
  }, [profile])

  const fetchPerformances = async () => {
    if (!profile) return

    try {
      let query = supabase.from("performances").select("*")

      // Apply role-based filtering
      if (profile.role === "player") {
        query = query.eq("player_id", profile.id)
      } else if (profile.role === "coach" && profile.team_id) {
        query = query.eq("team_id", profile.team_id)
      }
      // Admin, manager, and analyst can see all

      const { data, error } = await query.order("created_at", { ascending: false })

      if (error) throw error
      setPerformances(data || [])
    } catch (error) {
      console.error("Error fetching performances:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase.from("users").select("*").order("name")

      if (error) throw error
      setUsers(data || [])
    } catch (error) {
      console.error("Error fetching users:", error)
    }
  }

  const canEdit = profile?.role && ["admin", "manager", "coach"].includes(profile.role.toLowerCase())

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Performance Tracking</h1>
        <p className="text-muted-foreground">Track and analyze match performance data</p>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList>
          <TabsTrigger value="dashboard">📈 Dashboard</TabsTrigger>
          {profile?.role === "player" && <TabsTrigger value="submit">🎮 Submit Performance</TabsTrigger>}
          {canEdit && <TabsTrigger value="add">➕ Add Performance</TabsTrigger>}
          {canEdit && <TabsTrigger value="ocr">📷 OCR Extract</TabsTrigger>}
        </TabsList>

        <TabsContent value="dashboard">
          <PerformanceDashboard performances={performances} users={users} currentUser={profile} />
        </TabsContent>

        {profile?.role === "player" && (
          <TabsContent value="submit">
            <PlayerPerformanceSubmit onPerformanceAdded={fetchPerformances} />
          </TabsContent>
        )}

        {canEdit && (
          <TabsContent value="add">
            <AddPerformance users={users} onPerformanceAdded={fetchPerformances} />
          </TabsContent>
        )}

        {canEdit && (
          <TabsContent value="ocr">
            <OCRExtract users={users} onPerformanceAdded={fetchPerformances} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
