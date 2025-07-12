"use client"

import type React from "react"

import { useState, useRef } from "react"
import { useAuth } from "@/hooks/use-auth"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useToast } from "@/hooks/use-toast"
import { Upload, User } from "lucide-react"

export default function ProfilePage() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [formData, setFormData] = useState({
    name: profile?.name || "",
    contact_number: profile?.contact_number || "",
    in_game_role: profile?.in_game_role || "",
    device_info: profile?.device_info || "",
  })

  const updateProfile = async () => {
    if (!profile) return

    setLoading(true)
    try {
      const { error } = await supabase.from("users").update(formData).eq("id", profile.id)

      if (error) throw error

      toast({
        title: "Success",
        description: "Profile updated successfully",
      })
    } catch (error) {
      console.error("Error updating profile:", error)
      toast({
        title: "Error",
        description: "Failed to update profile",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!profile || !event.target.files || event.target.files.length === 0) {
      return
    }

    const file = event.target.files[0]
    const fileExt = file.name.split(".").pop()
    const fileName = `${profile.id}.${fileExt}`
    const filePath = `${profile.id}/${fileName}`

    setUploading(true)
    try {
      // Upload file to storage
      const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, file, { upsert: true })

      if (uploadError) throw uploadError

      // Get public URL
      const { data } = supabase.storage.from("avatars").getPublicUrl(filePath)

      // Update user profile with avatar URL
      const { error: updateError } = await supabase
        .from("users")
        .update({ avatar_url: data.publicUrl })
        .eq("id", profile.id)

      if (updateError) throw updateError

      toast({
        title: "Success",
        description: "Avatar uploaded successfully",
      })
    } catch (error) {
      console.error("Error uploading avatar:", error)
      toast({
        title: "Error",
        description: "Failed to upload avatar",
        variant: "destructive",
      })
    } finally {
      setUploading(false)
    }
  }

  if (!profile) {
    return <div>Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
        <p className="text-muted-foreground">Manage your personal information and settings</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Avatar</CardTitle>
            <CardDescription>Upload your profile picture</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={profile.avatar_url || ""} />
                <AvatarFallback>
                  <User className="h-10 w-10" />
                </AvatarFallback>
              </Avatar>
              <div>
                <Button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="mb-2">
                  <Upload className="h-4 w-4 mr-2" />
                  {uploading ? "Uploading..." : "Upload Avatar"}
                </Button>
                <p className="text-sm text-muted-foreground">JPG, PNG up to 2MB</p>
              </div>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={uploadAvatar} className="hidden" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
            <CardDescription>Your account details and role</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={profile.email} disabled />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Input value={profile.role} disabled />
            </div>
            <div className="space-y-2">
              <Label>Team</Label>
              <Input value={profile.team_id || "No team assigned"} disabled />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
          <CardDescription>Update your personal details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter your full name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact">Contact Number</Label>
              <Input
                id="contact"
                value={formData.contact_number}
                onChange={(e) => setFormData({ ...formData, contact_number: e.target.value })}
                placeholder="Enter your contact number"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="in_game_role">In-Game Role</Label>
            <Input
              id="in_game_role"
              value={formData.in_game_role}
              onChange={(e) => setFormData({ ...formData, in_game_role: e.target.value })}
              placeholder="e.g., IGL, Support, Entry Fragger"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="device_info">Device Information</Label>
            <Textarea
              id="device_info"
              value={formData.device_info}
              onChange={(e) => setFormData({ ...formData, device_info: e.target.value })}
              placeholder="Enter your gaming setup details"
              rows={3}
            />
          </div>

          <Button onClick={updateProfile} disabled={loading}>
            {loading ? "Updating..." : "Update Profile"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
