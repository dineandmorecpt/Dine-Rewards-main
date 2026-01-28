import { Switch, Route, Redirect, Router } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AdminGuard } from "@/components/auth-guard";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import AdminDashboard from "@/pages/admin-dashboard";
import AdminVouchers from "@/pages/admin-vouchers";
import AdminReconciliation from "@/pages/admin-reconciliation";
import AdminSettings from "@/pages/admin-settings";
import AdminActivityLogs from "@/pages/admin-activity-logs";
import AdminOnboarding from "@/pages/admin-onboarding";
import AdminUsers from "@/pages/admin-users";
import AdminProfile from "@/pages/admin-profile";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import ConfirmAccountDeletion from "@/pages/confirm-account-deletion";

const basePath = import.meta.env.VITE_ADMIN_BASE_PATH ?? "/admin";

function AdminRouter() {
  return (
    <Router base={basePath}>
      <Switch>
        <Route path="/">
          <Redirect to="/dashboard" />
        </Route>
        <Route path="/dashboard">
          <AdminGuard><AdminDashboard /></AdminGuard>
        </Route>
        <Route path="/vouchers">
          <AdminGuard><AdminVouchers /></AdminGuard>
        </Route>
        <Route path="/reconciliation">
          <AdminGuard><AdminReconciliation /></AdminGuard>
        </Route>
        <Route path="/menu">
          <AdminGuard><AdminDashboard /></AdminGuard>
        </Route>
        <Route path="/settings">
          <AdminGuard><AdminSettings /></AdminGuard>
        </Route>
        <Route path="/activity-logs">
          <AdminGuard><AdminActivityLogs /></AdminGuard>
        </Route>
        <Route path="/onboarding">
          <AdminGuard><AdminOnboarding /></AdminGuard>
        </Route>
        <Route path="/users">
          <AdminGuard><AdminUsers /></AdminGuard>
        </Route>
        <Route path="/profile">
          <AdminGuard><AdminProfile /></AdminGuard>
        </Route>
        <Route path="/reset-password" component={ResetPassword} />
        <Route path="/confirm-account-deletion" component={ConfirmAccountDeletion} />

        <Route component={NotFound} />
      </Switch>
    </Router>
  );
}

function RootRouter() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/confirm-account-deletion" component={ConfirmAccountDeletion} />
      <Route>
        <AdminRouter />
      </Route>
    </Switch>
  );
}

function AdminApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <RootRouter />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default AdminApp;
