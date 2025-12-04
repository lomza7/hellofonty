/*
  # Fix support_conversations table for authenticated users

  1. Changes
    - Make user_id nullable to allow both authenticated and guest users
    - Add constraint to ensure either user_id or user_email is present
  
  2. Security
    - Maintain existing RLS policies
*/

-- Make user_id nullable
ALTER TABLE support_conversations 
ALTER COLUMN user_id DROP NOT NULL;

-- Add constraint to ensure either user_id or user_email exists
ALTER TABLE support_conversations
ADD CONSTRAINT user_id_or_email_required 
CHECK (user_id IS NOT NULL OR user_email IS NOT NULL);
