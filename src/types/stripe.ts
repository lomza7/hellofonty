export type StripeOnboardingStatus = 'not_connected' | 'pending' | 'complete';

export interface StripeAccountStatus {
  details_submitted: boolean;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  onboarding_status: StripeOnboardingStatus;
  requirements: StripeAccountRequirements;
  account_id: string;
}

export interface StripeAccountRequirements {
  currently_due: string[];
  eventually_due: string[];
  past_due: string[];
  pending_verification: string[];
}

export interface StripeCreateAccountResponse {
  success: boolean;
  accountId?: string;
  alreadyExists?: boolean;
  error?: string;
}

export interface StripeOnboardingLinkResponse {
  success: boolean;
  url?: string;
  error?: string;
}

export interface StripeAccountStatusResponse {
  success: boolean;
  status?: StripeAccountStatus;
  error?: string;
}
