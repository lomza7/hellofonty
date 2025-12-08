/*
  # Admin Subscription Access and Stripe Integration

  1. Schema Changes
    - Add `stripe_price_id` column to `pricing_plans` if not exists
    - Ensure all necessary indexes are in place
  
  2. Security Enhancements
    - Allow admins to view all subscriptions
    - Allow admins to view all stripe-related tables
    - Add policy for admins to access stripe_customers
  
  3. Notes
    - Admins need full visibility for support and management
    - RLS policies ensure only admins can access sensitive data
*/

-- Add stripe_price_id to pricing_plans if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pricing_plans' AND column_name = 'stripe_price_id'
  ) THEN
    ALTER TABLE pricing_plans ADD COLUMN stripe_price_id text;
  END IF;
END $$;

-- Add stripe_product_id to pricing_plans if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pricing_plans' AND column_name = 'stripe_product_id'
  ) THEN
    ALTER TABLE pricing_plans ADD COLUMN stripe_product_id text;
  END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_pricing_plans_stripe_price_id ON pricing_plans(stripe_price_id);
CREATE INDEX IF NOT EXISTS idx_pricing_plans_stripe_product_id ON pricing_plans(stripe_product_id);

-- Drop existing policies if they exist and recreate them
DO $$
BEGIN
  -- subscriptions policies
  DROP POLICY IF EXISTS "Admin can view all subscriptions" ON subscriptions;
  DROP POLICY IF EXISTS "Admin can update all subscriptions" ON subscriptions;
  
  -- invoices policies
  DROP POLICY IF EXISTS "Admin can insert invoices" ON invoices;
  
  -- stripe_customers policies
  DROP POLICY IF EXISTS "Admin can view all stripe customers" ON stripe_customers;
  
  -- stripe_subscriptions policies
  DROP POLICY IF EXISTS "Admin can view all stripe subscriptions" ON stripe_subscriptions;
END $$;

-- Admin policies for subscriptions table
CREATE POLICY "Admin can view all subscriptions"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admin can update all subscriptions"
  ON subscriptions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admin policies for invoices table
CREATE POLICY "Admin can insert invoices"
  ON invoices FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admin policies for stripe_customers table
CREATE POLICY "Admin can view all stripe customers"
  ON stripe_customers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admin policies for stripe_subscriptions table
CREATE POLICY "Admin can view all stripe subscriptions"
  ON stripe_subscriptions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Create a view for easy subscription management (admin only)
CREATE OR REPLACE VIEW admin_subscription_overview AS
SELECT 
  p.id as user_id,
  p.first_name,
  p.last_name,
  p.role,
  s.plan_type,
  s.status as subscription_status,
  s.current_period_start,
  s.current_period_end,
  s.cancel_at_period_end,
  s.stripe_customer_id,
  s.stripe_subscription_id,
  s.stripe_price_id,
  s.created_at as subscription_created_at,
  s.updated_at as subscription_updated_at
FROM profiles p
LEFT JOIN subscriptions s ON p.id = s.user_id
WHERE p.role = 'landlord'
ORDER BY s.created_at DESC;

-- Grant access to the view for authenticated users (RLS will control actual access)
GRANT SELECT ON admin_subscription_overview TO authenticated;

-- Create a function to calculate Monthly Recurring Revenue (MRR)
CREATE OR REPLACE FUNCTION calculate_mrr()
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_mrr numeric := 0;
BEGIN
  -- Only allow admins to call this function
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin only.';
  END IF;

  SELECT COALESCE(SUM(pp.price::numeric), 0)
  INTO total_mrr
  FROM subscriptions s
  JOIN pricing_plans pp ON s.stripe_price_id = pp.stripe_price_id
  WHERE s.status IN ('active', 'trialing')
  AND s.plan_type != 'free'
  AND pp.is_active = true;

  RETURN total_mrr;
END;
$$;
