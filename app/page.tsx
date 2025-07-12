"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"

export default function HomePage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user) {
      router.push("/dashboard")
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-6xl font-bold text-white mb-4">Raptor Esports CRM</h1>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto">
            Professional esports team management system for performance tracking, user management, and team analytics.
          </p>
        </div>

        <div className="max-w-md mx-auto">
          <Card className="backdrop-blur-sm bg-white/10 border-white/20">
            <CardHeader className="text-center">
              <CardTitle className="text-white">Get Started</CardTitle>
              <CardDescription className="text-slate-300">Sign in to access your dashboard</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Link href="/auth/login" className="w-full">
                <Button className="w-full" size="lg">
                  Login
                </Button>
              </Link>
              <Link href="/auth/signup" className="w-full">
                <Button variant="outline" className="w-full bg-transparent" size="lg">
                  Sign Up
                </Button>
              </Link>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-white/20" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-slate-900 px-2 text-slate-400">Coming Soon</span>
                </div>
              </div>

              <Button variant="outline" className="w-full bg-transparent" size="lg" disabled>
                Login with Google
              </Button>
              <Button variant="outline" className="w-full bg-transparent" size="lg" disabled>
                Login with Discord
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
