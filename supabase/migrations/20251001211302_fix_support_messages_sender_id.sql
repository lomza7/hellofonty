/*
  # Fix support_messages table for authenticated users

  1. Changes
    - Make sender_id nullable to allow both authenticated and guest users
  
  2. Security
    - Maintain existing RLS policies
*/

-- Make sender_id nullable for guest users
ALTER TABLE support_messages 
ALTER COLUMN sender_id DROP NOT NULL;
