import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { type ClassGroup, type AuthentikUser, LESSON_BLOCKS, DAYS_OF_WEEK } from "@shared/schema";
import { Plus, FolderKanban, Users, Trash2, Edit, Calendar, X, RemoveFormatting } from "lucide-react";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

interface ClassGroupWithMembers extends ClassGroup {
  memberCount: number;
  members: Array<{ authentikUserId: string }>;
}

export default function Groups() {
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [manageMembersDialogOpen, setManageMembersDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<ClassGroupWithMembers | null>(null);
  const [selectedDay, setSelectedDay] = useState<number>(0);
  const [selectedBlock, setSelectedBlock] = useState<number>(0);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDescription, setNewGroupDescription] = useState("");
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);

  const { data: groups, isLoading: groupsLoading } = useQuery<ClassGroupWithMembers[]>({
    queryKey: ["/api/groups"],
  });

  const { data: students } = useQuery<AuthentikUser[]>({
    queryKey: ["/api/students"],
  });

  // Keep the selectedGroup in sync with the latest groups data so dialogs reflect
  // changes immediately (for example when members are removed by mutation).
  useEffect(() => {
    if (!selectedGroup || !groups) return;
    const updated = groups.find((g) => g.id === selectedGroup.id) as ClassGroupWithMembers | undefined;
    if (updated) setSelectedGroup(updated);
  }, [groups, selectedGroup?.id]);

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      await apiRequest("POST", "/api/groups", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      toast({
        title: "Class group created",
        description: "The class group has been created successfully.",
      });
      setCreateDialogOpen(false);
      setNewGroupName("");
      setNewGroupDescription("");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create class group. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/groups/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/schedule"] });
      toast({
        title: "Class group deleted",
        description: "The class group and its assignments have been removed.",
      });
      setDeleteDialogOpen(false);
      setGroupToDelete(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete class group. Please try again.",
        variant: "destructive",
      });
    },
  });

  const assignMutation = useMutation({
    mutationFn: async (data: { dayOfWeek: number; blockNumber: number; classGroupId: string }) => {
      await apiRequest("POST", "/api/schedule", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedule"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({
        title: "Group assigned",
        description: "The class group has been assigned to the lesson block successfully.",
      });
      setAssignDialogOpen(false);
      setSelectedGroup(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to assign group. Please try again.",
        variant: "destructive",
      });
    },
  });

  const addMembersMutation = useMutation({
    mutationFn: async ({ groupId, studentIds }: { groupId: string; studentIds: string[] }) => {
      await apiRequest("POST", `/api/groups/${groupId}/members`, { studentIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      toast({
        title: "Members added",
        description: "Students have been added to the class group.",
      });
      setManageMembersDialogOpen(false);
      setSelectedStudents([]);
      setSelectedGroup(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add members. Please try again.",
        variant: "destructive",
      });
    },
  });

  const removeMembersMutation = useMutation({
    mutationFn: async ({ groupId, studentIds }: { groupId: string; studentIds: string[] }) => {
      for (const id of studentIds) {
        console.log(`Removing user ${id} from group ${groupId}`);
        await apiRequest("DELETE", `/api/groups/${groupId}/members/${id}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      toast({
        title: "Members removed",
        description: "Students have been removed from the class group.",
      });
      // Keep the dialog open; selectedGroup will be updated from the refreshed query
      setSelectedStudents([]);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove members. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleCreateSubmit = () => {
    if (newGroupName.trim()) {
      createMutation.mutate({
        name: newGroupName.trim(),
        description: newGroupDescription.trim() || undefined,
      });
    }
  };

  const handleAssignClick = (group: ClassGroupWithMembers) => {
    setSelectedGroup(group);
    setAssignDialogOpen(true);
  };

  const handleAssignSubmit = () => {
    if (selectedGroup) {
      assignMutation.mutate({
        dayOfWeek: selectedDay,
        blockNumber: selectedBlock,
        classGroupId: selectedGroup.id,
      });
    }
  };

  const handleManageMembersClick = (group: ClassGroupWithMembers) => {
    setSelectedGroup(group);
    setManageMembersDialogOpen(true);
  };

  const handleAddMembers = () => {
    if (selectedGroup && selectedStudents.length > 0) {
      addMembersMutation.mutate({
        groupId: selectedGroup.id,
        studentIds: selectedStudents,
      });
    }
  };

  const handleDeleteClick = (id: string) => {
    setGroupToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (groupToDelete) {
      deleteMutation.mutate(groupToDelete);
    }
  };

  const getStudentName = (userId: string) => {
    const student = students?.find(s => String(s.pk) === userId);
    return student?.name || student?.username || userId;
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const availableStudents = students?.filter(s => 
    !selectedGroup?.members.some(m => m.authentikUserId === String(s.pk))
  ) || [];

  return (
    <div className="space-y-6" data-testid="page-groups">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Class Groups</h1>
          <p className="text-muted-foreground mt-1">
            Create and manage reusable student groups
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-create-group">
          <Plus className="h-4 w-4 mr-2" />
          Create Group
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {groupsLoading ? (
          [...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-48" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))
        ) : groups && groups.length > 0 ? (
          groups.map((group) => (
            <Card key={group.id} className="hover-elevate" data-testid={`card-group-${group.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0">
                      <FolderKanban className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg truncate">{group.name}</CardTitle>
                      <CardDescription className="text-sm truncate">
                        {group.description || "No description"}
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {group.memberCount} {group.memberCount === 1 ? 'student' : 'students'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleManageMembersClick(group)}
                      data-testid={`button-manage-members-${group.id}`}
                    >
                      <Users className="h-3 w-3 mr-1.5" />
                      Manage Members
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAssignClick(group)}
                      data-testid={`button-assign-group-${group.id}`}
                    >
                      <Calendar className="h-3 w-3 mr-1.5" />
                      Assign
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteClick(group.id)}
                      className="text-destructive hover:text-destructive"
                      data-testid={`button-delete-group-${group.id}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <FolderKanban className="h-12 w-12 text-muted-foreground opacity-50 mb-4" />
              <p className="font-medium text-foreground mb-1">No class groups yet</p>
              <p className="text-sm text-muted-foreground mb-4">
                Create a class group to organize students for easy scheduling
              </p>
              <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-create-first-group">
                <Plus className="h-4 w-4 mr-2" />
                Create First Group
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Class Group</DialogTitle>
            <DialogDescription>
              Create a reusable group of students for easy schedule assignment
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Group Name</label>
              <Input
                placeholder="e.g., Math Class A"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                data-testid="input-group-name"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description (Optional)</label>
              <Textarea
                placeholder="Brief description of this group..."
                value={newGroupDescription}
                onChange={(e) => setNewGroupDescription(e.target.value)}
                data-testid="input-group-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)} data-testid="button-cancel-create">
              Cancel
            </Button>
            <Button
              onClick={handleCreateSubmit}
              disabled={createMutation.isPending || !newGroupName.trim()}
              data-testid="button-confirm-create"
            >
              {createMutation.isPending ? "Creating..." : "Create Group"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Group to Lesson Block</DialogTitle>
            <DialogDescription>
              Select a day and lesson block for {selectedGroup?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Day of Week</label>
              <Select value={String(selectedDay)} onValueChange={(v) => setSelectedDay(Number(v))}>
                <SelectTrigger data-testid="select-group-day">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS_OF_WEEK.map((day) => (
                    <SelectItem key={day.number} value={String(day.number)}>
                      {day.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Lesson Block</label>
              <Select value={String(selectedBlock)} onValueChange={(v) => setSelectedBlock(Number(v))}>
                <SelectTrigger data-testid="select-group-block">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LESSON_BLOCKS.map((block) => (
                    <SelectItem key={block.number} value={String(block.number)}>
                      {block.label} ({block.start} - {block.end})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)} data-testid="button-cancel-assign-group">
              Cancel
            </Button>
            <Button
              onClick={handleAssignSubmit}
              disabled={assignMutation.isPending}
              data-testid="button-confirm-assign-group"
            >
              {assignMutation.isPending ? "Assigning..." : "Assign Group"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={manageMembersDialogOpen} onOpenChange={setManageMembersDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manage Group Members</DialogTitle>
            <DialogDescription>
              Add or remove students from {selectedGroup?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedGroup && selectedGroup.members.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Current Members ({selectedGroup.memberCount})</label>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {selectedGroup.members.map((member) => (
                    <div 
                      className="group flex items-center justify-between gap-2 p-2 border bg-muted rounded-md"
                    >
                      <div key={member.authentikUserId} className="flex items-center gap-2 text-sm p-2 rounded-md">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>{getStudentName(member.authentikUserId)}</span>
                      </div>
                      <Button 
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => { removeMembersMutation.mutate({
                          groupId: selectedGroup.id,
                          studentIds: [member.authentikUserId],
                        }); }}
                        data-testid={`button-remove-member-${member.authentikUserId}`}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">Add Students</label>
              <div className="space-y-2 max-h-64 overflow-y-auto border rounded-md p-2">
                {availableStudents.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    All students are already in this group
                  </p>
                ) : (
                  availableStudents.map((student) => (
                    <label
                      key={student.pk}
                      className="flex items-center gap-3 p-2 rounded-md hover-elevate cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedStudents.includes(String(student.pk))}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedStudents([...selectedStudents, String(student.pk)]);
                          } else {
                            setSelectedStudents(selectedStudents.filter(id => id !== String(student.pk)));
                          }
                        }}
                        className="h-4 w-4"
                      />
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={student.avatar} alt={student.name} />
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                          {getInitials(student.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{student.name}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setManageMembersDialogOpen(false);
                setSelectedStudents([]);
                setSelectedGroup(null);
              }}
              data-testid="button-cancel-members"
            >
              Close
            </Button>
            <Button
              onClick={handleAddMembers}
              disabled={addMembersMutation.isPending || selectedStudents.length === 0}
              data-testid="button-add-members"
            >
              {addMembersMutation.isPending ? "Adding..." : `Add ${selectedStudents.length} Students`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Class Group</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this class group? This will also remove all schedule assignments for this group. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-group">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-group"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
