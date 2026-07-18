import React, { useState, useMemo } from 'react';
import { useParams } from 'wouter';
import { useGetProject, getGetProjectQueryKey, useValidateProject, getValidateProjectQueryKey, Node, NodeKind, useCreateNode, getGetProjectSummaryQueryKey, useDeleteNode, getListNodesQueryKey } from '@workspace/api-client-react';
import { ProjectLayout } from '@/components/ProjectLayout';
import { FolderTree as FolderTreeIcon, FileIcon, FolderIcon, AlertTriangle, AlertCircle, Plus, ChevronRight, ChevronDown, CheckCircle2, Trash2, ArrowRightLeft, Box } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { PlanMoveDialog } from './PlanMoveDialog';

export function ProjectWorkspace() {
  const params = useParams();
  const projectId = Number(params.id);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const { data: project, isLoading: isLoadingProject } = useGetProject(projectId, {
    query: { enabled: !!projectId, queryKey: getGetProjectQueryKey(projectId) }
  });

  const { data: validationResult, isLoading: isLoadingValidation } = useValidateProject(projectId, {
    query: { enabled: !!projectId, queryKey: getValidateProjectQueryKey(projectId) }
  });

  const selectedNode = useMemo(() => {
    if (!project?.nodes || !selectedNodeId) return null;
    return project.nodes.find(n => n.id === selectedNodeId) || null;
  }, [project?.nodes, selectedNodeId]);

  if (isLoadingProject) {
    return (
      <ProjectLayout projectId={projectId}>
        <div className="flex items-center justify-center h-full text-muted-foreground">
          Loading workspace...
        </div>
      </ProjectLayout>
    );
  }

  if (!project) {
    return (
      <ProjectLayout projectId={projectId}>
        <div className="flex items-center justify-center h-full text-destructive">
          Project not found.
        </div>
      </ProjectLayout>
    );
  }

  const nodes = project.nodes || [];

  return (
    <ProjectLayout projectId={projectId}>
      <header className="h-14 border-b border-border bg-card px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="font-semibold text-lg">{project.name}</h1>
          <Badge variant="outline" className="font-mono text-xs font-normal text-muted-foreground bg-muted/30">
            {project.rootPath}
          </Badge>
        </div>
        <div className="flex items-center gap-3">
          {!isLoadingValidation && validationResult && (
            <div className="flex items-center gap-2 text-sm">
              {validationResult.valid ? (
                <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-emerald-500/20">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> Valid Tree
                </Badge>
              ) : (
                <Badge variant="destructive" className="bg-destructive/10 text-destructive hover:bg-destructive/20 border-destructive/20">
                  <AlertTriangle className="w-3 h-3 mr-1" /> {validationResult.issues.length} Issues
                </Badge>
              )}
            </div>
          )}
          <CreateNodeDialog projectId={projectId} parentId={selectedNode?.kind === 'folder' ? selectedNode.id : undefined} />
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Tree Panel */}
        <div className="w-1/2 md:w-2/5 border-r border-border bg-card/30 flex flex-col">
          <div className="p-3 border-b border-border bg-muted/20 flex justify-between items-center text-sm font-medium text-muted-foreground shrink-0">
            <span>Folder Structure</span>
            <span>{nodes.length} nodes</span>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 pb-10">
              {nodes.length === 0 ? (
                <div className="text-center py-10 px-4">
                  <FolderTreeIcon className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Tree is empty.</p>
                </div>
              ) : (
                <FolderTree 
                  nodes={nodes} 
                  selectedNodeId={selectedNodeId} 
                  onSelect={setSelectedNodeId} 
                />
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Details Panel */}
        <div className="flex-1 bg-background flex flex-col min-w-0">
          {selectedNode ? (
            <NodeDetails 
              node={selectedNode} 
              projectId={projectId} 
              onClose={() => setSelectedNodeId(null)}
              validationIssues={validationResult?.issues?.filter(i => i.nodeId === selectedNode.id) || []}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-6 text-center">
              <Box className="w-12 h-12 mb-4 opacity-20" />
              <p className="text-lg font-medium text-foreground mb-1">No node selected</p>
              <p className="text-sm max-w-xs">Select a file or folder from the tree on the left to view its details and plan moves.</p>
            </div>
          )}
        </div>
      </div>
    </ProjectLayout>
  );
}

// --- Tree Components ---

