-- Phase 3: Add missing indexes on foreign keys
-- These indexes improve query performance for joins and lookups

CREATE INDEX IF NOT EXISTS idx_blocked_dates_created_by ON blocked_dates(created_by);
CREATE INDEX IF NOT EXISTS idx_blocked_messages_booking_id ON blocked_messages(booking_id);
CREATE INDEX IF NOT EXISTS idx_inventory_signatures_signer_id ON inventory_signatures(signer_id);
CREATE INDEX IF NOT EXISTS idx_manager_assignments_assigned_by ON manager_assignments(assigned_by);
CREATE INDEX IF NOT EXISTS idx_property_inventories_booking_id ON property_inventories(booking_id);
CREATE INDEX IF NOT EXISTS idx_property_inventories_check_in_inventory_id ON property_inventories(check_in_inventory_id);
CREATE INDEX IF NOT EXISTS idx_property_inventories_lease_id ON property_inventories(lease_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_sender_id ON support_messages(sender_id);
