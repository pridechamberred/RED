-- Optional business category chosen from the list in lib/business-categories.ts.
-- The app validates the exact value; the database only caps the length.
alter table public.members
  add column if not exists business_category text
  check (business_category is null or char_length(business_category) <= 80);
