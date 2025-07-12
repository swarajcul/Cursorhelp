"use client"

import type React from "react"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Shield } from "lucide-react"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, profile, loading, error, retryProfileCreation } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth/login")
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <p className="text-muted-foreground">Setting up your profile...</p>
          <p className="text-xs text-muted-foreground">Check console (F12) for details</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-muted-foreground">Redirecting to login...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full space-y-4">
          <Alert variant="destructive">
            <AlertDescription>
              <strong>Profile Creation Failed:</strong> {error}
            </AlertDescription>
          </Alert>

          <div className="text-center space-y-4">
            <div className="text-sm text-muted-foreground">
              <p>
                <strong>User ID:</strong> {user.id}
              </p>
              <p>
                <strong>Email:</strong> {user.email}
              </p>
            </div>

            <div className="flex gap-2 justify-center">
              <Button onClick={retryProfileCreation}>Try Again</Button>
              <Button variant="outline" onClick={() => router.push("/auth/login")}>
                Back to Login
              </Button>
            </div>

            <div className="text-xs text-muted-foreground bg-muted p-3 rounded">
              <p className="font-semibold mb-2">Manual Fix:</p>
              <code className="block text-left">
                {`INSERT INTO users (id, email, name, role) VALUES ('${user.id}', '${user.email}', 'Your Name', 'admin');`}
              </code>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold">Profile Not Found</h2>
          <p className="text-muted-foreground">Your profile should have been created automatically.</p>
          <Button onClick={retryProfileCreation}>Retry Profile Creation</Button>
        </div>
      </div>
    )
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <span className="font-semibold">Raptor CRM</span>
          </div>
          <div className="ml-auto flex items-center space-x-4">
            <span className="text-sm text-muted-foreground">Welcome, {profile.name || profile.email}</span>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="min-h-[100vh] flex-1 rounded-xl bg-muted/50 md:min-h-min p-4">{children}</div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
