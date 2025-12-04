/*
  # Update Subscriptions - Remove Premium Plus Plan

  1. Changes
    - Update plan_type constraint to only allow 'free' and 'premium'
    - Remove 'premium_plus' as a valid option
  
  2. Notes
    - Only 2 plans available: Free (0€) and Premium (29€/month)
    - Premium includes full concierge service
*/

-- Update the check constraint on plan_type to remove premium_plus
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_type_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_plan_type_check 
  CHECK (plan_type IN ('free', 'premium'));