import React, { useState } from 'react';
import { useListProjects, useCreateProject, getListProjectsQueryKey } from '@workspace/api-client-react';
import { Link, useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { 
  FolderTree, 
  Plus, 
  Box, 
  Calendar,
  FileIcon,
  FolderIcon,
  Server
} from 'lucide-react';
import { format } from 'date-fns';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

const createProjectSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().optional(),
  rootPath: z.string().min(1, "Root path is required"),
  template: z.enum(['empty', 'sample-web', 'sample-docs', 'sample-data']).optional()
});

export function ProjectsList() {
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: projects, isLoading } = useListProjects();
  
  const createProject = useCreateProject();

  const form = useForm<z.infer<typeof createProjectSchema>>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      name: '',
      description: '',
      rootPath: '/src',
      template: 'empty',
    }
  });

  const onSubmit = (values: z.infer<typeof createProjectSchema>) => {
    createProject.mutate({ data: values as any }, {
      onSuccess: (project) => {
        toast({
          title: "Project created",
          description: `Successfully created project ${project.name}`,
        });
        queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
        setIsDialogOpen(false);
        form.reset();
        setLocation(`/projects/${project.id}`);
      },
      onError: (error) => {
        toast({
          variant: "destructive",
          title: "Error creating project",
          description: (error as any).error || "An unknown error occurred",
        });
      }
    });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="h-16 border-b border-border bg-card px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 text-primary font-semibold">
          <Server className="w-5 h-5" />
          <span>FolderOrg Platform</span>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="w-4 h-4" />
              New Project
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Project</DialogTitle>
              <DialogDescription>
                Define a new workspace to manage a virtual folder tree.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Frontend Monorepo" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="rootPath"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Root Path</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. /var/workspace/app" className="font-mono text-sm" {...field} />
                      </FormControl>
                      <FormDescription>The logical root of this project.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="What is this workspace for?" className="resize-none" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="template"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Seed Template</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a template" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="empty">Empty Project</SelectItem>
                          <SelectItem value="sample-web">Web App Scaffold</SelectItem>
                          <SelectItem value="sample-docs">Documentation Site</SelectItem>
                          <SelectItem value="sample-data">Data Processing Pipeline</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createProject.isPending}>
                    {createProject.isPending ? "Creating..." : "Create Project"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </header>

      <main className="flex-1 p-6 lg:p-8 max-w-7xl mx-auto w-full">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Workspaces</h1>
          <p className="text-muted-foreground mt-2">Manage your structured file system projects.</p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-2/3" />
                  <Skeleton className="h-4 w-1/3" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-4/5" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : !projects || projects.length === 0 ? (
          <div className="text-center py-20 border border-dashed rounded-lg bg-card/50">
            <FolderTree className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium">No projects found</h3>
            <p className="text-muted-foreground max-w-sm mx-auto mt-2 mb-6">
              Get started by creating a new workspace to organize your virtual folder tree.
            </p>
            <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Create Project
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <Link key={project.id} href={`/projects/${project.id}`}>
                <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full flex flex-col group relative overflow-hidden">
                  <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <CardHeader className="pb-4">
                    <CardTitle className="text-xl flex items-start justify-between">
                      <span className="truncate pr-2">{project.name}</span>
                    </CardTitle>
                    <CardDescription className="font-mono text-xs truncate" title={project.rootPath}>
                      {project.rootPath}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {project.description || "No description provided."}
                    </p>
                  </CardContent>
                  <CardFooter className="pt-4 border-t border-border/50 text-xs text-muted-foreground flex justify-between bg-muted/20">
                    <div className="flex gap-4">
                      <span className="flex items-center gap-1.5" title="Nodes">
                        <Box className="w-3.5 h-3.5" />
                        {project.nodeCount}
                      </span>
                      <span className="flex items-center gap-1.5" title="Files">
                        <FileIcon className="w-3.5 h-3.5" />
                        {project.fileCount}
                      </span>
                      <span className="flex items-center gap-1.5" title="Folders">
                        <FolderIcon className="w-3.5 h-3.5" />
                        {project.folderCount}
                      </span>
                    </div>
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      {format(new Date(project.createdAt), 'MMM d, yyyy')}
                    </span>
                  </CardFooter>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
