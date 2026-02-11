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

export function getSubscriptionStatus(subscription: {
  isSubscribed: boolean;
  plan: string | null;
  expiresAt: Date | null;
  subscribedAt?: Date | null;
} | null) {
  if (!subscription) {
    return { isSubscribed: false, plan: "free" };
  }
  const now = new Date();
  const isActive = subscription.isSubscribed && (!subscription.expiresAt || subscription.expiresAt > now);
  return {
    isSubscribed: isActive,
    plan: subscription.plan,
    subscribedAt: subscription.subscribedAt,
    expiresAt: subscription.expiresAt,
  };
}
