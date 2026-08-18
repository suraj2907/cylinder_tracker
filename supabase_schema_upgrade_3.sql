-- ==========================================================
-- CYLINDER TRACKER - PERMISSIVE RLS POLICIES FOR CORE TABLES
-- ==========================================================

-- 1. Permissive policy for 'batches'
DROP POLICY IF EXISTS "Secure partner access - batches" ON public.batches;
CREATE POLICY "Secure partner access - batches" ON public.batches
    TO authenticated USING (true) WITH CHECK (true);

-- 2. Permissive policy for 'entries'
DROP POLICY IF EXISTS "Secure partner access - entries" ON public.entries;
CREATE POLICY "Secure partner access - entries" ON public.entries
    TO authenticated USING (true) WITH CHECK (true);

-- 3. Permissive policy for 'payments'
DROP POLICY IF EXISTS "Secure partner access - payments" ON public.payments;
CREATE POLICY "Secure partner access - payments" ON public.payments
    TO authenticated USING (true) WITH CHECK (true);

-- 4. Permissive policy for 'restaurants'
DROP POLICY IF EXISTS "Secure partner access - restaurants" ON public.restaurants;
CREATE POLICY "Secure partner access - restaurants" ON public.restaurants
    TO authenticated USING (true) WITH CHECK (true);

-- 5. Permissive policy for 'bills'
DROP POLICY IF EXISTS "Secure partner access - bills" ON public.bills;
CREATE POLICY "Secure partner access - bills" ON public.bills
    TO authenticated USING (true) WITH CHECK (true);
