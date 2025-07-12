"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import type { Database } from "@/lib/supabase"

type Performance = Database["public"]["Tables"]["performances"]["Row"]
type UserProfile = Database["public"]["Tables"]["users"]["Row"]

interface PerformanceDashboardProps {
  performances: Performance[]
  users: UserProfile[]
  currentUser: UserProfile | null
}

export function PerformanceDashboard({ performances, users, currentUser }: PerformanceDashboardProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<string>("all")
  const [selectedMap, setSelectedMap] = useState<string>("all")

  const filteredPerformances = useMemo(() => {
    return performances.filter((perf) => {
      if (selectedPlayer !== "all" && perf.player_id !== selectedPlayer) return false
      if (selectedMap !== "all" && perf.map !== selectedMap) return false
      return true
    })
  }, [performances, selectedPlayer, selectedMap])

  const stats = useMemo(() => {
    if (filteredPerformances.length === 0) {
      return {
        totalMatches: 0,
        totalKills: 0,
        avgDamage: 0,
        avgSurvivalTime: 0,
        avgKills: 0,
        avgAssists: 0,
      }
    }

    const totalKills = filteredPerformances.reduce((sum, perf) => sum + perf.kills, 0)
    const totalAssists = filteredPerformances.reduce((sum, perf) => sum + perf.assists, 0)
    const totalDamage = filteredPerformances.reduce((sum, perf) => sum + perf.damage, 0)
    const totalSurvivalTime = filteredPerformances.reduce((sum, perf) => sum + perf.survival_time, 0)

    return {
      totalMatches: filteredPerformances.length,
      totalKills,
      avgDamage: totalDamage / filteredPerformances.length,
      avgSurvivalTime: totalSurvivalTime / filteredPerformances.length,
      avgKills: totalKills / filteredPerformances.length,
      avgAssists: totalAssists / filteredPerformances.length,
    }
  }, [filteredPerformances])

  const availableMaps = useMemo(() => {
    const maps = new Set(performances.map((perf) => perf.map))
    return Array.from(maps).sort()
  }, [performances])

  const getPlayerName = (playerId: string) => {
    const user = users.find((u) => u.id === playerId)
    return user?.name || user?.email || "Unknown"
  }

  const canViewAllData = currentUser?.role && ["admin", "manager", "analyst"].includes(currentUser.role.toLowerCase())
  const availablePlayers = canViewAllData
    ? users.filter((u) => u.role === "player")
    : users.filter((u) => u.id === currentUser?.id || u.team_id === currentUser?.team_id)

  return (
    <div className="space-y-6">
      <div className="flex gap-4">
        <Select value={selectedPlayer} onValueChange={setSelectedPlayer}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by player" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Players</SelectItem>
            {availablePlayers.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.name || user.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedMap} onValueChange={setSelectedMap}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by map" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Maps</SelectItem>
            {availableMaps.map((map) => (
              <SelectItem key={map} value={map}>
                {map}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Matches</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalMatches}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Kills</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalKills}</div>
            <p className="text-xs text-muted-foreground">{stats.avgKills.toFixed(1)} avg per match</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Damage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgDamage.toFixed(0)}</div>
            <p className="text-xs text-muted-foreground">per match</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Survival</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgSurvivalTime.toFixed(1)}m</div>
            <p className="text-xs text-muted-foreground">per match</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Performance History</CardTitle>
          <CardDescription>Detailed match performance data</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Player</TableHead>
                <TableHead>Match</TableHead>
                <TableHead>Slot</TableHead>
                <TableHead>Map</TableHead>
                <TableHead>Placement</TableHead>
                <TableHead>K/A</TableHead>
                <TableHead>Damage</TableHead>
                <TableHead>Survival</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPerformances.map((performance) => (
                <TableRow key={performance.id}>
                  <TableCell>{getPlayerName(performance.player_id)}</TableCell>
                  <TableCell>#{performance.match_number}</TableCell>
                  <TableCell>{performance.slot}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{performance.map}</Badge>
                  </TableCell>
                  <TableCell>{performance.placement ? `#${performance.placement}` : "-"}</TableCell>
                  <TableCell>
                    {performance.kills}/{performance.assists}
                  </TableCell>
                  <TableCell>{performance.damage.toFixed(0)}</TableCell>
                  <TableCell>{performance.survival_time.toFixed(1)}m</TableCell>
                  <TableCell>{new Date(performance.created_at).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {filteredPerformances.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No performance data found for the selected filters.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
