DELETE FROM public.bills WHERE legacy_invoice_no IS NOT NULL;
DELETE FROM public.payments WHERE note LIKE 'Legacy Import%';
