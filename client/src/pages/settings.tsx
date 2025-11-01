import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { type UserExclusion, type AuthentikUser } from "@shared/schema";
import { UserX, UserPlus, Settings as SettingsIcon } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState } from "react";

interface ExclusionWithUser extends UserExclusion {
  userName?: string;
}

export default function Settings() {
  const { toast } = useToast();
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [exclusionToRemove, setExclusionToRemove] = useState<string | null>(null);

  const { data: exclusions, isLoading: exclusionsLoading } = useQuery<ExclusionWithUser[]>({
    queryKey: ["/api/exclusions"],
  });

  const { data: allUsers } = useQuery<AuthentikUser[]>({
    queryKey: ["/api/students/all"],
  });

  const removeExclusionMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/exclusions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exclusions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/students"] });
      toast({
        title: "Exclusion removed",
        description: "The user will now appear in the student interface.",
      });
      setRemoveDialogOpen(false);
      setExclusionToRemove(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove exclusion. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleRemoveClick = (id: string) => {
    setExclusionToRemove(id);
    setRemoveDialogOpen(true);
  };

  const confirmRemove = () => {
    if (exclusionToRemove) {
      removeExclusionMutation.mutate(exclusionToRemove);
    }
  };

  const getUserName = (userId: string) => {
    const user = allUsers?.find(u => String(u.pk) === userId);
    return user?.name || user?.username || userId;
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-6" data-testid="page-settings">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage system configuration and user exclusions
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Authentik Connection</CardTitle>
          <CardDescription>
            Integration status with your Authentik instance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10 text-primary">
              <SettingsIcon className="h-6 w-6" />
            </div>
            <div>
              <p className="font-medium text-foreground">Connected</p>
              <p className="text-sm text-muted-foreground">
                {"API URL configured"}
              </p>
            </div>
            <Badge variant="default" className="ml-auto">Active</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Excluded Users</CardTitle>
          <CardDescription>
            Users excluded from the student scheduling interface (e.g., staff accounts, external users)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {exclusionsLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
              ))}
            </div>
          ) : exclusions && exclusions.length > 0 ? (
            <div className="space-y-2">
              {exclusions.map((exclusion) => {
                const userName = getUserName(exclusion.authentikUserId);
                return (
                  <div
                    key={exclusion.id}
                    className="flex items-center justify-between gap-4 p-4 rounded-lg border bg-card hover-elevate"
                    data-testid={`card-exclusion-${exclusion.id}`}
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback className="bg-muted text-muted-foreground font-medium">
                          {getInitials(userName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{userName}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {exclusion.reason || "No reason provided"}
                        </p>
                      </div>
                      <Badge variant="secondary" className="shrink-0">Excluded</Badge>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemoveClick(exclusion.id)}
                      data-testid={`button-remove-exclusion-${exclusion.id}`}
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Include
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground" data-testid="text-no-exclusions">
              <UserX className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No excluded users</p>
              <p className="text-sm mt-1">
                All Authentik users are visible in the student interface
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sync Configuration</CardTitle>
          <CardDescription>
            Automatic synchronization settings for Authentik groups
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
              <div>
                <p className="font-medium text-foreground">Access Window</p>
                <p className="text-sm text-muted-foreground">
                  Students get access 15 minutes before and after lessons
                </p>
              </div>
              <Badge variant="outline">Configured</Badge>
            </div>
            <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
              <div>
                <p className="font-medium text-foreground">Sync Frequency</p>
                <p className="text-sm text-muted-foreground">
                  Continuous monitoring and real-time updates
                </p>
              </div>
              <Badge variant="outline">Active</Badge>
            </div>
            <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
              <div>
                <p className="font-medium text-foreground">Auto-Create Groups</p>
                <p className="text-sm text-muted-foreground">
                  Automatically create Authentik groups for lesson blocks
                </p>
              </div>
              <Badge variant="outline">Enabled</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Exclusion</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to include this user in the student interface? They will become visible for schedule assignment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-remove">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRemove}
              disabled={removeExclusionMutation.isPending}
              data-testid="button-confirm-remove"
            >
              {removeExclusionMutation.isPending ? "Removing..." : "Include User"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
