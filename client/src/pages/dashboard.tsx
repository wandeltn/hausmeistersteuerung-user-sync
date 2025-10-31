import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, FolderKanban, Calendar, Clock } from "lucide-react";
import { LESSON_BLOCKS, DAYS_OF_WEEK } from "@shared/schema";

interface DashboardStats {
  totalStudents: number;
  totalClassGroups: number;
  totalAssignments: number;
  activeBlocks: Array<{
    dayOfWeek: number;
    blockNumber: number;
    studentCount: number;
  }>;
}

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  const currentDay = new Date().getDay();
  const adjustedDay = currentDay === 0 ? -1 : currentDay === 6 ? -1 : currentDay - 1;
  
  const currentHour = new Date().getHours();
  const currentMinute = new Date().getMinutes();
  const currentTimeMinutes = currentHour * 60 + currentMinute;

  const getCurrentBlock = () => {
    for (const block of LESSON_BLOCKS) {
      const [startHour, startMin] = block.start.split(':').map(Number);
      const [endHour, endMin] = block.end.split(':').map(Number);
      const startMinutes = startHour * 60 + startMin - 15;
      const endMinutes = endHour * 60 + endMin + 15;
      
      if (currentTimeMinutes >= startMinutes && currentTimeMinutes <= endMinutes) {
        return block.number;
      }
    }
    return null;
  };

  const currentBlock = getCurrentBlock();
  const isSchoolDay = adjustedDay >= 0 && adjustedDay <= 4;

  return (
    <div className="space-y-6" data-testid="page-dashboard">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Overview of your student scheduling and access management
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold" data-testid="text-total-students">
                {stats?.totalStudents || 0}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              From Authentik user store
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Class Groups</CardTitle>
            <FolderKanban className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold" data-testid="text-total-groups">
                {stats?.totalClassGroups || 0}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Reusable student collections
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Schedule Assignments</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold" data-testid="text-total-assignments">
                {stats?.totalAssignments || 0}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Across all time slots
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Blocks</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold" data-testid="text-active-blocks">
                {stats?.activeBlocks.length || 0}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Currently in session
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Lesson Blocks</CardTitle>
          <CardDescription>
            Students currently have access to services (15 min before to 15 min after lesson)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : !isSchoolDay ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="text-no-active-blocks">
              <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No active blocks</p>
              <p className="text-sm mt-1">School operates Monday through Friday</p>
            </div>
          ) : currentBlock === null ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="text-no-active-blocks">
              <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No active blocks</p>
              <p className="text-sm mt-1">No lessons currently in session</p>
            </div>
          ) : stats?.activeBlocks && stats.activeBlocks.length > 0 ? (
            <div className="space-y-3">
              {stats.activeBlocks.map((block) => {
                const day = DAYS_OF_WEEK.find(d => d.number === block.dayOfWeek);
                const lessonBlock = LESSON_BLOCKS.find(b => b.number === block.blockNumber);
                
                return (
                  <div
                    key={`${block.dayOfWeek}-${block.blockNumber}`}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card hover-elevate"
                    data-testid={`card-active-block-${block.dayOfWeek}-${block.blockNumber}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <Calendar className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          {day?.label} - {lessonBlock?.label}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {lessonBlock?.start} - {lessonBlock?.end}
                        </p>
                      </div>
                    </div>
                    <Badge variant="default" className="gap-1.5">
                      <Users className="h-3 w-3" />
                      <span>{block.studentCount} students</span>
                    </Badge>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground" data-testid="text-no-active-blocks">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No students scheduled</p>
              <p className="text-sm mt-1">Assign students to lesson blocks to see them here</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
