-- 002_add_invoices_customer_fk.sql

ALTER TABLE invoices
  ADD CONSTRAINT invoices_customer_id_fkey
  FOREIGN KEY (customer_id)
  REFERENCES customers(id)
  ON DELETE CASCADE;