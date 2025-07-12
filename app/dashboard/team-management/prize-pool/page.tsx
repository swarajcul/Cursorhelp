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
import { Trash2 } from "lucide-react"
import type { Database } from "@/lib/supabase"

type Team = Database["public"]["Tables"]["teams"]["Row"]
type Slot = Database["public"]["Tables"]["slots"]["Row"] & { team: Team | null }
type PrizePool = Database["public"]["Tables"]["prize_pools"]["Row"] & { slot: Slot | null }
type Winning = Database["public"]["Tables"]["winnings"]["Row"] & { slot: Slot | null; team: Team | null }

export default function PrizePoolPage() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const [slots, setSlots] = useState<Slot[]>([])
  const [prizePools, setPrizePools] = useState<PrizePool[]>([])
  const [winnings, setWinnings] = useState<Winning[]>([])
  const [teams, setTeams] = useState<Team[]>([]) // For assigning winnings
  const [loading, setLoading] = useState(true)
  const [formLoading, setFormLoading] = useState(false)

  const [newPrizePoolData, setNewPrizePoolData] = useState({
    slot_id: "",
    total_amount: 0,
    breakdown: { "1st": 0, "2nd": 0, "3rd": 0, "4th": 0 },
  })

  const [newWinningData, setNewWinningData] = useState({
    slot_id: "",
    team_id: "",
    position: 1,
    amount_won: 0,
  })

  useEffect(() => {
    fetchData()
  }, [profile])

  const fetchData = async () => {
    setLoading(true)
    try {
      // Fetch slots
      let slotsQuery = supabase.from("slots").select("*, team:team_id(name)").order("date", { ascending: false })
      if (profile?.role === "coach" || profile?.role === "player") {
        slotsQuery = slotsQuery.eq("team_id", profile.team_id!)
      }
      const { data: slotsData, error: slotsError } = await slotsQuery
      if (slotsError) throw slotsError
      setSlots(slotsData || [])
      if (slotsData && slotsData.length > 0 && !newPrizePoolData.slot_id) {
        setNewPrizePoolData((prev) => ({ ...prev, slot_id: slotsData[0].id }))
        setNewWinningData((prev) => ({ ...prev, slot_id: slotsData[0].id }))
      }

      // Fetch prize pools
      let prizePoolsQuery = supabase
        .from("prize_pools")
        .select("*, slot:slot_id(organizer, time_range, date, team_id)")
        .order("created_at", { ascending: false })
      if (profile?.role === "coach" || profile?.role === "player") {
        prizePoolsQuery = prizePoolsQuery.in("slot_id", slotsData?.map((s) => s.id) || [])
      }
      const { data: prizePoolsData, error: prizePoolsError } = await prizePoolsQuery
      if (prizePoolsError) throw prizePoolsError
      setPrizePools(prizePoolsData || [])

      // Fetch winnings
      let winningsQuery = supabase
        .from("winnings")
        .select("*, slot:slot_id(organizer, time_range, date), team:team_id(name)")
        .order("created_at", { ascending: false })
      if (profile?.role === "coach" || profile?.role === "player") {
        winningsQuery = winningsQuery.in("slot_id", slotsData?.map((s) => s.id) || [])
      }
      const { data: winningsData, error: winningsError } = await winningsQuery
      if (winningsError) throw winningsError
      setWinnings(winningsData || [])

      // Fetch teams for winning assignment
      let teamsQuery = supabase.from("teams").select("id, name").order("name")
      if (profile?.role === "coach") {
        teamsQuery = teamsQuery.eq("id", profile.team_id!)
      } else if (profile?.role === "player") {
        teamsQuery = teamsQuery.eq("id", profile.team_id!)
      }
      const { data: teamsData, error: teamsError } = await teamsQuery
      if (teamsError) throw teamsError
      setTeams(teamsData || [])
      if (teamsData && teamsData.length > 0 && !newWinningData.team_id) {
        setNewWinningData((prev) => ({ ...prev, team_id: teamsData[0].id }))
      }
    } catch (error: any) {
      console.error("Error fetching data:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to fetch data.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreatePrizePool = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormLoading(true)
    try {
      const { error } = await supabase.from("prize_pools").insert({
        slot_id: newPrizePoolData.slot_id,
        total_amount: newPrizePoolData.total_amount,
        breakdown: newPrizePoolData.breakdown,
      })
      if (error) throw error
      toast({ title: "Success", description: "Prize pool created successfully." })
      setNewPrizePoolData({
        slot_id: slots[0]?.id || "",
        total_amount: 0,
        breakdown: { "1st": 0, "2nd": 0, "3rd": 0, "4th": 0 },
      })
      fetchData()
    } catch (error: any) {
      console.error("Error creating prize pool:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to create prize pool.",
        variant: "destructive",
      })
    } finally {
      setFormLoading(false)
    }
  }

  const handleAssignWinning = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormLoading(true)
    try {
      const selectedPool = prizePools.find((p) => p.slot_id === newWinningData.slot_id)
      if (!selectedPool || !selectedPool.breakdown) {
        toast({
          title: "Error",
          description: "No prize pool found for this slot or breakdown is missing.",
          variant: "destructive",
        })
        return
      }

      const amountKey =
        `${newWinningData.position}st` ||
        `${newWinningData.position}nd` ||
        `${newWinningData.position}rd` ||
        `${newWinningData.position}th`
      const amount = (selectedPool.breakdown as any)[amountKey]

      if (amount === undefined) {
        toast({
          title: "Error",
          description: `Amount for ${newWinningData.position} place not defined in prize pool breakdown.`,
          variant: "destructive",
        })
        return
      }

      const { error } = await supabase.from("winnings").insert({
        slot_id: newWinningData.slot_id,
        team_id: newWinningData.team_id,
        position: newWinningData.position,
        amount_won: amount,
      })
      if (error) throw error
      toast({ title: "Success", description: "Winning assigned successfully." })
      setNewWinningData({ slot_id: slots[0]?.id || "", team_id: teams[0]?.id || "", position: 1, amount_won: 0 })
      fetchData()
    } catch (error: any) {
      console.error("Error assigning winning:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to assign winning.",
        variant: "destructive",
      })
    } finally {
      setFormLoading(false)
    }
  }

  const handleDeletePrizePool = async (id: string) => {
    if (!confirm("Are you sure you want to delete this prize pool? This will also delete associated winnings.")) {
      return
    }
    setFormLoading(true)
    try {
      const { error } = await supabase.from("prize_pools").delete().eq("id", id)
      if (error) throw error
      toast({ title: "Success", description: "Prize pool deleted successfully." })
      fetchData()
    } catch (error: any) {
      console.error("Error deleting prize pool:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to delete prize pool.",
        variant: "destructive",
      })
    } finally {
      setFormLoading(false)
    }
  }

  const handleDeleteWinning = async (id: string) => {
    if (!confirm("Are you sure you want to delete this winning entry?")) {
      return
    }
    setFormLoading(true)
    try {
      const { error } = await supabase.from("winnings").delete().eq("id", id)
      if (error) throw error
      toast({ title: "Success", description: "Winning entry deleted successfully." })
      fetchData()
    } catch (error: any) {
      console.error("Error deleting winning:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to delete winning.",
        variant: "destructive",
      })
    } finally {
      setFormLoading(false)
    }
  }

  const canManage = profile?.role && ["admin", "manager", "coach"].includes(profile.role.toLowerCase())

  if (loading) {
    return <div>Loading prize pool data...</div>
  }

  return (
    <div className="space-y-6">
      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle>Create Prize Pool</CardTitle>
            <CardDescription>Define prize amounts for a specific slot.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreatePrizePool} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="slotIdPool">Slot</Label>
                <Select
                  value={newPrizePoolData.slot_id}
                  onValueChange={(value) => setNewPrizePoolData({ ...newPrizePoolData, slot_id: value })}
                  required
                >
                  <SelectTrigger id="slotIdPool">
                    <SelectValue placeholder="Select Slot" />
                  </SelectTrigger>
                  <SelectContent>
                    {slots.map((slot) => (
                      <SelectItem key={slot.id} value={slot.id}>
                        {slot.team?.name} - {slot.organizer} ({new Date(slot.date).toLocaleDateString()})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="totalAmount">Total Pool (₹)</Label>
                <Input
                  id="totalAmount"
                  type="number"
                  value={newPrizePoolData.total_amount}
                  onChange={(e) =>
                    setNewPrizePoolData({ ...newPrizePoolData, total_amount: Number.parseInt(e.target.value) })
                  }
                  required
                />
              </div>
              <div className="col-span-2 grid gap-4 md:grid-cols-4">
                {[1, 2, 3, 4].map((pos) => (
                  <div className="space-y-2" key={pos}>
                    <Label htmlFor={`pos${pos}`}>
                      {pos}
                      {pos === 1 && "st"}
                      {pos === 2 && "nd"}
                      {pos === 3 && "rd"}
                      {pos === 4 && "th"} Place (₹)
                    </Label>
                    <Input
                      id={`pos${pos}`}
                      type="number"
                      value={
                        (newPrizePoolData.breakdown as any)[`${pos}st` || `${pos}nd` || `${pos}rd` || `${pos}th`] || 0
                      }
                      onChange={(e) =>
                        setNewPrizePoolData((prev) => ({
                          ...prev,
                          breakdown: {
                            ...prev.breakdown,
                            [`${pos}st` || `${pos}nd` || `${pos}rd` || `${pos}th`]: Number.parseInt(e.target.value),
                          },
                        }))
                      }
                    />
                  </div>
                ))}
              </div>
              <div className="col-span-2">
                <Button type="submit" disabled={formLoading}>
                  {formLoading ? "Creating..." : "Create Prize Pool"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Prize Pools Overview</CardTitle>
          <CardDescription>All created prize pools.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Slot</TableHead>
                <TableHead>Total Pool (₹)</TableHead>
                <TableHead>1st</TableHead>
                <TableHead>2nd</TableHead>
                <TableHead>3rd</TableHead>
                <TableHead>4th</TableHead>
                {canManage && <TableHead>Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {prizePools.map((pool) => (
                <TableRow key={pool.id}>
                  <TableCell className="font-medium">
                    {pool.slot?.organizer} ({new Date(pool.slot?.date || "").toLocaleDateString()})
                  </TableCell>
                  <TableCell>₹{pool.total_amount}</TableCell>
                  <TableCell>₹{(pool.breakdown as any)?.["1st"] || 0}</TableCell>
                  <TableCell>₹{(pool.breakdown as any)?.["2nd"] || 0}</TableCell>
                  <TableCell>₹{(pool.breakdown as any)?.["3rd"] || 0}</TableCell>
                  <TableCell>₹{(pool.breakdown as any)?.["4th"] || 0}</TableCell>
                  {canManage && (
                    <TableCell>
                      <Button size="sm" variant="destructive" onClick={() => handleDeletePrizePool(pool.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {prizePools.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">No prize pools created yet.</div>
          )}
        </CardContent>
      </Card>

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle>Assign Winning</CardTitle>
            <CardDescription>Assign a team to a specific placement in a booked slot.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAssignWinning} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="slotIdWinning">Slot</Label>
                <Select
                  value={newWinningData.slot_id}
                  onValueChange={(value) => setNewWinningData({ ...newWinningData, slot_id: value })}
                  required
                >
                  <SelectTrigger id="slotIdWinning">
                    <SelectValue placeholder="Select Slot" />
                  </SelectTrigger>
                  <SelectContent>
                    {slots.map((slot) => (
                      <SelectItem key={slot.id} value={slot.id}>
                        {slot.team?.name} - {slot.organizer} ({new Date(slot.date).toLocaleDateString()})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="winningTeam">Team</Label>
                <Select
                  value={newWinningData.team_id}
                  onValueChange={(value) => setNewWinningData({ ...newWinningData, team_id: value })}
                  required
                >
                  <SelectTrigger id="winningTeam">
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
              </div>
              <div className="space-y-2">
                <Label htmlFor="position">Placement</Label>
                <Select
                  value={String(newWinningData.position)}
                  onValueChange={(value) => setNewWinningData({ ...newWinningData, position: Number.parseInt(value) })}
                  required
                >
                  <SelectTrigger id="position">
                    <SelectValue placeholder="Select Position" />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4].map((pos) => (
                      <SelectItem key={pos} value={String(pos)}>
                        {pos}
                        {pos === 1 && "st"}
                        {pos === 2 && "nd"}
                        {pos === 3 && "rd"}
                        {pos === 4 && "th"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Button type="submit" disabled={formLoading}>
                  {formLoading ? "Assigning..." : "Assign Winning"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Assigned Winnings</CardTitle>
          <CardDescription>Records of teams winning prize money from slots.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Slot</TableHead>
                <TableHead>Winning Team</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Amount Won (₹)</TableHead>
                <TableHead>Date</TableHead>
                {canManage && <TableHead>Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {winnings.map((winning) => (
                <TableRow key={winning.id}>
                  <TableCell className="font-medium">
                    {winning.slot?.organizer} ({new Date(winning.slot?.date || "").toLocaleDateString()})
                  </TableCell>
                  <TableCell>{winning.team?.name || "N/A"}</TableCell>
                  <TableCell>
                    {winning.position}
                    {winning.position === 1 && "st"}
                    {winning.position === 2 && "nd"}
                    {winning.position === 3 && "rd"}
                    {winning.position === 4 && "th"}
                  </TableCell>
                  <TableCell>₹{winning.amount_won}</TableCell>
                  <TableCell>{new Date(winning.created_at).toLocaleDateString()}</TableCell>
                  {canManage && (
                    <TableCell>
                      <Button size="sm" variant="destructive" onClick={() => handleDeleteWinning(winning.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {winnings.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">No winnings assigned yet.</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
