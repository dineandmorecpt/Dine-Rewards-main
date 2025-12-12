import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import AdminDashboard from "@/pages/admin-dashboard";
import AdminVouchers from "@/pages/admin-vouchers";
import AdminReconciliation from "@/pages/admin-reconciliation";
import DinerDashboard from "@/pages/diner-dashboard";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/admin/dashboard" component={AdminDashboard} />
      <Route path="/admin/vouchers" component={AdminVouchers} />
      <Route path="/admin/reconciliation" component={AdminReconciliation} />
      
      {/* Diner Routes */}
      <Route path="/diner/dashboard" component={DinerDashboard} />
      <Route path="/diner/history" component={DinerDashboard} />
      <Route path="/diner/profile" component={DinerDashboard} />

      {/* Placeholder routes for navigation items to avoid 404s during demo */}
      <Route path="/admin/diners" component={AdminDashboard} />
      <Route path="/admin/menu" component={AdminDashboard} />
      <Route path="/admin/settings" component={AdminDashboard} />
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
