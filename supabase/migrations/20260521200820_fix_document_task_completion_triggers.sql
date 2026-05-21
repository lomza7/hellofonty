/*
  # Fix document upload task completion triggers

  1. Problem
    - Landlord document trigger only fires on INSERT, not UPDATE (re-uploads don't complete tasks)
    - Student document trigger only fires on INSERT, not UPDATE
    - Student trigger checks for 'accommodation_certificate' but TaskCard inserts 'insead_attestation'

  2. Changes
    - Update landlord document trigger to fire on both INSERT and UPDATE
    - Update student document trigger to fire on both INSERT and UPDATE
    - Student trigger now handles both 'accommodation_certificate' and 'insead_attestation' document types
*/

-- Fix landlord document trigger: fire on INSERT and UPDATE
CREATE OR REPLACE FUNCTION complete_landlord_document_task()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  task_title text;
BEGIN
  IF NEW.document_type = 'id_card' THEN
    task_title := 'Télécharger votre justificatif d''identité';
  ELSIF NEW.document_type = 'property_tax' THEN
    task_title := 'Télécharger votre taxe foncière';
  END IF;

  IF task_title IS NOT NULL THEN
    UPDATE tasks
    SET
      status = 'completed',
      completed_at = now()
    WHERE
      user_id = NEW.landlord_id
      AND title = task_title
      AND status = 'pending';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS after_landlord_document_insert ON landlord_documents;
CREATE TRIGGER after_landlord_document_change
  AFTER INSERT OR UPDATE ON landlord_documents
  FOR EACH ROW
  EXECUTE FUNCTION complete_landlord_document_task();

-- Fix student document trigger: fire on INSERT and UPDATE, handle insead_attestation
CREATE OR REPLACE FUNCTION complete_student_document_task()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.document_type IN ('accommodation_certificate', 'insead_attestation') THEN
    UPDATE tasks
    SET
      status = 'completed',
      completed_at = now()
    WHERE
      user_id = NEW.student_id
      AND title = 'Télécharger votre attestation INSEAD'
      AND status = 'pending';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS after_student_document_insert ON student_documents;
CREATE TRIGGER after_student_document_change
  AFTER INSERT OR UPDATE ON student_documents
  FOR EACH ROW
  EXECUTE FUNCTION complete_student_document_task();