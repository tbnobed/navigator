import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Router as WouterRouter } from 'wouter';

import Home from '@/pages/index';
import Destination from '@/pages/destination';
import Navigate from '@/pages/navigate';
import QRPosters from '@/pages/qr';
import AdminHome from '@/pages/admin/index';
import AdminEditor from '@/pages/admin/editor';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/destination" component={Destination} />
      <Route path="/navigate" component={Navigate} />
      <Route path="/qr" component={QRPosters} />
      <Route path="/admin" component={AdminHome} />
      <Route path="/admin/site/:id" component={AdminEditor} />
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
