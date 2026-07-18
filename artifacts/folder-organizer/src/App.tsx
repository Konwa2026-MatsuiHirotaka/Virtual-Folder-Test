import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter } from 'wouter';

import { ProjectsList } from './pages/projects/List';
import { ProjectWorkspace } from './pages/projects/Workspace';
import { ProjectPlans } from './pages/projects/Plans';
import { ProjectAudit } from './pages/projects/Audit';

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={ProjectsList} />
      <Route path="/projects/:id" component={ProjectWorkspace} />
      <Route path="/projects/:id/plans" component={ProjectPlans} />
      <Route path="/projects/:id/audit" component={ProjectAudit} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
