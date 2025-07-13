"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { SecureProfileCreation } from "@/lib/secure-profile-creation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2 } from "lucide-react"

export default function ConfirmPage() {
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const handleEmailConfirmation = async () => {
      try {
        // Get the current session after confirmation
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          console.error('Session error:', sessionError)
          setStatus('error')
          setMessage('Failed to verify email confirmation. Please try again.')
          return
        }

        if (!session) {
          setStatus('error')
          setMessage('No active session found. Please try signing in again.')
          return
        }

        console.log('✅ Email confirmed for user:', session.user.email)

        // Create profile for the confirmed user
        const profileResult = await SecureProfileCreation.createProfile(
          session.user.id,
          session.user.email!,
          session.user.user_metadata?.name || session.user.user_metadata?.full_name
        )

        if (!profileResult.success) {
          console.error('Profile creation failed:', profileResult.error)
          setStatus('error')
          setMessage(`Profile creation failed: ${profileResult.error}`)
          return
        }

        console.log('✅ Profile created successfully')
        setStatus('success')
        setMessage('Email confirmed successfully! Your profile has been created.')
        
        // Redirect to dashboard after a short delay
        setTimeout(() => {
          router.push('/dashboard')
        }, 2000)

      } catch (error: any) {
        console.error('Confirmation error:', error)
        setStatus('error')
        setMessage(error.message || 'An unexpected error occurred')
      }
    }

    handleEmailConfirmation()
  }, [router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md backdrop-blur-sm bg-white/10 border-white/20">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-white">
            {status === 'loading' && 'Confirming Email...'}
            {status === 'success' && 'Email Confirmed!'}
            {status === 'error' && 'Confirmation Failed'}
          </CardTitle>
          <CardDescription className="text-slate-300">
            {status === 'loading' && 'Please wait while we verify your email...'}
            {status === 'success' && 'Welcome to Raptor Esports!'}
            {status === 'error' && 'There was an issue with your confirmation.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === 'loading' && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-white" />
            </div>
          )}
          
          {status === 'success' && (
            <Alert className="bg-green-500/20 border-green-500/50">
              <AlertDescription className="text-green-100">
                {message}
              </AlertDescription>
            </Alert>
          )}
          
          {status === 'error' && (
            <Alert variant="destructive">
              <AlertDescription>
                {message}
              </AlertDescription>
            </Alert>
          )}
          
          <div className="flex gap-2">
            <Button 
              onClick={() => router.push('/dashboard')} 
              className="flex-1"
              disabled={status === 'loading'}
            >
              Go to Dashboard
            </Button>
            <Button 
              variant="outline" 
              onClick={() => router.push('/auth/login')}
              className="flex-1"
            >
              Go to Login
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}