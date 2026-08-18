-- 1. Bajrang Tadka -> Bajrang Tadka Point
UPDATE public.restaurants SET name = 'Bajrang Tadka Point' WHERE name = 'Bajrang Tadka';
UPDATE public.entries SET name = 'Bajrang Tadka Point' WHERE name = 'Bajrang Tadka';
UPDATE public.payments SET restaurant_name = 'Bajrang Tadka Point' WHERE restaurant_name = 'Bajrang Tadka';
UPDATE public.bills SET restaurant_name = 'Bajrang Tadka Point' WHERE restaurant_name = 'Bajrang Tadka';

-- 2. Simran Restaurant -> Simran Sweets
UPDATE public.restaurants SET name = 'Simran Sweets' WHERE name = 'Simran Restaurant';
UPDATE public.entries SET name = 'Simran Sweets' WHERE name = 'Simran Restaurant';
UPDATE public.payments SET restaurant_name = 'Simran Sweets' WHERE restaurant_name = 'Simran Restaurant';
UPDATE public.bills SET restaurant_name = 'Simran Sweets' WHERE restaurant_name = 'Simran Restaurant';

-- 3. Karnail Singh Bhatia -> Jasbeer Kaur Bhatia
UPDATE public.restaurants SET name = 'Jasbeer Kaur Bhatia' WHERE name = 'Karnail Singh Bhatia';
UPDATE public.entries SET name = 'Jasbeer Kaur Bhatia' WHERE name = 'Karnail Singh Bhatia';
UPDATE public.payments SET restaurant_name = 'Jasbeer Kaur Bhatia' WHERE restaurant_name = 'Karnail Singh Bhatia';
UPDATE public.bills SET restaurant_name = 'Jasbeer Kaur Bhatia' WHERE restaurant_name = 'Karnail Singh Bhatia';

-- 4. Grandvista Ventures -> GRANDVISTA VENTURES PRIVATE LIMITED
UPDATE public.restaurants SET name = 'GRANDVISTA VENTURES PRIVATE LIMITED' WHERE name = 'Grandvista Ventures';
UPDATE public.entries SET name = 'GRANDVISTA VENTURES PRIVATE LIMITED' WHERE name = 'Grandvista Ventures';
UPDATE public.payments SET restaurant_name = 'GRANDVISTA VENTURES PRIVATE LIMITED' WHERE restaurant_name = 'Grandvista Ventures';
UPDATE public.bills SET restaurant_name = 'GRANDVISTA VENTURES PRIVATE LIMITED' WHERE restaurant_name = 'Grandvista Ventures';

-- 5. Shri Gurudev Agro -> SHRI GURUDEV AGRO INDIA PRIVATE LIMITED
UPDATE public.restaurants SET name = 'SHRI GURUDEV AGRO INDIA PRIVATE LIMITED' WHERE name = 'Shri Gurudev Agro';
UPDATE public.entries SET name = 'SHRI GURUDEV AGRO INDIA PRIVATE LIMITED' WHERE name = 'Shri Gurudev Agro';
UPDATE public.payments SET restaurant_name = 'SHRI GURUDEV AGRO INDIA PRIVATE LIMITED' WHERE restaurant_name = 'Shri Gurudev Agro';
UPDATE public.bills SET restaurant_name = 'SHRI GURUDEV AGRO INDIA PRIVATE LIMITED' WHERE restaurant_name = 'Shri Gurudev Agro';

-- Cleanup any duplicates created during previous import runs
DELETE FROM public.restaurants WHERE name IN ('Grandvista Ventures', 'Shri Gurudev Agro', 'Simran Restaurant', 'Karnail Singh Bhatia', 'Bajrang Tadka');
