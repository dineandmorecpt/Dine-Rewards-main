import { Switch, Route, Redirect } from "wouter";
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

function DinerRouter() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/register" component={Register} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/confirm-account-deletion" component={ConfirmAccountDeletion} />
      
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
      <Route path="/diner/faq">
        <DinerGuard><DinerFaq /></DinerGuard>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function DinerApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <DinerRouter />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default DinerApp;
