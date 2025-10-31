import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { type AuthentikUser, LESSON_BLOCKS, DAYS_OF_WEEK } from "@shared/schema";
import { Search, MoreVertical, UserX, Calendar } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function Students() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [dayFilter, setDayFilter] = useState<string>("all");
  const [blockFilter, setBlockFilter] = useState<string>("all");
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<AuthentikUser | null>(null);
  const [selectedDay, setSelectedDay] = useState<number>(0);
  const [selectedBlock, setSelectedBlock] = useState<number>(0);

  const { data: students, isLoading } = useQuery<AuthentikUser[]>({
    queryKey: ["/api/students"],
  });

  const assignMutation = useMutation({
    mutationFn: async (data: { dayOfWeek: number; blockNumber: number; authentikUserId: string }) => {
      await apiRequest("POST", "/api/schedule", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedule"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({
        title: "Student assigned",
        description: "The student has been assigned to the lesson block successfully.",
      });
      setAssignDialogOpen(false);
      setSelectedStudent(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to assign student. Please try again.",
        variant: "destructive",
      });
    },
  });

  const excludeMutation = useMutation({
    mutationFn: async (userId: string) => {
      await apiRequest("POST", "/api/exclusions", { authentikUserId: userId, reason: "Manual exclusion" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/students"] });
      toast({
        title: "Student excluded",
        description: "The student has been excluded from the interface.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to exclude student. Please try again.",
        variant: "destructive",
      });
    },
  });

  const filteredStudents = students?.filter((student) => {
    const matchesSearch = 
      student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.email.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesSearch;
  }) || [];

  const handleAssignClick = (student: AuthentikUser) => {
    setSelectedStudent(student);
    setAssignDialogOpen(true);
  };

  const handleAssignSubmit = () => {
    if (selectedStudent) {
      assignMutation.mutate({
        dayOfWeek: selectedDay,
        blockNumber: selectedBlock,
        authentikUserId: String(selectedStudent.pk),
      });
    }
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
    <div className="space-y-6" data-testid="page-students">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Students</h1>
        <p className="text-muted-foreground mt-1">
          Manage students from your Authentik user store
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Student Directory</CardTitle>
          <CardDescription>
            Search and filter students for schedule assignment
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, username, or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-students"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground" data-testid="text-no-students">
              <UserX className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No students found</p>
              <p className="text-sm mt-1">
                {searchQuery ? "Try adjusting your search criteria" : "No students available in Authentik"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredStudents.map((student) => (
                <div
                  key={student.pk}
                  className="flex items-center justify-between gap-4 p-4 rounded-lg border bg-card hover-elevate"
                  data-testid={`card-student-${student.pk}`}
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={student.avatar} alt={student.name} />
                      <AvatarFallback className="bg-primary/10 text-primary font-medium">
                        {getInitials(student.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{student.name}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        @{student.username} • {student.email}
                      </p>
                    </div>
                    {student.is_active ? (
                      <Badge variant="default" className="shrink-0">Active</Badge>
                    ) : (
                      <Badge variant="secondary" className="shrink-0">Inactive</Badge>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" data-testid={`button-menu-${student.pk}`}>
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => handleAssignClick(student)}
                        data-testid={`button-assign-${student.pk}`}
                      >
                        <Calendar className="h-4 w-4 mr-2" />
                        Assign to Schedule
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => excludeMutation.mutate(String(student.pk))}
                        className="text-destructive"
                        data-testid={`button-exclude-${student.pk}`}
                      >
                        <UserX className="h-4 w-4 mr-2" />
                        Exclude from Interface
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign to Lesson Block</DialogTitle>
            <DialogDescription>
              Select a day and lesson block for {selectedStudent?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Day of Week</label>
              <Select value={String(selectedDay)} onValueChange={(v) => setSelectedDay(Number(v))}>
                <SelectTrigger data-testid="select-day">
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
                <SelectTrigger data-testid="select-block">
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
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)} data-testid="button-cancel-assign">
              Cancel
            </Button>
            <Button
              onClick={handleAssignSubmit}
              disabled={assignMutation.isPending}
              data-testid="button-confirm-assign"
            >
              {assignMutation.isPending ? "Assigning..." : "Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
