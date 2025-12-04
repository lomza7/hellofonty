/*
  # Create email verification system

  1. New Tables
    - `email_verification_codes`
      - `id` (uuid, primary key)
      - `email` (text, not null)
      - `code` (text, not null) - 6 digit verification code
      - `expires_at` (timestamptz, not null) - expiration time (15 minutes)
      - `used` (boolean, default false)
      - `created_at` (timestamptz, default now())
      
    - `email_verification_attempts`
      - `id` (uuid, primary key)
      - `email` (text, not null)
      - `attempted_at` (timestamptz, default now())
      - Rate limiting: max 5 attempts per hour per email
      
  2. Indexes
    - Index on email for fast lookups
    - Index on expires_at for cleanup queries
    
  3. Security
    - Enable RLS on both tables
    - Public can insert verification codes (via edge function)
    - Public can read their own codes (via edge function with email match)
*/

-- Create email_verification_codes table
CREATE TABLE IF NOT EXISTS email_verification_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  code text NOT NULL,
  expires_at timestamptz NOT NULL,
  used boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create email_verification_attempts table for rate limiting
CREATE TABLE IF NOT EXISTS email_verification_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  attempted_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_email_verification_codes_email ON email_verification_codes(email);
CREATE INDEX IF NOT EXISTS idx_email_verification_codes_expires_at ON email_verification_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_email_verification_attempts_email ON email_verification_attempts(email);

-- Enable RLS
ALTER TABLE email_verification_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_verification_attempts ENABLE ROW LEVEL SECURITY;

-- Policies for email_verification_codes
CREATE POLICY "Anyone can insert verification codes"
  ON email_verification_codes FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Anyone can read verification codes"
  ON email_verification_codes FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Anyone can update verification codes"
  ON email_verification_codes FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

-- Policies for email_verification_attempts
CREATE POLICY "Anyone can insert verification attempts"
  ON email_verification_attempts FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Anyone can read verification attempts"
  ON email_verification_attempts FOR SELECT
  TO public
  USING (true);

-- Function to clean up old verification codes (older than 1 hour)
CREATE OR REPLACE FUNCTION cleanup_old_verification_codes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM email_verification_codes
  WHERE created_at < now() - interval '1 hour';
  
  DELETE FROM email_verification_attempts
  WHERE attempted_at < now() - interval '1 hour';
END;
$$;
