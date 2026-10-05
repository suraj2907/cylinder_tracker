-- Quotation / Estimate workflow
-- Run once in Supabase SQL Editor before opening the Quotations tab.

CREATE TABLE IF NOT EXISTS public.quotations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    quotation_no BIGINT NOT NULL UNIQUE,
    restaurant_name TEXT NOT NULL,
    quotation_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    batch_num BIGINT,
    gst_mode TEXT NOT NULL DEFAULT 'gst' CHECK (gst_mode IN ('gst', 'none')),
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
    taxable_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    cgst DECIMAL(12,2) NOT NULL DEFAULT 0,
    sgst DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'converting', 'converted', 'cancelled')),
    converted_bill_id BIGINT REFERENCES public.bills(id) ON DELETE SET NULL,
    converted_invoice_no BIGINT,
    converted_at TIMESTAMP WITH TIME ZONE,
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.bills
    ADD COLUMN IF NOT EXISTS source_quotation_id UUID REFERENCES public.quotations(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_bills_source_quotation
    ON public.bills(source_quotation_id)
    WHERE source_quotation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quotations_restaurant ON public.quotations(restaurant_name);
CREATE INDEX IF NOT EXISTS idx_quotations_status ON public.quotations(status);

ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Secure partner access - quotations" ON public.quotations;
CREATE POLICY "Secure partner access - quotations" ON public.quotations
    TO authenticated
    USING (auth.jwt() ->> 'email' IN ('surajjawrani2022@gmail.com', 'shivam09498@gmail.com'))
    WITH CHECK (auth.jwt() ->> 'email' IN ('surajjawrani2022@gmail.com', 'shivam09498@gmail.com'));

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'quotations'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.quotations;
    END IF;
END $$;
