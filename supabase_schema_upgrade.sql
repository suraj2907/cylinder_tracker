-- ================================================
-- CYLINDER TRACKER - PHASE 2 SCHEMA UPGRADE
-- ================================================

-- 1. Create Items Table
CREATE TABLE IF NOT EXISTS public.items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    gst_applicable BOOLEAN DEFAULT true,
    hsn_code TEXT DEFAULT '27111900',
    default_rate DECIMAL(10,2) DEFAULT 0,
    low_stock_threshold DECIMAL(10,2) DEFAULT 10,
    purchase_price DECIMAL(10,2) DEFAULT 0,
    gst_rate DECIMAL(5,2) DEFAULT 18,
    price_includes_tax BOOLEAN DEFAULT true,
    current_stock DECIMAL(10,2) DEFAULT 0,
    item_type TEXT DEFAULT 'product', -- 'product' | 'service'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Secure partner access - items" ON public.items;
CREATE POLICY "Secure partner access - items" ON public.items
    TO authenticated
    USING (auth.jwt() ->> 'email' = 'surajjawrani2022@gmail.com' OR auth.jwt() ->> 'email' = 'shivam09498@gmail.com')
    WITH CHECK (auth.jwt() ->> 'email' = 'surajjawrani2022@gmail.com' OR auth.jwt() ->> 'email' = 'shivam09498@gmail.com');

-- 2. Create Stock Purchases Table
CREATE TABLE IF NOT EXISTS public.stock_purchases (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    item_id UUID REFERENCES public.items(id) ON DELETE CASCADE,
    qty DECIMAL(10,2) NOT NULL,
    amount DECIMAL(10,2) NOT NULL, -- GST inclusive purchase amount
    purchase_date DATE NOT NULL,
    supplier_name TEXT DEFAULT 'Gaspoint Petroleum (India) Limited',
    note TEXT,
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.stock_purchases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Secure partner access - stock_purchases" ON public.stock_purchases;
CREATE POLICY "Secure partner access - stock_purchases" ON public.stock_purchases
    TO authenticated
    USING (auth.jwt() ->> 'email' = 'surajjawrani2022@gmail.com' OR auth.jwt() ->> 'email' = 'shivam09498@gmail.com')
    WITH CHECK (auth.jwt() ->> 'email' = 'surajjawrani2022@gmail.com' OR auth.jwt() ->> 'email' = 'shivam09498@gmail.com');

-- 3. Create Custom Pricing Table
CREATE TABLE IF NOT EXISTS public.party_item_prices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    restaurant_name TEXT NOT NULL REFERENCES public.restaurants(name) ON DELETE CASCADE,
    item_id UUID REFERENCES public.items(id) ON DELETE CASCADE,
    price DECIMAL(10,2) NOT NULL,
    UNIQUE(restaurant_name, item_id)
);

ALTER TABLE public.party_item_prices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Secure partner access - party_item_prices" ON public.party_item_prices;
CREATE POLICY "Secure partner access - party_item_prices" ON public.party_item_prices
    TO authenticated
    USING (auth.jwt() ->> 'email' = 'surajjawrani2022@gmail.com' OR auth.jwt() ->> 'email' = 'shivam09498@gmail.com')
    WITH CHECK (auth.jwt() ->> 'email' = 'surajjawrani2022@gmail.com' OR auth.jwt() ->> 'email' = 'shivam09498@gmail.com');

-- 4. Create Stock Adjustments Table
CREATE TABLE IF NOT EXISTS public.stock_adjustments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    item_id UUID REFERENCES public.items(id) ON DELETE CASCADE,
    adjustment_qty DECIMAL(10,2) NOT NULL, -- positive or negative
    reason TEXT,
    adjusted_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.stock_adjustments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Secure partner access - stock_adjustments" ON public.stock_adjustments;
CREATE POLICY "Secure partner access - stock_adjustments" ON public.stock_adjustments
    TO authenticated
    USING (auth.jwt() ->> 'email' = 'surajjawrani2022@gmail.com' OR auth.jwt() ->> 'email' = 'shivam09498@gmail.com')
    WITH CHECK (auth.jwt() ->> 'email' = 'surajjawrani2022@gmail.com' OR auth.jwt() ->> 'email' = 'shivam09498@gmail.com');

