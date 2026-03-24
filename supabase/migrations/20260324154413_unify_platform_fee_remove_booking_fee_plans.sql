/*
  # Unify platform fee - Remove booking_fee plans

  1. Changes
    - Remove all pricing plans with plan_category = 'booking_fee' since the platform fee
      is now managed exclusively through the `platform_settings` table (setting_key: 'platform_fee_amount')
    - This eliminates the redundancy between `pricing_plans.booking_fee` and `platform_settings.platform_fee_amount`

  2. Context
    - The booking fee was previously tracked in two places:
      - `platform_settings.platform_fee_amount` (390 EUR) - used by Stripe for actual charges
      - `pricing_plans` with plan_category='booking_fee' (500 EUR) - used for display/analytics only
    - This mismatch caused incorrect revenue calculations in admin analytics
    - Going forward, `platform_settings.platform_fee_amount` is the single source of truth

  3. Important Notes
    - No data loss: the actual fee configuration in `platform_settings` is preserved
    - Only removes redundant plan entries from `pricing_plans`
*/

DELETE FROM pricing_plans WHERE plan_category = 'booking_fee';
