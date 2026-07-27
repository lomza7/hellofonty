/*
# Create booking email notification triggers

1. New Functions
   - `notify_booking_email()` — trigger function that calls the send-booking-notification edge function
     via pg_net HTTP POST whenever a booking is created or its status changes

2. New Triggers
   - `trigger_booking_created_email` — fires AFTER INSERT on bookings (new requests)
   - `trigger_booking_status_changed_email` — fires AFTER UPDATE on bookings when status changes

3. Notifications sent
   - New booking request: email to landlord + admin
   - Booking confirmed: email to student + admin
   - Booking cancelled/refused: email to student + admin

4. Important Notes
   - Uses pg_net extension for async HTTP calls (non-blocking)
   - Edge function deployed with verify_jwt=false (internal call)
   - All notification types handled by a single edge function
*/

CREATE OR REPLACE FUNCTION notify_booking_email()
RETURNS TRIGGER AS $$
DECLARE
  notification_type text;
  payload jsonb;
  function_url text;
BEGIN
  function_url := 'https://bowqrkapnzvcbaciaplx.supabase.co/functions/v1/send-booking-notification';

  IF TG_OP = 'INSERT' THEN
    notification_type := 'new_request';
  ELSIF TG_OP = 'UPDATE' AND OLD.status <> NEW.status THEN
    IF NEW.status = 'confirmed' THEN
      notification_type := 'confirmed';
    ELSIF NEW.status = 'cancelled' THEN
      notification_type := 'cancelled';
    ELSE
      RETURN NEW;
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  payload := jsonb_build_object(
    'type', notification_type,
    'record', jsonb_build_object(
      'id', NEW.id,
      'listing_id', NEW.listing_id,
      'student_id', NEW.student_id,
      'start_date', NEW.start_date,
      'end_date', NEW.end_date,
      'total_days', NEW.total_days,
      'total_price', NEW.total_price,
      'status', NEW.status
    )
  );

  PERFORM net.http_post(
    url := function_url,
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := payload
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_booking_created_email ON bookings;
CREATE TRIGGER trigger_booking_created_email
  AFTER INSERT ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION notify_booking_email();

DROP TRIGGER IF EXISTS trigger_booking_status_changed_email ON bookings;
CREATE TRIGGER trigger_booking_status_changed_email
  AFTER UPDATE ON bookings
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION notify_booking_email();
