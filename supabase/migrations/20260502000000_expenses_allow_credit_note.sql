-- Extend the document_type check on expenses to allow CREDIT_NOTE.
-- Suppliers issue credit notes that offset invoices; the application
-- already supports the document_type, but the DB constraint blocks it.

ALTER TABLE expenses
  DROP CONSTRAINT IF EXISTS expenses_document_type_check;

ALTER TABLE expenses
  ADD CONSTRAINT expenses_document_type_check
  CHECK (document_type IN (
    'INVOICE', 'EXPENSE_ORDER', 'RECEIPT', 'NO_DOCUMENT', 'CREDIT_NOTE'
  ));
