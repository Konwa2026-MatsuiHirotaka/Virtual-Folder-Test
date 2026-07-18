import React, { useState } from 'react';
import { useParams } from 'wouter';
import { useListAuditEntries, getListAuditEntriesQueryKey, useRestoreChange, getGetProjectSummaryQueryKey, getGetProjectQueryKey, getListPlansQueryKey, AuditEntry, Node } from '@workspace/api-client-react';
import { ProjectLayout } from '@/components/ProjectLayout';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow, format } from 'date-fns';
import { History, RotateCcw, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, FileCode2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export function ProjectAudit() {
  const params = useParams();
  const projectId = Number(params.id);
  const { data: entries, isLoading } = useListAuditEntries(projectId, {
    query: { enabled: !!projectId, queryKey: getListAuditEntriesQueryKey(projectId) }
  });

  return (
    <ProjectLayout projectId={projectId}>
      <header className="h-14 border-b border-border bg-card px-6 flex items-center shrink-0">
        <h1 className="font-semibold text-lg flex items-center gap-2">
          <History className="w-5 h-5 text-primary" />
          Audit Log
        </h1>
      </header>

      <main className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-5xl mx-auto">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 bg-muted/30 rounded-md animate-pulse border border-border" />
              ))}
            </div>
          ) : !entries || entries.length === 0 ? (
            <div className="text-center py-20 border border-dashed rounded-lg bg-card/50">
              <History className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="text-lg font-medium">No history yet</h3>
              <p className="text-muted-foreground mt-1 max-w-sm mx-auto">
                Changes applied to the workspace will appear here as a reversible timeline.
              </p>
            </div>
          ) : (
            <div className="relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
              {entries.map((entry, index) => (
                <AuditTimelineEntry key={entry.id} entry={entry} projectId={projectId} isLatest={index === 0} />
              ))}
            </div>
          )}
        </div>
      </main>
    </ProjectLayout>
  );
}

function AuditTimelineEntry({ entry, projectId, isLatest }: { entry: AuditEntry, projectId: number, isLatest: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const restoreChange = useRestoreChange();
  const [isRestoreOpen, setIsRestoreOpen] = useState(false);

  const statusColors = {
    success: "bg-emerald-500 text-white",
    failed: "bg-destructive text-white",
    rolled_back: "bg-amber-500 text-white"
  };

  const opColors = {
    move: "text-blue-600 bg-blue-500/10 border-blue-500/20",
    restore: "text-amber-600 bg-amber-500/10 border-amber-500/20",
    create: "text-emerald-600 bg-emerald-500/10 border-emerald-500/20",
    delete: "text-destructive bg-destructive/10 border-destructive/20"
  };

  const handleRestore = () => {
    restoreChange.mutate({ projectId, changeId: entry.changeId }, {
      onSuccess: (res) => {
        toast({ title: "Restored", description: res.message });
        queryClient.invalidateQueries({ queryKey: getListAuditEntriesQueryKey(projectId) });
        queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
        queryClient.invalidateQueries({ queryKey: getGetProjectSummaryQueryKey(projectId) });
        queryClient.invalidateQueries({ queryKey: getListPlansQueryKey(projectId) });
        setIsRestoreOpen(false);
      },
      onError: (err) => {
        toast({ variant: "destructive", title: "Restore Failed", description: (err as any).error || "An unknown error occurred" });
      }
    });
  };

  return (
    <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active py-4">
      {/* Timeline Marker */}
      <div className={cn(
        "flex items-center justify-center w-10 h-10 rounded-full border-4 border-background shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10",
        statusColors[entry.status]
      )}>
        {entry.status === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
      </div>
      
      {/* Content Card */}
      <Card className={cn(
        "w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] transition-shadow hover:shadow-md",
        isLatest && "border-primary/30"
      )}>
        <div className="p-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
          <div className="flex justify-between items-start mb-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={cn("uppercase text-[10px] px-1.5 py-0", opColors[entry.operation])}>
                {entry.operation}
              </Badge>
              <span className="text-xs text-muted-foreground font-mono" title={entry.changeId}>
                {entry.changeId.substring(0, 8)}...
              </span>
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
            </span>
          </div>
          
          <h4 className="text-sm font-medium mb-1 leading-tight">{entry.summary}</h4>
          
          <div className="flex justify-between items-end mt-3">
            <div className="text-[11px] text-muted-foreground">
              {format(new Date(entry.createdAt), 'MMM d, yyyy • h:mm a')}
            </div>
            
            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
              {entry.canRestore && entry.status === 'success' && (
                <Dialog open={isRestoreOpen} onOpenChange={setIsRestoreOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" className="h-7 text-xs px-2 gap-1 bg-background hover:bg-amber-500/10 hover:text-amber-700 hover:border-amber-500/30 transition-colors">
                      <RotateCcw className="w-3 h-3" />
                      Restore
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Confirm Restore</DialogTitle>
                      <DialogDescription>
                        This will revert the changes made by operation <span className="font-mono text-xs">{entry.changeId}</span>.
                        A new audit entry will be created for the restore action.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="bg-muted p-3 rounded-md text-sm my-2">
                      {entry.summary}
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsRestoreOpen(false)}>Cancel</Button>
                      <Button variant="destructive" onClick={handleRestore} disabled={restoreChange.isPending}>
                        {restoreChange.isPending ? "Restoring..." : "Apply Restore"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
              <div className="text-muted-foreground hover:text-foreground p-1 rounded-sm transition-colors">
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </div>
          </div>
        </div>
        
        {expanded && (
          <div className="border-t border-border bg-muted/10 p-0 text-sm overflow-hidden rounded-b-lg">
            <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-border">
              <div className="flex-1 p-3">
                <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Before</div>
                <NodeSnapshotList nodes={entry.snapshotBefore} type="before" />
              </div>
              <div className="flex-1 p-3 bg-card">
                <div className="text-xs font-semibold text-emerald-600/80 mb-2 uppercase tracking-wider">After</div>
                <NodeSnapshotList nodes={entry.snapshotAfter} type="after" />
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function NodeSnapshotList({ nodes, type }: { nodes: Node[], type: 'before' | 'after' }) {
  if (!nodes || nodes.length === 0) {
    return <div className="text-xs text-muted-foreground italic py-2">Empty state</div>;
  }
  
  return (
    <ul className="space-y-2">
      {nodes.map(node => (
        <li key={node.id} className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5 font-medium text-[13px]">
            <FileCode2 className="w-3.5 h-3.5 text-muted-foreground" />
            {node.name}
          </div>
          <div className={cn(
            "font-mono text-[11px] break-all pl-5",
            type === 'before' ? "text-destructive/80 line-through decoration-destructive/30" : "text-emerald-600/90"
          )}>
            {node.physicalPath}
          </div>
        </li>
      ))}
    </ul>
  );
}
