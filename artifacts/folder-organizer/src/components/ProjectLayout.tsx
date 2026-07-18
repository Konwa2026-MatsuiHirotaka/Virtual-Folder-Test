import React, { ReactNode } from 'react';
import { Link, useRoute, useLocation } from 'wouter';
import { useGetProjectSummary, getGetProjectSummaryQueryKey } from '@workspace/api-client-react';
import { 
  FolderTree, 
  GitBranch, 
  History, 
  ChevronLeft,
  LayoutDashboard,
  Box,
  FileIcon,
  FolderIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

interface ProjectLayoutProps {
  projectId: number;
  children: ReactNode;
}

export function ProjectLayout({ projectId, children }: ProjectLayoutProps) {
  const [location] = useLocation();
  const { data: summary, isLoading } = useGetProjectSummary(projectId, {
    query: {
      enabled: !!projectId,
      queryKey: getGetProjectSummaryQueryKey(projectId)
    }
  });

  const navItems = [
    { href: `/projects/${projectId}`, icon: FolderTree, label: 'Workspace', exact: true },
    { href: `/projects/${projectId}/plans`, icon: GitBranch, label: 'Move Plans', badge: summary?.pendingPlansCount },
    { href: `/projects/${projectId}/audit`, icon: History, label: 'Audit Log' },
  ];

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-sidebar flex flex-col flex-shrink-0">
        <div className="h-14 flex items-center px-4 border-b border-border">
          <Link href="/" className="flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back to Projects
          </Link>
        </div>

        <div className="p-4 border-b border-border">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : (
            <>
              <h2 className="font-semibold text-lg truncate" title={`Project ${projectId}`}>
                Project {projectId}
              </h2>
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1" title="Files">
                  <FileIcon className="w-3 h-3" />
                  {summary?.fileCount || 0}
                </div>
                <div className="flex items-center gap-1" title="Folders">
                  <FolderIcon className="w-3 h-3" />
                  {summary?.folderCount || 0}
                </div>
                <div className="flex items-center gap-1" title="Max Depth">
                  <Box className="w-3 h-3" />
                  D:{summary?.maxDepth || 0}
                </div>
              </div>
            </>
          )}
        </div>

        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = item.exact ? location === item.href : location.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors",
                  isActive 
                    ? "bg-primary/10 text-primary font-medium" 
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <div className="flex items-center gap-3">
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <Badge variant="secondary" className="px-1.5 min-w-[20px] h-5 flex items-center justify-center text-[10px]">
                    {item.badge}
                  </Badge>
                )}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-background">
        {children}
      </main>
    </div>
  );
}
