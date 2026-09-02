-- Run this once in the Supabase SQL editor (Project -> SQL Editor -> New query)

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  email text not null,
  token text not null unique,
  redeemed boolean not null default false,
  redeemed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists leads_token_idx on leads (token);

-- Prevent the same person registering twice. Case-insensitive on email.
create unique index if not exists leads_email_unique_idx on leads (lower(email));
create unique index if not exists leads_phone_unique_idx on leads (phone);

alter table leads enable row level security;

drop policy if exists "public can submit a lead" on leads;
drop policy if exists "staff can read leads" on leads;
drop policy if exists "staff can redeem leads" on leads;

-- Public visitors (anon key) may only INSERT a new lead. They can never
-- read the leads table, so tokens and other participants' info stay private.
create policy "public can submit a lead"
  on leads for insert
  to anon
  with check (true);

-- Only logged-in staff (authenticated users) can look up a token and
-- confirm/redeem it at the booth.
create policy "staff can read leads"
  on leads for select
  to authenticated
  using (true);

create policy "staff can redeem leads"
  on leads for update
  to authenticated
  using (true)
  with check (true);
