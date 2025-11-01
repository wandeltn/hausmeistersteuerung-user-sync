import {
  Calendar,
  LayoutDashboard,
  Users,
  Settings,
  FolderKanban,
} from "lucide-react";
import { Link, useLocation } from "wouter";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from "@/components/ui/sidebar";
import LoginButton from './login-button';

const menuItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Schedule",
    url: "/schedule",
    icon: Calendar,
  },
  {
    title: "Students",
    url: "/students",
    icon: Users,
  },
  {
    title: "Class Groups",
    url: "/groups",
    icon: FolderKanban,
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
  },
];

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-sidebar-foreground">SchoolSync</h2>
            <p className="text-xs text-muted-foreground">Access Management</p>
          </div>
          <div className="ml-auto">
            <LoginButton />
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location === item.url}>
                    <Link href={item.url} data-testid={`link-${item.title.toLowerCase().replace(' ', '-')}`}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
