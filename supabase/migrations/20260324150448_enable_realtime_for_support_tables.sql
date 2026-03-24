/*
  # Enable realtime for support tables

  1. Changes
    - Add support_conversations to supabase_realtime publication
    - Add support_messages to supabase_realtime publication

  2. Notes
    - These tables were previously not registered for realtime,
      which prevented live message updates in the chat widget and admin panel.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'support_conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE support_conversations;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'support_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE support_messages;
  END IF;
END $$;