interface FolderTreeProps {
  nodes: Node[];
  selectedNodeId: string | null;
  onSelect: (id: string) => void;
}

function FolderTree({ nodes, selectedNodeId, onSelect }: FolderTreeProps) {
  // Build tree structure
  const rootNodes = nodes.filter(n => !n.parentId);
  
  return (
    <div className="space-y-0.5">
      {rootNodes.map(node => (
        <TreeNode 
          key={node.id} 
          node={node} 
          allNodes={nodes} 
          selectedNodeId={selectedNodeId} 
          onSelect={onSelect} 
        />
      ))}
    </div>
  );
}

interface TreeNodeProps {
  node: Node;
  allNodes: Node[];
  selectedNodeId: string | null;
  onSelect: (id: string) => void;
}

function TreeNode({ node, allNodes, selectedNodeId, onSelect }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(true);
  const children = allNodes.filter(n => n.parentId === node.id);
  const isSelected = selectedNodeId === node.id;
  const isFolder = node.kind === 'folder';

  return (
    <div className="select-none">
      <div 
        className={cn(
          "flex items-center py-1.5 px-2 rounded-md cursor-pointer transition-colors text-sm group",
          isSelected ? "bg-primary text-primary-foreground" : "hover:bg-accent hover:text-accent-foreground text-foreground"
        )}
        style={{ paddingLeft: `${node.depth * 16 + 8}px` }}
        onClick={() => {
          onSelect(node.id);
          if (isFolder && selectedNodeId === node.id) {
            setExpanded(!expanded);
          }
        }}
      >
        <div className="w-4 h-4 mr-1.5 flex items-center justify-center shrink-0" onClick={(e) => {
          if (isFolder) {
            e.stopPropagation();
            setExpanded(!expanded);
          }
        }}>
          {isFolder ? (
            expanded ? <ChevronDown className="w-3.5 h-3.5 opacity-70" /> : <ChevronRight className="w-3.5 h-3.5 opacity-70" />
          ) : (
            <span className="w-3.5 h-3.5" /> // spacer
          )}
        </div>
        
        {isFolder ? (
          <FolderIcon className={cn("w-4 h-4 mr-2 shrink-0", isSelected ? "text-primary-foreground/80" : "text-blue-500/70")} />
        ) : (
          <FileIcon className={cn("w-4 h-4 mr-2 shrink-0", isSelected ? "text-primary-foreground/80" : "text-muted-foreground")} />
        )}
        
        <span className="truncate flex-1 font-mono text-[13px]">{node.name}</span>
        
        {node.movable && (
          <div className={cn(
            "w-1.5 h-1.5 rounded-full shrink-0 ml-2",
            isSelected ? "bg-primary-foreground/40" : "bg-emerald-500/50"
          )} title="Movable" />
        )}
      </div>
      
      {isFolder && expanded && children.length > 0 && (
        <div className="mt-0.5">
          {children.map(child => (
            <TreeNode 
              key={child.id} 
              node={child} 
              allNodes={allNodes} 
              selectedNodeId={selectedNodeId} 
              onSelect={onSelect} 
            />
          ))}
        </div>
      )}
    </div>
  );
}

// --- Node Details ---

interface NodeDetailsProps {
  node: Node;
  projectId: number;
  onClose: () => void;
  validationIssues: any[];
}

