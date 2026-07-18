import React, { useState } from 'react';
import { useParams } from 'wouter';
import { useListPlans, getListPlansQueryKey, useApplyPlan, getGetProjectSummaryQueryKey, getGetProjectQueryKey, MovePlan } from '@workspace/api-client-react';
import { ProjectLayout } from '@/components/ProjectLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ArrowRight, AlertTriangle, AlertCircle, CheckCircle2, XCircle, GitBranch, Terminal } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export function ProjectPlans() {
  const params = useParams();
  const projectId = Number(params.id);
  const { data: plans, isLoading } = useListPlans(projectId, {
    query: { enabled: !!projectId, queryKey: getListPlansQueryKey(projectId) }
  });

  return (
    <ProjectLayout projectId={projectId}>
      <header className="h-14 border-b border-border bg-card px-6 flex items-center shrink-0">
        <h1 className="font-semibold text-lg flex items-center gap-2">
          <GitBranch className="w-5 h-5 text-primary" />
          Move Plans
        </h1>
      </header>

      <main className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2].map(i => (
                <Card key={i} className="animate-pulse">
                  <CardHeader className="h-20 bg-muted/50" />
                  <CardContent className="h-32" />
                </Card>
              ))}
            </div>
          ) : !plans || plans.length === 0 ? (
            <div className="text-center py-20 border border-dashed rounded-lg bg-card/50">
              <Terminal className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="text-lg font-medium">No plans generated</h3>
              <p className="text-muted-foreground mt-1 max-w-sm mx-auto">
                Create a move plan from the Workspace to safely reorganize your folder structure.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {plans.map(plan => (
                <PlanCard key={plan.id} plan={plan} projectId={projectId} />
              ))}
            </div>
          )}
        </div>
      </main>
    </ProjectLayout>
  );
}

function PlanCard({ plan, projectId }: { plan: MovePlan, projectId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const applyPlan = useApplyPlan();
  const [isExpanded, setIsExpanded] = useState(plan.status === 'pending');

  const statusColors = {
    pending: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    applied: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    failed: "bg-destructive/10 text-destructive border-destructive/20",
    rolled_back: "bg-amber-500/10 text-amber-600 border-amber-500/20"
  };

  const StatusIcon = {
    pending: Terminal,
    applied: CheckCircle2,
    failed: XCircle,
    rolled_back: AlertTriangle
  }[plan.status];

  const handleApply = () => {
    applyPlan.mutate({ projectId, planId: plan.id }, {
      onSuccess: (result) => {
        toast({ title: "Plan Applied", description: `Updated ${result.nodesUpdated} nodes.` });
        queryClient.invalidateQueries({ queryKey: getListPlansQueryKey(projectId) });
        queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
        queryClient.invalidateQueries({ queryKey: getGetProjectSummaryQueryKey(projectId) });
      },
      onError: (err) => {
        toast({ variant: "destructive", title: "Apply Failed", description: (err as any).error || "An unknown error occurred" });
        queryClient.invalidateQueries({ queryKey: getListPlansQueryKey(projectId) });
      }
    });
  };

  return (
    <Card className={cn(
      "overflow-hidden transition-all",
      plan.status === 'pending' ? "border-primary/30 shadow-sm" : "opacity-80"
    )}>
      <CardHeader className="bg-muted/20 border-b border-border pb-4 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className={cn("capitalize gap-1", statusColors[plan.status])}>
                <StatusIcon className="w-3.5 h-3.5" />
                {plan.status.replace('_', ' ')}
              </Badge>
              <span className="text-xs text-muted-foreground font-mono">ID: {plan.id}</span>
              <span className="text-xs text-muted-foreground">• {format(new Date(plan.createdAt), 'PP p')}</span>
            </div>
            <CardTitle className="text-base">{plan.description || `Move ${plan.changes[0]?.nodeName || 'Node'}`}</CardTitle>
          </div>
          {plan.status === 'pending' && (
            <div onClick={e => e.stopPropagation()}>
              <Button 
                onClick={handleApply} 
                disabled={!plan.canApply || applyPlan.isPending}
                size="sm"
                className="gap-2"
              >
                {applyPlan.isPending ? "Applying..." : "Apply Plan"}
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="pt-6 space-y-6">
          {plan.validationIssues.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                Validation Issues
                {!plan.canApply && <Badge variant="destructive" className="text-[10px] h-4">Blocks Apply</Badge>}
              </h4>
              <div className="grid gap-2">
                {plan.validationIssues.map((issue, idx) => (
                  <Alert key={idx} variant={issue.severity === 'error' ? 'destructive' : 'default'} className={cn("py-2 px-3", issue.severity === 'warning' && "border-yellow-500/30 text-yellow-700 bg-yellow-500/5")}>
                    <div className="flex gap-2 items-start">
                      {issue.severity === 'error' ? <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /> : <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />}
                      <div>
                        <AlertTitle className="text-sm mb-0">{issue.kind}</AlertTitle>
                        <AlertDescription className="text-xs opacity-90">{issue.message}</AlertDescription>
                      </div>
                    </div>
                  </Alert>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Changes ({plan.changes.length})</h4>
            <div className="rounded-md border border-border overflow-hidden bg-card">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 border-b border-border text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">Node</th>
                    <th className="px-4 py-2 font-medium">Movement</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-mono text-[13px]">
                  {plan.changes.map((change, idx) => (
                    <tr key={idx} className="hover:bg-muted/20">
                      <td className="px-4 py-3 align-top whitespace-nowrap">
                        <span className="font-sans text-sm font-medium block mb-1">{change.nodeName}</span>
                        <span className="text-xs text-muted-foreground capitalize px-1.5 py-0.5 bg-muted rounded-sm inline-block">{change.kind}</span>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="text-destructive/80 line-through break-all">{change.fromPath}</div>
                        <div className="text-emerald-600/90 break-all mt-1 flex items-start gap-1">
                          <ArrowRight className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                          {change.toPath}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      )}
      {plan.appliedAt && (
        <CardFooter className="bg-muted/10 border-t border-border py-3 text-xs text-muted-foreground flex justify-between">
          <span>Applied at {format(new Date(plan.appliedAt), 'PP p')}</span>
        </CardFooter>
      )}
    </Card>
  );
}
