"use client"

import type React from "react"

import { useAuth } from "@/hooks/use-auth"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Home, Users, User, BarChart3, LogOut, Shield, CalendarCheck, DollarSign, Trophy } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

const menuItems = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: Home,
    roles: ["admin", "manager", "coach", "player", "analyst"],
  },
  {
    title: "User Management",
    url: "/dashboard/user-management",
    icon: Users,
    roles: ["admin"],
  },
  {
    title: "Team Management",
    url: "/dashboard/team-management/teams", // Base route for team management
    icon: Shield,
    roles: ["admin", "manager", "coach", "player"],
    subItems: [
      {
        title: "Teams",
        url: "/dashboard/team-management/teams",
        icon: Shield,
        roles: ["admin", "manager", "coach", "player"],
      },
      {
        title: "Roster",
        url: "/dashboard/team-management/roster",
        icon: Users,
        roles: ["admin", "manager", "coach", "player"],
      },
      {
        title: "Slot Booking",
        url: "/dashboard/team-management/slots",
        icon: CalendarCheck,
        roles: ["admin", "manager", "coach", "player"],
      },
      {
        title: "Slot Expenses",
        url: "/dashboard/team-management/expenses",
        icon: DollarSign,
        roles: ["admin", "manager", "coach", "player"],
      },
      {
        title: "Prize Pool",
        url: "/dashboard/team-management/prize-pool",
        icon: Trophy,
        roles: ["admin", "manager", "coach", "player"],
      },
    ],
  },
  {
    title: "Performance",
    url: "/dashboard/performance",
    icon: BarChart3,
    roles: ["admin", "manager", "coach", "player", "analyst"],
  },
  {
    title: "Profile",
    url: "/dashboard/profile",
    icon: User,
    roles: ["admin", "manager", "coach", "player", "analyst"],
  },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  // Add props to AppSidebar
  const { profile, signOut } = useAuth()
  const pathname = usePathname()

  const filteredMenuItems = menuItems.filter((item) => profile?.role && item.roles.includes(profile.role.toLowerCase()))

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={
                      pathname === item.url ||
                      (item.subItems &&
                        pathname.startsWith(
                          item.url.split("/")[0] + "/" + item.url.split("/")[1] + "/" + item.url.split("/")[2],
                        ))
                    }
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                  {item.subItems && (
                    <SidebarMenu>
                      {item.subItems
                        .filter((subItem) => profile?.role && subItem.roles.includes(profile.role.toLowerCase()))
                        .map((subItem) => (
                          <SidebarMenuItem key={subItem.title}>
                            <SidebarMenuButton asChild isActive={pathname === subItem.url}>
                              <Link href={subItem.url}>
                                <subItem.icon className="h-4 w-4" />
                                <span>{subItem.title}</span>
                              </Link>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        ))}
                    </SidebarMenu>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t">
        <div className="p-2">
          <div className="mb-2 text-xs text-muted-foreground">Role: {profile?.role}</div>
          <Button variant="outline" size="sm" className="w-full justify-start bg-transparent" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
