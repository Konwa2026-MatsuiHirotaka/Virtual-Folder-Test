import React, { useState } from 'react';
import { useCreatePlan, getListPlansQueryKey, getGetProjectSummaryQueryKey, Node } from '@workspace/api-client-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { ArrowRight, AlertTriangle, CheckCircle2 } from 'lucide-react';

const planMoveSchema = z.object({
  targetPath: z.string().min(1, "Target path is required"),
  description: z.string().optional()
});

interface PlanMoveDialogProps {
  projectId: number;
  node: Node;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PlanMoveDialog({ projectId, node, open, onOpenChange }: PlanMoveDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const createPlan = useCreatePlan();
  
  const form = useForm<z.infer<typeof planMoveSchema>>({
    resolver: zodResolver(planMoveSchema),
    defaultValues: {
      targetPath: '',
      description: `Move ${node.name}`
    }
  });

  const onSubmit = (values: z.infer<typeof planMoveSchema>) => {
    createPlan.mutate({
      projectId,
      data: {
        nodeId: node.id,
        targetPath: values.targetPath,
        description: values.description
      }
    }, {
      onSuccess: (plan) => {
        toast({ title: "Move plan created (Dry Run)", description: "Review changes in the Plans tab." });
        queryClient.invalidateQueries({ queryKey: getListPlansQueryKey(projectId) });
        queryClient.invalidateQueries({ queryKey: getGetProjectSummaryQueryKey(projectId) });
        onOpenChange(false);
        // Navigate to the plans tab to review it
        setLocation(`/projects/${projectId}/plans`);
      },
      onError: (err) => {
        toast({ variant: "destructive", title: "Error creating plan", description: (err as any).error || "An unknown error occurred" });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Plan Move (Dry Run)</DialogTitle>
          <DialogDescription>
            Specify a new physical path. A plan will be generated and validated before any changes are applied.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-muted/30 p-3 rounded-md border border-border mb-2 text-sm flex flex-col gap-2">
          <div className="flex gap-2">
            <span className="text-muted-foreground w-12 shrink-0">From:</span>
            <span className="font-mono text-xs break-all text-foreground">{node.physicalPath}</span>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="targetPath"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Target Physical Path</FormLabel>
                  <FormControl>
                    <Input {...field} className="font-mono text-sm" placeholder="/new/path/to/file.ts" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason / Description</FormLabel>
                  <FormControl>
                    <Textarea {...field} className="resize-none" rows={2} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={createPlan.isPending || !node.movable}>
                {createPlan.isPending ? "Generating Plan..." : "Generate Plan"}
              </Button>
            </DialogFooter>
            {!node.movable && (
              <p className="text-xs text-destructive text-center mt-2 flex items-center justify-center">
                <AlertTriangle className="w-3 h-3 mr-1" /> This node is marked as not movable.
              </p>
            )}
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
