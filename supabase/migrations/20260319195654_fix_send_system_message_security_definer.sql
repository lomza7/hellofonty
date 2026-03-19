/*
  # Fix send_system_message to bypass RLS

  1. Problem
    - When a landlord confirms a booking, the trigger `auto_send_payment_message` 
      calls `send_system_message` which inserts into `messages` with `sender_id = NULL`
    - The RLS insert policy on `messages` requires `auth.uid() = sender_id`, 
      which fails because `auth.uid()` (the landlord) != NULL
    - This causes the entire booking UPDATE to fail with "Erreur lors de la mise a jour"

  2. Fix
    - Make `send_system_message` a SECURITY DEFINER function so it bypasses RLS
    - Make `auto_send_payment_message` a SECURITY DEFINER function
    - Make `notify_booking_status_change` a SECURITY DEFINER function
    - All these functions are only called by triggers, so this is safe

  3. Security
    - These functions are only invoked via database triggers, not directly by users
    - SECURITY DEFINER is necessary for system-generated messages with NULL sender_id
*/

ALTER FUNCTION send_system_message(uuid, text, text) SECURITY DEFINER;
ALTER FUNCTION auto_send_payment_message() SECURITY DEFINER;
ALTER FUNCTION notify_booking_status_change() SECURITY DEFINER;
