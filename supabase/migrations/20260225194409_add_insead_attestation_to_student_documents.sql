/*
  # Add insead_attestation document type to student_documents

  1. Modified Tables
    - `student_documents`
      - Updated check constraint to include 'insead_attestation' as a valid document_type
  
  2. Important Notes
    - This allows students to submit INSEAD attestation documents through the same verification pipeline
    - Existing data is not affected as this is an additive change
*/

ALTER TABLE student_documents
  DROP CONSTRAINT IF EXISTS student_documents_document_type_check;

ALTER TABLE student_documents
  ADD CONSTRAINT student_documents_document_type_check
  CHECK (document_type = ANY (ARRAY[
    'id_card_front'::text,
    'id_card_back'::text,
    'accommodation_certificate'::text,
    'insurance_certificate'::text,
    'lease_copy'::text,
    'inventory_copy'::text,
    'insead_attestation'::text
  ]));
