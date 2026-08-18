-- ==========================================================
-- CYLINDER TRACKER - PURCHASE BILLS & PERMISSIVE RLS POLICY
-- ==========================================================

-- 1. Create Purchase Bills Table
CREATE TABLE IF NOT EXISTS public.purchase_bills (
    id BIGSERIAL PRIMARY KEY,
    supplier_name TEXT NOT NULL DEFAULT 'Gaspoint Petroleum (India) Limited',
    purchase_date DATE NOT NULL,
    items JSONB NOT NULL, -- [{item_id, item_name, qty, rate, amount, gst_rate}, ...]
    subtotal DECIMAL(10,2) NOT NULL,
    taxable_amount DECIMAL(10,2) NOT NULL,
    cgst DECIMAL(10,2) DEFAULT 0,
    sgst DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL,
    invoice_no TEXT,
    note TEXT,
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS and setup permissive authenticated policies for new tables
ALTER TABLE public.purchase_bills ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Secure partner access - purchase_bills" ON public.purchase_bills;
CREATE POLICY "Secure partner access - purchase_bills" ON public.purchase_bills
    TO authenticated USING (true) WITH CHECK (true);

-- Make items table policy permissive
DROP POLICY IF EXISTS "Secure partner access - items" ON public.items;
CREATE POLICY "Secure partner access - items" ON public.items
    TO authenticated USING (true) WITH CHECK (true);

-- Make party_item_prices policy permissive
DROP POLICY IF EXISTS "Secure partner access - party_item_prices" ON public.party_item_prices;
CREATE POLICY "Secure partner access - party_item_prices" ON public.party_item_prices
    TO authenticated USING (true) WITH CHECK (true);

-- Make stock_adjustments policy permissive
DROP POLICY IF EXISTS "Secure partner access - stock_adjustments" ON public.stock_adjustments;
CREATE POLICY "Secure partner access - stock_adjustments" ON public.stock_adjustments
    TO authenticated USING (true) WITH CHECK (true);

-- Make expense_categories policy permissive
DROP POLICY IF EXISTS "Secure partner access - expense_categories" ON public.expense_categories;
CREATE POLICY "Secure partner access - expense_categories" ON public.expense_categories
    TO authenticated USING (true) WITH CHECK (true);

-- Make expense_items policy permissive
DROP POLICY IF EXISTS "Secure partner access - expense_items" ON public.expense_items;
CREATE POLICY "Secure partner access - expense_items" ON public.expense_items
    TO authenticated USING (true) WITH CHECK (true);

-- Make expenses policy permissive
DROP POLICY IF EXISTS "Secure partner access - expenses" ON public.expenses;
CREATE POLICY "Secure partner access - expenses" ON public.expenses
    TO authenticated USING (true) WITH CHECK (true);

-- Setup Realtime Sync for purchase_bills
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_rel pr JOIN pg_class c ON pr.prrelid = c.oid WHERE c.relname = 'purchase_bills') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.purchase_bills;
    END IF;
END $$;
