import { Switch, Route, Redirect, Router } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DinerGuard } from "@/components/auth-guard";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import DinerDashboard from "@/pages/diner-dashboard";
import DinerHistory from "@/pages/diner-history";
import DinerProfile from "@/pages/diner-profile";
import DinerFaq from "@/pages/diner-faq";
import Register from "@/pages/register";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import ConfirmAccountDeletion from "@/pages/confirm-account-deletion";

const basePath = import.meta.env.VITE_DINER_BASE_PATH ?? "/diner";

function DinerRouter() {
  return (
    <Router base={basePath}>
      <Switch>
        <Route path="/">
          <Redirect to="/dashboard" />
        </Route>
        <Route path="/dashboard">
          <DinerGuard><DinerDashboard /></DinerGuard>
        </Route>
        <Route path="/history">
          <DinerGuard><DinerHistory /></DinerGuard>
        </Route>
        <Route path="/profile">
          <DinerGuard><DinerProfile /></DinerGuard>
        </Route>
        <Route path="/faq">
          <DinerGuard><DinerFaq /></DinerGuard>
        </Route>

        <Route component={NotFound} />
      </Switch>
    </Router>
  );
}

function RootRouter() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/register" component={Register} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/confirm-account-deletion" component={ConfirmAccountDeletion} />
      <Route>
        <DinerRouter />
      </Route>
    </Switch>
  );
}

function DinerApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <RootRouter />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default DinerApp;
