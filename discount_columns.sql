-- Run before deploying the discount fields. Existing bills keep a zero discount.
ALTER TABLE public.bills
  ADD COLUMN IF NOT EXISTS discount DECIMAL(10,2) NOT NULL DEFAULT 0;

ALTER TABLE public.purchase_bills
  ADD COLUMN IF NOT EXISTS discount DECIMAL(10,2) NOT NULL DEFAULT 0;
