"use client"

import * as React from "react"
import {
  LayoutDashboard,
  PlusSquare,
  Github,
  Terminal,
  ChevronRight,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { UserButton, useUser } from "@clerk/nextjs"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "~/components/ui/sidebar"
import { ModeToggle } from "~/components/mode-toggle"

const navItems = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Import repo",
    href: "/projects/new",
    icon: PlusSquare,
  },
  {
    title: "GitHub status",
    href: "/onboarding/github",
    icon: Github,
  },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const { user } = useUser()
  const displayName =
    user?.fullName?.trim() ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
    user?.primaryEmailAddress?.emailAddress ||
    "Profile"

  return (
    <Sidebar className="border-r border-border" {...props}>
      <SidebarHeader className="border-b border-border px-4 py-2.5">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="flex h-8 w-8 items-center justify-center bg-primary text-primary-foreground">
            <Terminal className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold tracking-tighter uppercase">
              Devin
            </span>
            <span className="text-[10px] text-muted-foreground uppercase leading-none">
              v0.1.0-alpha
            </span>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent className="p-2">
        <SidebarMenu>
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  className="text-sm group"
                >
                  <Link href={item.href}>
                    <item.icon className="mr-2 h-4 w-4" />
                    <span>{item.title}</span>
                    {isActive && (
                      <ChevronRight className="ml-auto h-3 w-3 text-primary animate-pulse" />
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="border-t border-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <UserButton
              appearance={{
                elements: {
                  userButtonAvatarBox: "h-8 w-8 rounded-none border border-border",
                },
              }}
            />
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground uppercase">
                Account
              </span>
              <span className="text-xs font-bold uppercase truncate max-w-[100px]">
                {displayName}
              </span>
            </div>
          </div>
          <ModeToggle />
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
