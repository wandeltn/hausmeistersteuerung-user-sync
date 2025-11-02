import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { SyncStatus } from "@/components/sync-status";
import Dashboard from "@/pages/dashboard";
import Schedule from "@/pages/schedule";
import Students from "@/pages/students";
import Groups from "@/pages/groups";
import Settings from "@/pages/settings";
import NotFound from "@/pages/not-found";
import Login from "./pages/login";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/schedule" component={Schedule} />
      <Route path="/students" component={Students} />
      <Route path="/groups" component={Groups} />
      <Route path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SidebarProvider style={style as React.CSSProperties}>
          <div className="flex h-screen w-full">
            <AppSidebar />
            <div className="flex flex-col flex-1">
              <header className="flex items-center justify-between gap-4 p-4 border-b bg-background">
                <SidebarTrigger data-testid="button-sidebar-toggle" />
                <div className="flex items-center gap-3">
                  <SyncStatus />
                  <ThemeToggle />
                </div>
              </header>
              <main className="flex-1 overflow-auto p-6 bg-background">
                <Router />
              </main>
            </div>
          </div>
        </SidebarProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
