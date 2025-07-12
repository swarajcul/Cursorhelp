"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function TeamManagementHomePage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to the default submodule: Teams
    router.replace("/dashboard/team-management/teams")
  }, [router])

  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary"></div>
    </div>
  )
}
