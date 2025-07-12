"use client"
import { useState, useEffect } from "react"
import { useAuth } from "@/hooks/use-auth"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { CalendarIcon, Filter } from "lucide-react"
import { format } from "date-fns"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import type { Database } from "@/lib/supabase"

type Team = Database["public"]["Tables"]["teams"]["Row"]
type SlotExpense = Database["public"]["Tables"]["slot_expenses"]["Row"] & {
  team: Team | null
  slot: Database["public"]["Tables"]["slots"]["Row"] | null
}

export default function SlotExpensesPage() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const [expenses, setExpenses] = useState<SlotExpense[]>([])
  const [filteredExpenses, setFilteredExpenses] = useState<SlotExpense[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [organizers, setOrganizers] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  // Filter states
  const [filters, setFilters] = useState({
    team_id: "all",
    organizer: "all",
    date_from: null as Date | null,
    date_to: null as Date | null,
  })

  useEffect(() => {
    fetchExpenses()
    fetchTeams()
  }, [profile])

  useEffect(() => {
    applyFilters()
  }, [expenses, filters])

  const fetchExpenses = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from("slot_expenses")
        .select(`
          *, 
          team:team_id(name), 
          slot:slot_id(organizer, time_range, date, number_of_slots, slot_rate, notes)
        `)
        .order("created_at", { ascending: false })

      if (profile?.role === "coach" || profile?.role === "player") {
        query = query.eq("team_id", profile.team_id!)
      }

      const { data, error } = await query
      if (error) throw error

      setExpenses(data || [])

      // Extract unique organizers for filter
      const uniqueOrganizers = [...new Set(data?.map((e) => e.slot?.organizer).filter(Boolean) || [])]
      setOrganizers(uniqueOrganizers)
    } catch (error: any) {
      console.error("Error fetching slot expenses:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to fetch slot expenses.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchTeams = async () => {
    try {
      let query = supabase.from("teams").select("id, name").order("name")

      if (profile?.role === "coach" || profile?.role === "player") {
        query = query.eq("id", profile.team_id!)
      }

      const { data, error } = await query
      if (error) throw error
      setTeams(data || [])
    } catch (error) {
      console.error("Error fetching teams:", error)
    }
  }

  const applyFilters = () => {
    let filtered = [...expenses]

    // Filter by team
    if (filters.team_id !== "all") {
      filtered = filtered.filter((expense) => expense.team_id === filters.team_id)
    }

    // Filter by organizer
    if (filters.organizer !== "all") {
      filtered = filtered.filter((expense) => expense.slot?.organizer === filters.organizer)
    }

    // Filter by date range
    if (filters.date_from) {
      filtered = filtered.filter((expense) => expense.slot?.date && new Date(expense.slot.date) >= filters.date_from!)
    }

    if (filters.date_to) {
      filtered = filtered.filter((expense) => expense.slot?.date && new Date(expense.slot.date) <= filters.date_to!)
    }

    setFilteredExpenses(filtered)
  }

  const clearFilters = () => {
    setFilters({
      team_id: "all",
      organizer: "all",
      date_from: null,
      date_to: null,
    })
  }

  const getTotalExpense = () => {
    return filteredExpenses.reduce((sum, expense) => sum + (expense.total || 0), 0)
  }

  if (loading) {
    return <div>Loading slot expenses...</div>
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Expense Filters
          </CardTitle>
          <CardDescription>Filter expenses by team, organizer, and date range.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>Team</Label>
              <Select
                value={filters.team_id}
                onValueChange={(value) => setFilters((prev) => ({ ...prev, team_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Teams" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Teams</SelectItem>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Organizer</Label>
              <Select
                value={filters.organizer}
                onValueChange={(value) => setFilters((prev) => ({ ...prev, organizer: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Organizers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Organizers</SelectItem>
                  {organizers.map((organizer) => (
                    <SelectItem key={organizer} value={organizer}>
                      {organizer}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>From Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !filters.date_from && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.date_from ? format(filters.date_from, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={filters.date_from}
                    onSelect={(date) => setFilters((prev) => ({ ...prev, date_from: date }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>To Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !filters.date_to && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.date_to ? format(filters.date_to, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={filters.date_to}
                    onSelect={(date) => setFilters((prev) => ({ ...prev, date_to: date }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <Button variant="outline" onClick={clearFilters}>
              Clear Filters
            </Button>
            <div className="ml-auto text-sm text-muted-foreground flex items-center">
              Showing {filteredExpenses.length} of {expenses.length} expenses
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Slot Expenses Tracker</CardTitle>
          <CardDescription>
            Automatically tracked expenses based on slot-count billing (₹{getTotalExpense()} total).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Team</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Organizer</TableHead>
                <TableHead>Time Range</TableHead>
                <TableHead>Number of Slots</TableHead>
                <TableHead>Rate per Slot (₹)</TableHead>
                <TableHead>Total Expense (₹)</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredExpenses.map((expense) => (
                <TableRow key={expense.id}>
                  <TableCell className="font-medium">{expense.team?.name || "N/A"}</TableCell>
                  <TableCell>{expense.slot?.date ? format(new Date(expense.slot.date), "PPP") : "N/A"}</TableCell>
                  <TableCell>{expense.slot?.organizer || "N/A"}</TableCell>
                  <TableCell>{expense.slot?.time_range || "N/A"}</TableCell>
                  <TableCell>{expense.number_of_slots || expense.slot?.number_of_slots || 1}</TableCell>
                  <TableCell>₹{expense.rate}</TableCell>
                  <TableCell className="font-bold">₹{expense.total}</TableCell>
                  <TableCell className="max-w-xs truncate" title={expense.slot?.notes || ""}>
                    {expense.slot?.notes || "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filteredExpenses.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              {expenses.length === 0 ? "No slot expenses recorded yet." : "No expenses match the current filters."}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