-- 5. Create Expense Categories Table
CREATE TABLE IF NOT EXISTS public.expense_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Secure partner access - expense_categories" ON public.expense_categories;
CREATE POLICY "Secure partner access - expense_categories" ON public.expense_categories
    TO authenticated
    USING (auth.jwt() ->> 'email' = 'surajjawrani2022@gmail.com' OR auth.jwt() ->> 'email' = 'shivam09498@gmail.com')
    WITH CHECK (auth.jwt() ->> 'email' = 'surajjawrani2022@gmail.com' OR auth.jwt() ->> 'email' = 'shivam09498@gmail.com');

-- Seed Categories
INSERT INTO public.expense_categories (name) VALUES
    ('Bishi amount monthly'), ('Party Discount'), ('Tata ace fitness'), ('Tata ace insurance'),
    ('Tata ace emi'), ('Transportation & Travel Expense'), ('Telephone & Internet Expense'),
    ('Employee Salaries & Advances'), ('Repair & Maintenance'), ('Rent Expense')
ON CONFLICT (name) DO NOTHING;

-- 6. Create Expense Items Table
CREATE TABLE IF NOT EXISTS public.expense_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    default_rate DECIMAL(10,2) DEFAULT 0,
    itc_eligible BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.expense_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Secure partner access - expense_items" ON public.expense_items;
CREATE POLICY "Secure partner access - expense_items" ON public.expense_items
    TO authenticated
    USING (auth.jwt() ->> 'email' = 'surajjawrani2022@gmail.com' OR auth.jwt() ->> 'email' = 'shivam09498@gmail.com')
    WITH CHECK (auth.jwt() ->> 'email' = 'surajjawrani2022@gmail.com' OR auth.jwt() ->> 'email' = 'shivam09498@gmail.com');

-- Seed Expense Items
INSERT INTO public.expense_items (name, default_rate) VALUES
    ('Manish Bhaiya Salary', 0), ('Manish Bhaiya advance', 0), ('insurance', 15700),
    ('Manish Driver Salary', 0), ('Fast Tag', 500), ('Fitness', 6000),
    ('Regulator', 150), ('tata ace emi', 11532), ('Gadi Repairing', 430),
    ('Converter', 225), ('Diesel', 510)
ON CONFLICT (name) DO NOTHING;

-- 7. Create Expenses Table
CREATE TABLE IF NOT EXISTS public.expenses (
    id BIGSERIAL PRIMARY KEY,
    category_id UUID REFERENCES public.expense_categories(id),
    expense_date DATE NOT NULL,
    items JSONB NOT NULL,          -- [{item_name, qty, rate, amount}, ...]
    additional_charges DECIMAL(10,2) DEFAULT 0,
    discount DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL,
    payment_mode TEXT DEFAULT 'Cash',
    note TEXT,
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Secure partner access - expenses" ON public.expenses;
CREATE POLICY "Secure partner access - expenses" ON public.expenses
    TO authenticated
    USING (auth.jwt() ->> 'email' = 'surajjawrani2022@gmail.com' OR auth.jwt() ->> 'email' = 'shivam09498@gmail.com')
    WITH CHECK (auth.jwt() ->> 'email' = 'surajjawrani2022@gmail.com' OR auth.jwt() ->> 'email' = 'shivam09498@gmail.com');

-- 8. Add columns to public.bills
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS legacy_invoice_no TEXT;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS legacy_link TEXT;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS payment_type TEXT;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid';
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(10,2) DEFAULT 0;

-- 9. Setup Realtime Sync Safely
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_rel pr JOIN pg_class c ON pr.prrelid = c.oid WHERE c.relname = 'items') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.items;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_rel pr JOIN pg_class c ON pr.prrelid = c.oid WHERE c.relname = 'stock_purchases') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_purchases;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_rel pr JOIN pg_class c ON pr.prrelid = c.oid WHERE c.relname = 'party_item_prices') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.party_item_prices;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_rel pr JOIN pg_class c ON pr.prrelid = c.oid WHERE c.relname = 'stock_adjustments') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_adjustments;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_rel pr JOIN pg_class c ON pr.prrelid = c.oid WHERE c.relname = 'expense_categories') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.expense_categories;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_rel pr JOIN pg_class c ON pr.prrelid = c.oid WHERE c.relname = 'expense_items') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.expense_items;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_rel pr JOIN pg_class c ON pr.prrelid = c.oid WHERE c.relname = 'expenses') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.expenses;
    END IF;
END $$;

-- 10. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_stock_purchases_item ON public.stock_purchases(item_id);
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_item ON public.stock_adjustments(item_id);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON public.expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(expense_date);
