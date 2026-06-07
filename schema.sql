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
  sort_order integer not null default 0,   -- 노출 순서(거래 입력 팝업 목록)
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
  sort_order integer not null default 0,   -- 노출 순서(거래 입력 팝업 목록)
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
  summary          text,        -- 개요(짧은 제목, 자동완성 대상)
  description      text,        -- 메모(여러 줄 가능)
  transaction_date date not null default current_date,
  created_at       timestamptz not null default now()
);

create index if not exists idx_transactions_date on public.transactions(transaction_date);
create index if not exists idx_transactions_user on public.transactions(user_id);
create index if not exists idx_cards_user        on public.cards(user_id);
create index if not exists idx_accounts_user     on public.accounts(user_id);

-- ---------------------------------------------------------------------
-- 5. categories : 수입/지출 카테고리 (2-depth, 전역 공유)
--    parent_id 가 null 이면 1-depth(상위), 값이 있으면 2-depth(하위)
--    user_id 가 없다 → 모든 사용자가 공유하며 누구나 관리 가능
-- ---------------------------------------------------------------------
create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  type       text not null check (type in ('income', 'expense')),
  name       text not null,
  parent_id  uuid references public.categories(id) on delete cascade,
  sort_order integer not null default 0,   -- 같은 그룹(상위끼리/한 부모의 하위끼리) 내 노출 순서
  created_at timestamptz not null default now()
);
create index if not exists idx_categories_parent on public.categories(parent_id);

-- 같은 depth(동일 parent + type) 내 이름 중복 방지. 상위가 다르면 같은 이름 허용.
create unique index if not exists uq_categories_top
  on public.categories(type, name) where parent_id is null;
create unique index if not exists uq_categories_child
  on public.categories(parent_id, name) where parent_id is not null;

-- 거래에 카테고리 연결 (상위/하위 어느 쪽이든 지정 가능). 카테고리 삭제 시 null.
alter table public.transactions
  add column if not exists category_id uuid references public.categories(id) on delete set null;
create index if not exists idx_transactions_category on public.transactions(category_id);

-- 노출 순서(거래 입력 팝업 목록) 컬럼. 기본 0 이며, 정렬 보조키(created_at/name)로
-- 안정 정렬되므로 별도 백필은 불필요(관리 화면에서 드래그하면 그 그룹에 순서가 부여됨).
alter table public.accounts   add column if not exists sort_order integer not null default 0;
alter table public.cards      add column if not exists sort_order integer not null default 0;
alter table public.categories add column if not exists sort_order integer not null default 0;

-- 기본 상위 카테고리 시드 (테이블이 비어있을 때만)
insert into public.categories (type, name)
select v.type, v.name from (values
  ('expense','식비'), ('expense','교통'), ('expense','주거'), ('expense','쇼핑'),
  ('expense','의료'), ('expense','여가'), ('expense','교육'), ('expense','기타'),
  ('income','급여'), ('income','용돈'), ('income','이자'), ('income','기타')
) as v(type, name)
where not exists (select 1 from public.categories);

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
alter table public.categories   enable row level security;

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

-- categories : 로그인 사용자면 읽기/쓰기 모두 가능 (전역 공유 + 공동 관리)
drop policy if exists "categories_select" on public.categories;
create policy "categories_select" on public.categories
  for select using (auth.role() = 'authenticated');
drop policy if exists "categories_insert" on public.categories;
create policy "categories_insert" on public.categories
  for insert with check (auth.role() = 'authenticated');
drop policy if exists "categories_update" on public.categories;
create policy "categories_update" on public.categories
  for update using (auth.role() = 'authenticated');
drop policy if exists "categories_delete" on public.categories;
create policy "categories_delete" on public.categories
  for delete using (auth.role() = 'authenticated');

-- =====================================================================
-- 최초 관리자 설정
--   1) Supabase Dashboard > Authentication > Users 에서 관리자 유저 생성
--   2) 생성된 유저의 UUID 를 복사해 아래 <ADMIN_USER_UUID> 자리에 넣고 실행
-- =====================================================================
-- insert into public.profiles (id, name, role)
-- values ('<ADMIN_USER_UUID>', '관리자', 'admin')
-- on conflict (id) do update set role = 'admin', name = excluded.name;