function NodeDetails({ node, projectId, onClose, validationIssues }: NodeDetailsProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const deleteNode = useDeleteNode();
  const [isPlanMoveOpen, setIsPlanMoveOpen] = useState(false);

  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete ${node.name}?`)) {
      deleteNode.mutate({ projectId, nodeId: node.id }, {
        onSuccess: () => {
          toast({ title: "Node deleted", description: `${node.name} has been removed.` });
          queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
          queryClient.invalidateQueries({ queryKey: getGetProjectSummaryQueryKey(projectId) });
          onClose();
        },
        onError: (err) => {
          toast({ variant: "destructive", title: "Error deleting node", description: (err as any).error || "An unknown error occurred" });
        }
      });
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="p-6 border-b border-border bg-card shrink-0 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {node.kind === 'folder' ? (
              <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">Folder</Badge>
            ) : (
              <Badge variant="outline" className="bg-slate-500/10 text-slate-600 border-slate-500/20">File</Badge>
            )}
            {node.movable && <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-emerald-500/20">Movable</Badge>}
          </div>
          <h2 className="text-2xl font-bold font-mono tracking-tight break-all">{node.name}</h2>
          <p className="text-muted-foreground text-sm mt-1">ID: <span className="font-mono text-xs">{node.id}</span></p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleDelete} className="text-destructive hover:bg-destructive/10 hover:text-destructive">
            <Trash2 className="w-4 h-4 mr-1.5" />
            Delete
          </Button>
          <Button size="sm" onClick={() => setIsPlanMoveOpen(true)} className="gap-1.5">
            <ArrowRightLeft className="w-4 h-4" />
            Plan Move
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 p-6">
        <div className="space-y-8 pb-10">
          
          {validationIssues.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Validation Issues</h3>
              {validationIssues.map((issue, idx) => (
                <Alert key={idx} variant={issue.severity === 'error' ? 'destructive' : 'default'} className={issue.severity === 'warning' ? 'border-yellow-500/50 text-yellow-600 bg-yellow-500/10' : ''}>
                  {issue.severity === 'error' ? <AlertCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                  <AlertTitle>{issue.kind}</AlertTitle>
                  <AlertDescription>{issue.message}</AlertDescription>
                </Alert>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 gap-6">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Logical Path</h3>
              <div className="p-3 bg-muted/30 border border-border rounded-md font-mono text-sm break-all">
                {node.logicalPath}
              </div>
            </div>

            <div className="space-y-1">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Physical Path</h3>
              <div className="p-3 bg-muted/30 border border-border rounded-md font-mono text-sm break-all">
                {node.physicalPath}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Depth</h3>
              <div className="text-2xl font-light">{node.depth}</div>
            </div>

            <div className="space-y-1">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Created At</h3>
              <div className="text-sm text-foreground/80 mt-1">
                {new Date(node.createdAt).toLocaleString()}
              </div>
            </div>
          </div>

          {node.exportNames && node.exportNames.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Exports</h3>
              <div className="flex flex-wrap gap-2">
                {node.exportNames.map(exp => (
                  <Badge key={exp} variant="secondary" className="font-mono">{exp}</Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {isPlanMoveOpen && (
        <PlanMoveDialog 
          projectId={projectId} 
          node={node} 
          open={isPlanMoveOpen} 
          onOpenChange={setIsPlanMoveOpen} 
        />
      )}
    </div>
  );
}

// --- Create Node Dialog ---

const createNodeSchema = z.object({
  kind: z.nativeEnum(NodeKind),
  name: z.string().min(1),
  logicalPath: z.string().min(1),
  physicalPath: z.string().min(1),
  movable: z.boolean().default(false),
  parentId: z.string().optional()
});

function CreateNodeDialog({ projectId, parentId }: { projectId: number, parentId?: string }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createNode = useCreateNode();

  const form = useForm<z.infer<typeof createNodeSchema>>({
    resolver: zodResolver(createNodeSchema),
    defaultValues: {
      kind: 'file',
      name: '',
      logicalPath: '',
      physicalPath: '',
      movable: true,
      parentId: parentId || ''
    }
  });

  const onSubmit = (values: z.infer<typeof createNodeSchema>) => {
    createNode.mutate({ projectId, data: values }, {
      onSuccess: () => {
        toast({ title: "Node created successfully" });
        queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
        queryClient.invalidateQueries({ queryKey: getGetProjectSummaryQueryKey(projectId) });
        setOpen(false);
        form.reset();
      },
      onError: (err) => {
        toast({ variant: "destructive", title: "Error", description: (err as any).error || "An unknown error occurred" });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5 h-8 px-3">
          <Plus className="w-3.5 h-3.5" />
          Add Node
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Node</DialogTitle>
          <DialogDescription>Create a new file or folder in this workspace.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="kind"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kind</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="file">File</SelectItem>
                        <SelectItem value="folder">Folder</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="logicalPath"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Logical Path</FormLabel>
                  <FormControl>
                    <Input {...field} className="font-mono" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="physicalPath"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Physical Path</FormLabel>
                  <FormControl>
                    <Input {...field} className="font-mono" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="parentId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Parent ID (Optional)</FormLabel>
                  <FormControl>
                    <Input {...field} className="font-mono text-sm" placeholder="Leave empty for root" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="movable"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel>Movable</FormLabel>
                    <FormDescription>Can this node be relocated by plans?</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createNode.isPending}>
                {createNode.isPending ? "Adding..." : "Add Node"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
