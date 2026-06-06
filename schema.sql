-- =====================================================================
-- 공유 가계부 (budget-app) - Supabase Schema + RLS
-- Supabase Dashboard > SQL Editor 에서 실행하세요.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- 1. profiles : auth.users 와 1:1 매핑
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  name       text not null,
  role       text not null default 'member' check (role in ('admin', 'member')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. accounts : 계좌
-- ---------------------------------------------------------------------
create table if not exists public.accounts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  name       text not null,
  bank_name  text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3. cards : 카드
-- ---------------------------------------------------------------------
create table if not exists public.cards (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete set null,
  name       text not null,
  card_type  text not null default 'credit' check (card_type in ('credit', 'debit')),
  issuer     text,
  benefits   text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 4. transactions : 거래 내역
-- ---------------------------------------------------------------------
create table if not exists public.transactions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles(id) on delete cascade,
  account_id       uuid references public.accounts(id) on delete set null,
  card_id          uuid references public.cards(id) on delete set null,
  type             text not null check (type in ('income', 'expense')),
  amount           integer not null check (amount >= 0),
  category         text,
  description      text,
  transaction_date date not null default current_date,
  created_at       timestamptz not null default now()
);

create index if not exists idx_transactions_date on public.transactions(transaction_date);
create index if not exists idx_transactions_user on public.transactions(user_id);
create index if not exists idx_cards_user        on public.cards(user_id);
create index if not exists idx_accounts_user     on public.accounts(user_id);

-- =====================================================================
-- 역할별 테이블 권한 (GRANT)
--   RLS 와 별개로 PostgreSQL 테이블 권한이 필요하다.
--   - service_role : RLS 우회 + 전체 권한 (백엔드 관리 작업용)
--   - authenticated: 전체 CRUD 권한이 있으나 실제 접근은 아래 RLS 정책이 통제
--   - anon         : 접근 불필요(로그인은 Auth API 경유)하나 관례상 schema usage 만 부여
-- =====================================================================
grant usage on schema public to anon, authenticated, service_role;

grant all privileges on all tables    in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- 이후 새로 생기는 객체에도 동일 권한이 자동 적용되도록 기본 권한 설정
alter default privileges in schema public
  grant all on tables to service_role;
alter default privileges in schema public
  grant all on sequences to service_role;
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.profiles     enable row level security;
alter table public.accounts     enable row level security;
alter table public.cards        enable row level security;
alter table public.transactions enable row level security;

-- ---- helper : 현재 사용자가 admin 인지 확인 -------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------
-- profiles : 로그인 사용자면 전체 읽기 / 수정은 본인(또는 admin)만
-- ---------------------------------------------------------------------
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select using (auth.role() = 'authenticated');

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles
  for update using (auth.uid() = id or public.is_admin());

drop policy if exists "profiles_insert_admin" on public.profiles;
create policy "profiles_insert_admin" on public.profiles
  for insert with check (auth.uid() = id or public.is_admin());

drop policy if exists "profiles_delete_admin" on public.profiles;
create policy "profiles_delete_admin" on public.profiles
  for delete using (public.is_admin());

-- ---------------------------------------------------------------------
-- accounts / cards / transactions
--   읽기: 로그인 사용자 전체 (가계부 공유)
--   쓰기: 본인 데이터만
-- ---------------------------------------------------------------------
-- accounts
drop policy if exists "accounts_select" on public.accounts;
create policy "accounts_select" on public.accounts
  for select using (auth.role() = 'authenticated');
drop policy if exists "accounts_insert" on public.accounts;
create policy "accounts_insert" on public.accounts
  for insert with check (auth.uid() = user_id);
drop policy if exists "accounts_update" on public.accounts;
create policy "accounts_update" on public.accounts
  for update using (auth.uid() = user_id);
drop policy if exists "accounts_delete" on public.accounts;
create policy "accounts_delete" on public.accounts
  for delete using (auth.uid() = user_id);

-- cards
drop policy if exists "cards_select" on public.cards;
create policy "cards_select" on public.cards
  for select using (auth.role() = 'authenticated');
drop policy if exists "cards_insert" on public.cards;
create policy "cards_insert" on public.cards
  for insert with check (auth.uid() = user_id);
drop policy if exists "cards_update" on public.cards;
create policy "cards_update" on public.cards
  for update using (auth.uid() = user_id);
drop policy if exists "cards_delete" on public.cards;
create policy "cards_delete" on public.cards
  for delete using (auth.uid() = user_id);

-- transactions
drop policy if exists "transactions_select" on public.transactions;
create policy "transactions_select" on public.transactions
  for select using (auth.role() = 'authenticated');
drop policy if exists "transactions_insert" on public.transactions;
create policy "transactions_insert" on public.transactions
  for insert with check (auth.uid() = user_id);
drop policy if exists "transactions_update" on public.transactions;
create policy "transactions_update" on public.transactions
  for update using (auth.uid() = user_id);
drop policy if exists "transactions_delete" on public.transactions;
create policy "transactions_delete" on public.transactions
  for delete using (auth.uid() = user_id);

-- =====================================================================
-- 최초 관리자 설정
--   1) Supabase Dashboard > Authentication > Users 에서 관리자 유저 생성
--   2) 생성된 유저의 UUID 를 복사해 아래 <ADMIN_USER_UUID> 자리에 넣고 실행
-- =====================================================================
-- insert into public.profiles (id, name, role)
-- values ('<ADMIN_USER_UUID>', '관리자', 'admin')
-- on conflict (id) do update set role = 'admin', name = excluded.name;
