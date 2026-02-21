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
  billingType?: string | null;
  paymentTermDays?: number | null;
  expiresAt: Date | null;
  subscribedAt?: Date | null;
} | null) {
  const defaultBilling = {
    billingType: "monthly_invoice" as const,
    paymentTermDays: 7,
  };

  if (!subscription) {
    return { isSubscribed: false, plan: "free", pricePerBranch: 1299, ...defaultBilling };
  }
  const now = new Date();
  const isActive = subscription.isSubscribed && (!subscription.expiresAt || subscription.expiresAt > now);
  const termDays = subscription.paymentTermDays ?? 7;

  const nextInvoiceDate = getNextInvoiceDate(now);
  const paymentDueDate = getPaymentDueDate(nextInvoiceDate, termDays);

  return {
    isSubscribed: isActive,
    plan: subscription.plan,
    pricePerBranch: subscription.pricePerBranch ?? 1299,
    billingType: subscription.billingType ?? "monthly_invoice",
    paymentTermDays: termDays,
    subscribedAt: subscription.subscribedAt,
    expiresAt: subscription.expiresAt,
    ...(isActive ? {
      nextInvoiceDate: nextInvoiceDate.toISOString(),
      paymentDueDate: paymentDueDate.toISOString(),
    } : {}),
  };
}
