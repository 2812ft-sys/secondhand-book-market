-- =====================================================================
-- Onboarding: ที่อยู่จัดส่ง + หมวดหมู่ที่ชอบ (ข้อมูลส่วนตัว เห็น/แก้ได้เฉพาะเจ้าของ)
-- รันใน SQL Editor (new query) — รันซ้ำได้
-- ไม่ใส่ใน profiles เพราะ profiles ใครก็อ่านได้ (ใช้โชว์ชื่อผู้ขาย)
-- =====================================================================
create table if not exists public.user_private (
  user_id uuid primary key references auth.users(id) on delete cascade,
  ship_name text not null default '' check (char_length(ship_name) <= 120),
  ship_phone text not null default '' check (char_length(ship_phone) <= 20),
  ship_address text not null default '' check (char_length(ship_address) <= 400),
  ship_province text not null default '' check (char_length(ship_province) <= 60),
  ship_postcode text not null default '' check (ship_postcode ~ '^[0-9]{0,5}$'),
  fav_categories text[] not null default '{}' check (cardinality(fav_categories) <= 5),
  onboarded boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.user_private enable row level security;

drop policy if exists user_private_own on public.user_private;
create policy user_private_own on public.user_private for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on public.user_private from anon;
grant select, insert, update on public.user_private to authenticated;
