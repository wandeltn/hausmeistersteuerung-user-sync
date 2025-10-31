import { useQuery } from "@tanstack/react-query";
import { CheckCircle, XCircle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface SyncStatusData {
  lastSync: string | null;
  isHealthy: boolean;
  activeBlocks: number;
}

export function SyncStatus() {
  const { data, isLoading } = useQuery<SyncStatusData>({
    queryKey: ["/api/sync/status"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <Badge variant="secondary" className="gap-1.5" data-testid="badge-sync-status">
        <Clock className="h-3 w-3" />
        <span className="text-xs">Checking...</span>
      </Badge>
    );
  }

  const isHealthy = data?.isHealthy ?? false;
  const lastSync = data?.lastSync 
    ? new Date(data.lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'Never';

  return (
    <Tooltip>
      <TooltipTrigger>
        <Badge 
          variant={isHealthy ? "default" : "destructive"} 
          className="gap-1.5 cursor-help"
          data-testid="badge-sync-status"
        >
          {isHealthy ? (
            <CheckCircle className="h-3 w-3" />
          ) : (
            <XCircle className="h-3 w-3" />
          )}
          <span className="text-xs">
            {isHealthy ? "Synced" : "Error"}
          </span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-sm">Last sync: {lastSync}</p>
        {data?.activeBlocks !== undefined && (
          <p className="text-sm">Active blocks: {data.activeBlocks}</p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
