-- Delete Delphine Chauviere's two expired bookings and all related data
-- Booking 1: 2cd84026-2d3a-493f-9b06-b2f835bc6715 (Cour Napoléon, payment_status: expired)
-- Booking 2: 4716a617-147d-4f30-9307-7033b10c3916 (Le Lagorsse, payment_status: expired)

-- Step 1: Delete notifications referencing these bookings
DELETE FROM notifications WHERE related_id IN ('2cd84026-2d3a-493f-9b06-b2f835bc6715','4716a617-147d-4f30-9307-7033b10c3916');

-- Step 2: Delete messages associated with these bookings
DELETE FROM messages WHERE booking_id IN ('2cd84026-2d3a-493f-9b06-b2f835bc6715','4716a617-147d-4f30-9307-7033b10c3916');

-- Step 3: Delete leases associated with these bookings
DELETE FROM leases WHERE booking_id IN ('2cd84026-2d3a-493f-9b06-b2f835bc6715','4716a617-147d-4f30-9307-7033b10c3916');

-- Step 4: Delete the bookings themselves
DELETE FROM bookings WHERE id IN ('2cd84026-2d3a-493f-9b06-b2f835bc6715','4716a617-147d-4f30-9307-7033b10c3916');
