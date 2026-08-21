-- ================================================
-- CYLINDER TRACKER - SUPABASE SCHEMA & REALTIME SETUP
-- ================================================

-- 1. Create Batches Table
CREATE TABLE IF NOT EXISTS public.batches (
    batch_num BIGINT PRIMARY KEY,
    khali_date DATE,
    note TEXT,
    booking_cost DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add booking_cost column if batches table already existed without it
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='batches' AND column_name='booking_cost') THEN
        ALTER TABLE public.batches ADD COLUMN booking_cost DECIMAL(10,2) DEFAULT 0;
    END IF;
END $$;

-- 2. Create Entries Table
CREATE TABLE IF NOT EXISTS public.entries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    batch_num BIGINT REFERENCES public.batches(batch_num) ON DELETE CASCADE,
    name TEXT NOT NULL,
    qty INT NOT NULL DEFAULT 1,
    type TEXT NOT NULL DEFAULT '19.2kg',
    date DATE,
    is_return BOOLEAN DEFAULT false,
    user_name TEXT DEFAULT 'Suraj',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add user_name column if entries table already existed without it
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='entries' AND column_name='user_name') THEN
        ALTER TABLE public.entries ADD COLUMN user_name TEXT DEFAULT 'Suraj';
    END IF;
END $$;

-- 3. Create Payments Table
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    batch_num BIGINT REFERENCES public.batches(batch_num) ON DELETE CASCADE,
    restaurant_name TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    payment_mode TEXT NOT NULL DEFAULT 'Cash', -- 'Cash' or 'UPI'
    user_name TEXT DEFAULT 'Suraj', -- 'Suraj' or 'Shivam'
    date DATE,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Enable Row Level Security (RLS) & Authenticated Access Policies
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Secure partner access - batches" ON public.batches
    TO authenticated 
    USING (auth.jwt() ->> 'email' = 'surajjawrani2022@gmail.com' OR auth.jwt() ->> 'email' = 'shivam09498@gmail.com')
    WITH CHECK (auth.jwt() ->> 'email' = 'surajjawrani2022@gmail.com' OR auth.jwt() ->> 'email' = 'shivam09498@gmail.com');

CREATE POLICY "Secure partner access - entries" ON public.entries
    TO authenticated 
    USING (auth.jwt() ->> 'email' = 'surajjawrani2022@gmail.com' OR auth.jwt() ->> 'email' = 'shivam09498@gmail.com')
    WITH CHECK (auth.jwt() ->> 'email' = 'surajjawrani2022@gmail.com' OR auth.jwt() ->> 'email' = 'shivam09498@gmail.com');

CREATE POLICY "Secure partner access - payments" ON public.payments
    TO authenticated 
    USING (auth.jwt() ->> 'email' = 'surajjawrani2022@gmail.com' OR auth.jwt() ->> 'email' = 'shivam09498@gmail.com')
    WITH CHECK (auth.jwt() ->> 'email' = 'surajjawrani2022@gmail.com' OR auth.jwt() ->> 'email' = 'shivam09498@gmail.com');

-- 5. Enable Supabase Realtime Replication
ALTER PUBLICATION supabase_realtime ADD TABLE public.batches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.entries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;

-- 6. Indexes for High Performance
CREATE INDEX IF NOT EXISTS idx_entries_batch_num ON public.entries(batch_num);
CREATE INDEX IF NOT EXISTS idx_entries_name ON public.entries(name);
CREATE INDEX IF NOT EXISTS idx_payments_batch_num ON public.payments(batch_num);
CREATE INDEX IF NOT EXISTS idx_payments_restaurant ON public.payments(restaurant_name);

-- ================================================
-- BILLING FEATURE - RESTAURANT PROFILES & INVOICES
-- ================================================

-- 7. Create Restaurants Table (profile: mobile, GST, address)
CREATE TABLE IF NOT EXISTS public.restaurants (
    name TEXT PRIMARY KEY,
    mobile TEXT,
    gst_num TEXT,
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Secure partner access - restaurants" ON public.restaurants
    TO authenticated 
    USING (auth.jwt() ->> 'email' = 'surajjawrani2022@gmail.com' OR auth.jwt() ->> 'email' = 'shivam09498@gmail.com')
    WITH CHECK (auth.jwt() ->> 'email' = 'surajjawrani2022@gmail.com' OR auth.jwt() ->> 'email' = 'shivam09498@gmail.com');

ALTER PUBLICATION supabase_realtime ADD TABLE public.restaurants;

-- 8. Create Bills Table (generated invoice history)
CREATE TABLE IF NOT EXISTS public.bills (
    id BIGSERIAL PRIMARY KEY,
    restaurant_name TEXT NOT NULL,
    bill_date DATE NOT NULL,
    gst_mode TEXT NOT NULL DEFAULT 'gst', -- 'gst' or 'none'
    items JSONB NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    taxable_amount DECIMAL(10,2) NOT NULL,
    cgst DECIMAL(10,2) DEFAULT 0,
    sgst DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL,
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Secure partner access - bills" ON public.bills
    TO authenticated 
    USING (auth.jwt() ->> 'email' = 'surajjawrani2022@gmail.com' OR auth.jwt() ->> 'email' = 'shivam09498@gmail.com')
    WITH CHECK (auth.jwt() ->> 'email' = 'surajjawrani2022@gmail.com' OR auth.jwt() ->> 'email' = 'shivam09498@gmail.com');

ALTER PUBLICATION supabase_realtime ADD TABLE public.bills;
CREATE INDEX IF NOT EXISTS idx_bills_restaurant ON public.bills(restaurant_name);
