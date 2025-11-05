import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, XCircle, Clock, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface SyncStatusData {
  lastSync: string | null;
  isHealthy: boolean;
  activeBlocks: number;
}

export function SyncStatus() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<SyncStatusData>({
    queryKey: ["/api/sync/status"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();

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
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm">Last sync: {lastSync}</p>
            {data?.activeBlocks !== undefined && (
              <p className="text-sm">Active blocks: {data.activeBlocks}</p>
            )}
          </div>
          <div>
            <Button size="sm" variant="outline" onClick={async () => {
              if (isSyncing) return;
              setIsSyncing(true);
              try {
                const resp = await fetch('/api/sync/full', { method: 'POST' });
                if (!resp.ok) throw new Error(await resp.text());
                toast({ title: 'Full sync started', description: 'A full sync has been triggered' });
                // Refresh status
                queryClient.invalidateQueries({ queryKey: ["/api/sync/status"] });
              } catch (e) {
                toast({ title: 'Full sync failed', description: String(e) });
              } finally {
                setIsSyncing(false);
              }
            }} disabled={isSyncing}>
              <RefreshCw className="h-3 w-3" />
              <span className="text-xs">{isSyncing ? 'Syncing…' : 'Full sync'}</span>
            </Button>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
