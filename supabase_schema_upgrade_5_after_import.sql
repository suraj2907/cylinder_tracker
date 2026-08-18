-- Point the sequence to start right after the highest imported invoice number
SELECT setval('public.invoice_no_seq', (SELECT COALESCE(MAX(invoice_no), 0) FROM public.bills) + 1, false);

-- From now on, any new bill inserted WITHOUT an explicit invoice_no gets the next number automatically
ALTER TABLE public.bills ALTER COLUMN invoice_no SET DEFAULT nextval('public.invoice_no_seq');
