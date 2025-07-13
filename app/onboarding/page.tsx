"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import { Loader2, CheckCircle, User, Mail, GamepadIcon } from "lucide-react"

interface OnboardingForm {
  fullName: string
  displayName: string
  contactNumber: string
  experience: string
  preferredRole: string
  favoriteGames: string
  bio: string
}

export default function OnboardingPage() {
  const { profile, loading: authLoading } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState<OnboardingForm>({
    fullName: "",
    displayName: "",
    contactNumber: "",
    experience: "",
    preferredRole: "",
    favoriteGames: "",
    bio: ""
  })

  useEffect(() => {
    // Redirect if user is already onboarded or not authenticated
    if (!authLoading && profile) {
      if (profile.role !== "pending_player") {
        router.push("/dashboard")
      }
    } else if (!authLoading && !profile) {
      router.push("/auth/login")
    }
  }, [profile, authLoading, router])

  const handleInputChange = (field: keyof OnboardingForm, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleNextStep = () => {
    if (step < 3) {
      setStep(step + 1)
    }
  }

  const handlePrevStep = () => {
    if (step > 1) {
      setStep(step - 1)
    }
  }

  const handleSubmit = async () => {
    if (!profile) return

    setLoading(true)
    try {
      // Update user profile with onboarding data
      const { error } = await supabase
        .from("users")
        .update({
          name: formData.fullName,
          // Note: Additional fields like bio, experience, etc. would need to be added to the users table
          // For now, we'll just update the name and keep pending_player role
        })
        .eq("id", profile.id)

      if (error) throw error

      // Create or update additional profile data in a separate table if needed
      // This would require creating an additional "user_profiles" table

      toast({
        title: "Onboarding Complete!",
        description: "Your profile has been submitted for review. You'll be notified once approved.",
      })

      // Redirect to dashboard (they'll see a pending approval message)
      router.push("/dashboard")

    } catch (error: any) {
      console.error("Onboarding error:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to complete onboarding",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            <GamepadIcon className="h-6 w-6" />
            Welcome to Raptor Esports!
          </CardTitle>
          <CardDescription>
            Complete your profile to join our community. Step {step} of 3
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all duration-300" 
              style={{ width: `${(step / 3) * 100}%` }}
            />
          </div>

          {/* Step 1: Basic Information */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <User className="h-5 w-5" />
                <h3 className="text-lg font-semibold">Basic Information</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name *</Label>
                  <Input
                    id="fullName"
                    placeholder="Enter your full name"
                    value={formData.fullName}
                    onChange={(e) => handleInputChange("fullName", e.target.value)}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="displayName">Display Name *</Label>
                  <Input
                    id="displayName"
                    placeholder="Gaming username/nickname"
                    value={formData.displayName}
                    onChange={(e) => handleInputChange("displayName", e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contactNumber">Contact Number</Label>
                <Input
                  id="contactNumber"
                  placeholder="+91 XXXXX XXXXX"
                  value={formData.contactNumber}
                  onChange={(e) => handleInputChange("contactNumber", e.target.value)}
                />
              </div>

              <div className="flex justify-end">
                <Button 
                  onClick={handleNextStep}
                  disabled={!formData.fullName || !formData.displayName}
                >
                  Next Step
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Gaming Information */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <GamepadIcon className="h-5 w-5" />
                <h3 className="text-lg font-semibold">Gaming Profile</h3>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="experience">Gaming Experience *</Label>
                  <Input
                    id="experience"
                    placeholder="e.g., 3 years competitive gaming"
                    value={formData.experience}
                    onChange={(e) => handleInputChange("experience", e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="preferredRole">Preferred Role *</Label>
                  <Input
                    id="preferredRole"
                    placeholder="e.g., Duelist, IGL, Support"
                    value={formData.preferredRole}
                    onChange={(e) => handleInputChange("preferredRole", e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="favoriteGames">Favorite Games *</Label>
                  <Input
                    id="favoriteGames"
                    placeholder="e.g., Valorant, CS2, Apex Legends"
                    value={formData.favoriteGames}
                    onChange={(e) => handleInputChange("favoriteGames", e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={handlePrevStep}>
                  Previous
                </Button>
                <Button 
                  onClick={handleNextStep}
                  disabled={!formData.experience || !formData.preferredRole || !formData.favoriteGames}
                >
                  Next Step
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Additional Information & Review */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle className="h-5 w-5" />
                <h3 className="text-lg font-semibold">Final Details</h3>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="bio">Bio / Introduction</Label>
                  <Textarea
                    id="bio"
                    placeholder="Tell us about yourself, your achievements, and what you're looking for..."
                    value={formData.bio}
                    onChange={(e) => handleInputChange("bio", e.target.value)}
                    rows={4}
                  />
                </div>

                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Review Status:</strong> Your profile will be reviewed by our team. 
                    You'll receive an email notification once approved. This usually takes 24-48 hours.
                  </AlertDescription>
                </Alert>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={handlePrevStep}>
                  Previous
                </Button>
                <Button 
                  onClick={handleSubmit}
                  disabled={loading}
                  className="min-w-[120px]"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Complete Onboarding"
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}