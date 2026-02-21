export function validateDiscoveryRequest(body: { enabled: any; termsAccepted?: boolean }) {
  const errors: string[] = [];

  if (typeof body.enabled !== 'boolean') {
    errors.push("enabled must be a boolean");
    return { valid: false, errors };
  }

  if (body.enabled && !body.termsAccepted) {
    errors.push("You must accept the terms and conditions to enable diner discovery");
  }

  return { valid: errors.length === 0, errors };
}

export function validateDiscoveryEligibility(onboardingStatus: string) {
  if (onboardingStatus !== 'active') {
    return { eligible: false, error: "Restaurant onboarding must be completed before enabling diner discovery" };
  }
  return { eligible: true, error: null };
}

function getNextInvoiceDate(now: Date): Date {
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return lastDayOfMonth;
}

function getPaymentDueDate(invoiceDate: Date, termDays: number): Date {
  const due = new Date(invoiceDate);
  due.setDate(due.getDate() + termDays);
  return due;
}

export function getSubscriptionStatus(subscription: {
  isSubscribed: boolean;
  plan: string | null;
  pricePerBranch?: number | null;
  billingCycle?: string | null;
  billingType?: string | null;
  paymentTermDays?: number | null;
  subscriptionScope?: string | null;
  subscribedBranchIds?: string[] | null;
  cancelledAt?: Date | null;
  expiresAt: Date | null;
  subscribedAt?: Date | null;
} | null) {
  const defaults = {
    billingCycle: "monthly" as const,
    billingType: "monthly_invoice" as const,
    paymentTermDays: 7,
    subscriptionScope: "all" as const,
    subscribedBranchIds: null as string[] | null,
    cancelledAt: null as string | null,
  };

  if (!subscription) {
    return { isSubscribed: false, plan: "free", pricePerBranch: 1299, ...defaults };
  }
  const now = new Date();
  const isActive = subscription.isSubscribed && (!subscription.expiresAt || subscription.expiresAt > now);
  const termDays = subscription.paymentTermDays ?? 7;
  const billingCycle = subscription.billingCycle ?? "monthly";

  const isCancelled = !!subscription.cancelledAt;

  let invoiceDates: { nextInvoiceDate: string; paymentDueDate: string } | {} = {};
  if (isActive && !isCancelled) {
    if (billingCycle === "annual" && subscription.subscribedAt) {
      const subStart = new Date(subscription.subscribedAt);
      const nextAnnual = new Date(subStart);
      nextAnnual.setFullYear(nextAnnual.getFullYear() + 1);
      while (nextAnnual <= now) {
        nextAnnual.setFullYear(nextAnnual.getFullYear() + 1);
      }
      invoiceDates = {
        nextInvoiceDate: nextAnnual.toISOString(),
        paymentDueDate: getPaymentDueDate(nextAnnual, termDays).toISOString(),
      };
    } else {
      const nextMonthly = getNextInvoiceDate(now);
      invoiceDates = {
        nextInvoiceDate: nextMonthly.toISOString(),
        paymentDueDate: getPaymentDueDate(nextMonthly, termDays).toISOString(),
      };
    }
  }

  return {
    isSubscribed: isActive,
    plan: subscription.plan,
    pricePerBranch: subscription.pricePerBranch ?? 1299,
    billingCycle,
    billingType: billingCycle === "annual" ? "annual_invoice" : "monthly_invoice",
    paymentTermDays: termDays,
    subscriptionScope: subscription.subscriptionScope ?? "all",
    subscribedBranchIds: subscription.subscribedBranchIds ?? null,
    subscribedAt: subscription.subscribedAt,
    cancelledAt: subscription.cancelledAt ? subscription.cancelledAt.toISOString() : null,
    isCancelled,
    expiresAt: subscription.expiresAt ? subscription.expiresAt.toISOString() : null,
    ...invoiceDates,
  };
}
