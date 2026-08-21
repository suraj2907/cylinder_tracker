-- Run this once in Supabase SQL Editor before deploying the corresponding app update.
-- It finalizes invoice numbering, links collections to invoices, and restores partner-only access.

ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS invoice_no BIGINT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS bill_id BIGINT REFERENCES public.bills(id) ON DELETE SET NULL;

CREATE SEQUENCE IF NOT EXISTS public.bills_invoice_no_seq START WITH 3499;

SELECT setval(
  'public.bills_invoice_no_seq',
  GREATEST(3498, COALESCE((SELECT MAX(invoice_no) FROM public.bills), 3498)),
  true
);

-- Keep existing invoice numbers untouched; assign fresh numbers only to old rows without one.
UPDATE public.bills
SET invoice_no = nextval('public.bills_invoice_no_seq')
WHERE invoice_no IS NULL;

ALTER TABLE public.bills
  ALTER COLUMN invoice_no SET DEFAULT nextval('public.bills_invoice_no_seq');
ALTER TABLE public.bills
  ALTER COLUMN invoice_no SET NOT NULL;

GRANT USAGE, SELECT ON SEQUENCE public.bills_invoice_no_seq TO authenticated;
CREATE UNIQUE INDEX IF NOT EXISTS bills_invoice_no_unique ON public.bills(invoice_no);
CREATE INDEX IF NOT EXISTS idx_payments_bill_id ON public.payments(bill_id);

CREATE OR REPLACE FUNCTION public.record_bill_payment(
  p_bill_id BIGINT,
  p_amount NUMERIC,
  p_payment_mode TEXT,
  p_note TEXT,
  p_payment_date DATE,
  p_user_name TEXT
)
RETURNS public.bills
LANGUAGE plpgsql
AS $$
DECLARE
  v_bill public.bills;
  v_new_paid NUMERIC(10,2);
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be positive';
  END IF;

  SELECT * INTO v_bill FROM public.bills WHERE id = p_bill_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  v_new_paid := COALESCE(v_bill.amount_paid, 0) + p_amount;
  IF v_new_paid > v_bill.total_amount + 0.05 THEN
    RAISE EXCEPTION 'Payment exceeds pending balance';
  END IF;

  INSERT INTO public.payments (bill_id, restaurant_name, amount, payment_mode, user_name, date, note)
  VALUES (p_bill_id, v_bill.restaurant_name, p_amount, p_payment_mode, p_user_name, p_payment_date, p_note);

  UPDATE public.bills
  SET amount_paid = ROUND(v_new_paid, 2),
      payment_status = CASE WHEN v_new_paid >= total_amount - 0.05 THEN 'paid' ELSE 'partially_paid' END
  WHERE id = p_bill_id
  RETURNING * INTO v_bill;

  RETURN v_bill;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_bill_payment(BIGINT, NUMERIC, TEXT, TEXT, DATE, TEXT) TO authenticated;

-- Replace the temporary permissive policies created by earlier upgrades.
DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'batches', 'entries', 'payments', 'restaurants', 'bills', 'items',
    'purchase_bills', 'party_item_prices', 'stock_adjustments',
    'expense_categories', 'expense_items', 'expenses'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Secure partner access - ' || table_name, table_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I TO authenticated '
      || 'USING (auth.jwt() ->> ''email'' IN (''surajjawrani2022@gmail.com'', ''shivam09498@gmail.com'')) '
      || 'WITH CHECK (auth.jwt() ->> ''email'' IN (''surajjawrani2022@gmail.com'', ''shivam09498@gmail.com''))',
      'Secure partner access - ' || table_name, table_name
    );
  END LOOP;
END $$;
