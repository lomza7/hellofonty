/*
# Fix Marta Lopez listing Stripe account association

## Problem
Marta Lopez's listing "INSEAD - Appartement vintage elegant" (id: 674598c3-bcc9-4347-a138-778ae2367291)
is associated with an orphaned Stripe account `acct_1U3wcc2eLa0Xabjl` that does not exist
in `landlord_stripe_accounts`. Her active, fully-onboarded account is `acct_1Tw5EiK2zsl4M9C5`
(her default "Compte principal").

## Fix
Update the listing's `stripe_account_id` to her active default account so future rent payments
are routed correctly via Stripe Connect `on_behalf_of`.

## Safety
- Only touches one row (the specific listing).
- The destination account is confirmed active with charges_enabled and payouts_enabled.
- No data is lost; the old orphaned account ID is simply replaced with the correct one.
*/

UPDATE listings
SET stripe_account_id = 'acct_1Tw5EiK2zsl4M9C5'
WHERE id = '674598c3-bcc9-4347-a138-778ae2367291'
  AND stripe_account_id = 'acct_1U3wcc2eLa0Xabjl';
