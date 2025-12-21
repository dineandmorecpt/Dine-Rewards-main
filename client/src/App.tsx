import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AdminGuard, DinerGuard } from "@/components/auth-guard";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import AdminDashboard from "@/pages/admin-dashboard";
import AdminVouchers from "@/pages/admin-vouchers";
import AdminReconciliation from "@/pages/admin-reconciliation";
import AdminSettings from "@/pages/admin-settings";
import AdminActivityLogs from "@/pages/admin-activity-logs";
import AdminOnboarding from "@/pages/admin-onboarding";
import DinerDashboard from "@/pages/diner-dashboard";
import DinerHistory from "@/pages/diner-history";
import DinerProfile from "@/pages/diner-profile";
import Register from "@/pages/register";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import ConfirmAccountDeletion from "@/pages/confirm-account-deletion";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/register" component={Register} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/admin/reset-password" component={ResetPassword} />
      <Route path="/confirm-account-deletion" component={ConfirmAccountDeletion} />
      <Route path="/admin/confirm-account-deletion" component={ConfirmAccountDeletion} />
      
      <Route path="/admin">
        <Redirect to="/admin/dashboard" />
      </Route>
      <Route path="/admin/dashboard">
        <AdminGuard><AdminDashboard /></AdminGuard>
      </Route>
      <Route path="/admin/vouchers">
        <AdminGuard><AdminVouchers /></AdminGuard>
      </Route>
      <Route path="/admin/reconciliation">
        <AdminGuard><AdminReconciliation /></AdminGuard>
      </Route>
      <Route path="/admin/menu">
        <AdminGuard><AdminDashboard /></AdminGuard>
      </Route>
      <Route path="/admin/settings">
        <AdminGuard><AdminSettings /></AdminGuard>
      </Route>
      <Route path="/admin/activity-logs">
        <AdminGuard><AdminActivityLogs /></AdminGuard>
      </Route>
      <Route path="/admin/onboarding">
        <AdminGuard><AdminOnboarding /></AdminGuard>
      </Route>
      
      <Route path="/diner">
        <Redirect to="/diner/dashboard" />
      </Route>
      <Route path="/diner/dashboard">
        <DinerGuard><DinerDashboard /></DinerGuard>
      </Route>
      <Route path="/diner/history">
        <DinerGuard><DinerHistory /></DinerGuard>
      </Route>
      <Route path="/diner/profile">
        <DinerGuard><DinerProfile /></DinerGuard>
      </Route>

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
