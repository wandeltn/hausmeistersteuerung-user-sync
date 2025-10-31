import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { LESSON_BLOCKS, DAYS_OF_WEEK, type ScheduleAssignment, type AuthentikUser, type ClassGroup } from "@shared/schema";
import { Trash2, Users as UsersIcon, FolderKanban, X } from "lucide-react";
import { useState } from "react";
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

interface ScheduleSlotData {
  assignments: Array<ScheduleAssignment & {
    studentName?: string;
    groupName?: string;
  }>;
}

export default function Schedule() {
  const { toast } = useToast();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [assignmentToDelete, setAssignmentToDelete] = useState<string | null>(null);

  const { data: scheduleData, isLoading: scheduleLoading } = useQuery<Record<string, ScheduleSlotData>>({
    queryKey: ["/api/schedule"],
  });

  const { data: students } = useQuery<AuthentikUser[]>({
    queryKey: ["/api/students"],
  });

  const { data: groups } = useQuery<ClassGroup[]>({
    queryKey: ["/api/groups"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/schedule/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedule"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({
        title: "Assignment removed",
        description: "The schedule assignment has been removed successfully.",
      });
      setDeleteDialogOpen(false);
      setAssignmentToDelete(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove assignment. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleDelete = (id: string) => {
    setAssignmentToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (assignmentToDelete) {
      deleteMutation.mutate(assignmentToDelete);
    }
  };

  const getSlotKey = (day: number, block: number) => `${day}-${block}`;

  const getAssignmentsForSlot = (day: number, block: number) => {
    const key = getSlotKey(day, block);
    return scheduleData?.[key]?.assignments || [];
  };

  const getStudentName = (userId: string) => {
    const student = students?.find(s => String(s.pk) === userId);
    return student?.name || student?.username || userId;
  };

  const getGroupName = (groupId: string) => {
    const group = groups?.find(g => g.id === groupId);
    return group?.name || groupId;
  };

  return (
    <div className="space-y-6" data-testid="page-schedule">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Weekly Schedule</h1>
        <p className="text-muted-foreground mt-1">
          Manage student assignments to lesson blocks
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Schedule Grid</CardTitle>
          <CardDescription>
            Monday through Friday, 4 lesson blocks per day (8:00 AM - 2:45 PM)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {scheduleLoading ? (
            <div className="space-y-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-max">
                <div className="grid grid-cols-6 gap-2 mb-2">
                  <div className="font-medium text-sm text-muted-foreground p-2">Time</div>
                  {DAYS_OF_WEEK.map((day) => (
                    <div key={day.number} className="font-medium text-sm text-center p-2">
                      {day.label}
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  {LESSON_BLOCKS.map((block) => (
                    <div key={block.number} className="grid grid-cols-6 gap-2">
                      <div className="flex flex-col justify-center p-3 bg-muted rounded-md">
                        <div className="text-sm font-medium text-foreground">{block.label}</div>
                        <div className="text-xs text-muted-foreground">
                          {block.start} - {block.end}
                        </div>
                      </div>

                      {DAYS_OF_WEEK.map((day) => {
                        const assignments = getAssignmentsForSlot(day.number, block.number);
                        
                        return (
                          <div
                            key={`${day.number}-${block.number}`}
                            className="min-h-24 p-3 bg-card border border-border rounded-md hover-elevate transition-colors"
                            data-testid={`slot-${day.number}-${block.number}`}
                          >
                            {assignments.length === 0 ? (
                              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                                Empty
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {assignments.map((assignment) => (
                                  <div
                                    key={assignment.id}
                                    className="group flex items-center justify-between gap-2 p-2 bg-primary/10 border border-primary/20 rounded-md"
                                    data-testid={`assignment-${assignment.id}`}
                                  >
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                      {assignment.classGroupId ? (
                                        <>
                                          <FolderKanban className="h-3 w-3 text-primary shrink-0" />
                                          <span className="text-xs font-medium text-foreground truncate">
                                            {getGroupName(assignment.classGroupId)}
                                          </span>
                                        </>
                                      ) : (
                                        <>
                                          <UsersIcon className="h-3 w-3 text-primary shrink-0" />
                                          <span className="text-xs font-medium text-foreground truncate">
                                            {assignment.authentikUserId ? getStudentName(assignment.authentikUserId) : 'Unknown'}
                                          </span>
                                        </>
                                      )}
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                      onClick={() => handleDelete(assignment.id)}
                                      data-testid={`button-delete-${assignment.id}`}
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Assignment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this assignment? The student or group will no longer have access during this time slot.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
