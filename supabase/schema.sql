-- Auto Audit — Supabase schema for v1.2
-- Run this in the Supabase SQL editor (or via `supabase db push`).
-- Every table is scoped to the owning user via Row Level Security.

-- =============================================================================
-- Helper: updated_at trigger function (used by tables that track edits)
-- =============================================================================
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- =============================================================================
-- Categories
-- =============================================================================
create table if not exists public.categories (
  id          text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  color       text not null,
  icon        text,
  sort_order  int  not null default 0,
  is_default  boolean not null default false,
  is_other    boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists categories_user_id_idx
  on public.categories(user_id, sort_order);

alter table public.categories enable row level security;

create policy "categories_select_own" on public.categories
  for select using (auth.uid() = user_id);
create policy "categories_insert_own" on public.categories
  for insert with check (auth.uid() = user_id);
create policy "categories_update_own" on public.categories
  for update using (auth.uid() = user_id);
create policy "categories_delete_own" on public.categories
  for delete using (auth.uid() = user_id);

-- =============================================================================
-- Transactions
-- =============================================================================
create table if not exists public.transactions (
  id           text primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  amount       numeric(12, 2) not null check (amount >= 0),
  merchant     text not null,
  occurred_on  timestamptz not null,
  category_id  text not null references public.categories(id) on delete restrict,
  note         text,
  created_at   timestamptz not null default now()
);

create index if not exists transactions_user_date_idx
  on public.transactions(user_id, occurred_on desc);
create index if not exists transactions_user_category_idx
  on public.transactions(user_id, category_id);

alter table public.transactions enable row level security;

create policy "transactions_select_own" on public.transactions
  for select using (auth.uid() = user_id);
create policy "transactions_insert_own" on public.transactions
  for insert with check (auth.uid() = user_id);
create policy "transactions_update_own" on public.transactions
  for update using (auth.uid() = user_id);
create policy "transactions_delete_own" on public.transactions
  for delete using (auth.uid() = user_id);

-- =============================================================================
-- Monthly budgets
-- =============================================================================
create table if not exists public.monthly_budgets (
  user_id       uuid not null references auth.users(id) on delete cascade,
  month_key     text not null, -- format: "YYYY-MM"
  total         numeric(12, 2) not null default 0 check (total >= 0),
  per_category  jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (user_id, month_key)
);

create index if not exists monthly_budgets_user_month_idx
  on public.monthly_budgets(user_id, month_key desc);

drop trigger if exists trg_monthly_budgets_updated_at on public.monthly_budgets;
create trigger trg_monthly_budgets_updated_at
  before update on public.monthly_budgets
  for each row execute function public.set_updated_at();

alter table public.monthly_budgets enable row level security;

create policy "monthly_budgets_select_own" on public.monthly_budgets
  for select using (auth.uid() = user_id);
create policy "monthly_budgets_insert_own" on public.monthly_budgets
  for insert with check (auth.uid() = user_id);
create policy "monthly_budgets_update_own" on public.monthly_budgets
  for update using (auth.uid() = user_id);
create policy "monthly_budgets_delete_own" on public.monthly_budgets
  for delete using (auth.uid() = user_id);

-- =============================================================================
-- Savings goals
-- =============================================================================
create table if not exists public.savings_goals (
  id             text primary key,
  user_id        uuid not null references auth.users(id) on delete cascade,
  name           text not null,
  kind           text not null check (kind in ('monthly', 'named')),
  target_amount  numeric(12, 2) not null check (target_amount >= 0),
  saved_amount   numeric(12, 2) not null default 0 check (saved_amount >= 0),
  target_date    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists savings_goals_user_idx
  on public.savings_goals(user_id);

drop trigger if exists trg_savings_goals_updated_at on public.savings_goals;
create trigger trg_savings_goals_updated_at
  before update on public.savings_goals
  for each row execute function public.set_updated_at();

alter table public.savings_goals enable row level security;

create policy "savings_goals_select_own" on public.savings_goals
  for select using (auth.uid() = user_id);
create policy "savings_goals_insert_own" on public.savings_goals
  for insert with check (auth.uid() = user_id);
create policy "savings_goals_update_own" on public.savings_goals
  for update using (auth.uid() = user_id);
create policy "savings_goals_delete_own" on public.savings_goals
  for delete using (auth.uid() = user_id);

-- =============================================================================
-- Merchant memory (auto-categorize on repeat purchases)
-- =============================================================================
create table if not exists public.merchant_memory (
  user_id              uuid not null references auth.users(id) on delete cascade,
  normalized_merchant  text not null,
  display_name         text not null,
  category_id          text not null references public.categories(id) on delete cascade,
  last_seen_at         timestamptz not null default now(),
  primary key (user_id, normalized_merchant)
);

create index if not exists merchant_memory_user_idx
  on public.merchant_memory(user_id);

alter table public.merchant_memory enable row level security;

create policy "merchant_memory_select_own" on public.merchant_memory
  for select using (auth.uid() = user_id);
create policy "merchant_memory_insert_own" on public.merchant_memory
  for insert with check (auth.uid() = user_id);
create policy "merchant_memory_update_own" on public.merchant_memory
  for update using (auth.uid() = user_id);
create policy "merchant_memory_delete_own" on public.merchant_memory
  for delete using (auth.uid() = user_id);

-- =============================================================================
-- User settings
-- =============================================================================
create table if not exists public.user_settings (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  advanced_mode  boolean not null default false,
  theme          text not null default 'system' check (theme in ('system', 'light', 'dark')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

drop trigger if exists trg_user_settings_updated_at on public.user_settings;
create trigger trg_user_settings_updated_at
  before update on public.user_settings
  for each row execute function public.set_updated_at();

alter table public.user_settings enable row level security;

create policy "user_settings_select_own" on public.user_settings
  for select using (auth.uid() = user_id);
create policy "user_settings_insert_own" on public.user_settings
  for insert with check (auth.uid() = user_id);
create policy "user_settings_update_own" on public.user_settings
  for update using (auth.uid() = user_id);
create policy "user_settings_delete_own" on public.user_settings
  for delete using (auth.uid() = user_id);
