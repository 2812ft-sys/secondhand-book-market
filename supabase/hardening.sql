-- =====================================================================
-- Hardening — รันหลัง schema.sql และ storage.sql (SQL Editor > New query > Run)
-- รันซ้ำได้ปลอดภัย. ส่วนที่ "ล็อกแอดมินด้วย 2FA" อยู่ท้ายไฟล์ ปิดคอมเมนต์ไว้ — เปิดใช้หลังตั้ง TOTP แล้วเท่านั้น
-- =====================================================================

-- ---------- 1) เข้ารหัสเลขบัญชีธนาคาร (คีย์สุ่มสร้างและเก็บใน Vault ไม่มีใครเห็นค่า) ----------
do $$ begin
  if not exists (select 1 from vault.secrets where name = 'pii_key') then
    perform vault.create_secret(
      replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
      'pii_key', 'PII column encryption key');
  end if;
end $$;

alter table public.seller_bank
  add column if not exists bank_account_enc bytea,
  add column if not exists bank_account_last4 text;
alter table public.seller_bank drop column if exists bank_account_no;

create or replace function public.set_bank_account(p_bank text, p_no text, p_name text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare k text; digits text;
begin
  if auth.uid() is null then raise exception 'unauthenticated'; end if;
  digits := regexp_replace(coalesce(p_no, ''), '\D', '', 'g');
  if char_length(digits) < 8 or char_length(digits) > 20 then raise exception 'invalid_account_no'; end if;
  select decrypted_secret into k from vault.decrypted_secrets where name = 'pii_key';
  insert into public.seller_bank(user_id, bank_name, bank_account_name, bank_account_enc, bank_account_last4)
  values (auth.uid(), left(p_bank, 80), left(p_name, 120), pgp_sym_encrypt(digits, k), right(digits, 4))
  on conflict (user_id) do update set
    bank_name = excluded.bank_name, bank_account_name = excluded.bank_account_name,
    bank_account_enc = excluded.bank_account_enc, bank_account_last4 = excluded.bank_account_last4,
    updated_at = now();
end $$;

create or replace function public.reveal_bank_account(p_user uuid) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare k text; v text;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select decrypted_secret into k from vault.decrypted_secrets where name = 'pii_key';
  select pgp_sym_decrypt(bank_account_enc, k) into v from public.seller_bank where user_id = p_user;
  insert into public.audit_log(actor_id, action, target) values (auth.uid(), 'reveal_bank', p_user::text);
  return v;
end $$;

-- เขียนได้ผ่านฟังก์ชันเท่านั้น; อ่านได้เฉพาะคอลัมน์ที่ไม่ใช่ข้อมูลเข้ารหัส
revoke all on public.seller_bank from anon, authenticated;
grant select (user_id, bank_name, bank_account_name, bank_account_last4, updated_at)
  on public.seller_bank to authenticated;

-- ---------- 2) ออเดอร์: บังคับยอดเงินที่ DB, ลำดับสถานะ, หลักฐาน ----------
alter table public.orders
  add column if not exists pack_photo_paths text[] not null default '{}',
  add column if not exists receipt_photo_path text,
  add column if not exists unboxing_video_path text,
  add column if not exists buyer_confirmed_at timestamptz,
  add column if not exists payment_rank int not null default 0;

alter table public.orders drop constraint if exists chk_tracking_fmt;
alter table public.orders add constraint chk_tracking_fmt
  check (tracking_no = '' or tracking_no ~ '^[A-Z0-9]{8,20}$');
alter table public.orders drop constraint if exists chk_shipped_evidence;
alter table public.orders add constraint chk_shipped_evidence check (
  status not in ('Shipped','Completed & Released')
  or (tracking_no <> '' and cardinality(pack_photo_paths) >= 1 and receipt_photo_path is not null));
alter table public.orders drop constraint if exists chk_dispute_video;
alter table public.orders add constraint chk_dispute_video check (
  status <> 'Disputed - Return Requested' or unboxing_video_path is not null);

create or replace function public.calc_platform_fee(p_price numeric) returns numeric
language sql immutable as $$ select least(30, greatest(5, round(5 + p_price * 0.05)))::numeric(10,2) $$;

create or replace function public.orders_force_amounts() returns trigger language plpgsql as $$
begin
  new.platform_fee  := public.calc_platform_fee(new.book_price);
  new.total_amount  := new.book_price + new.shipping_fee + new.platform_fee;
  new.seller_payout := new.book_price + new.shipping_fee;
  return new;
end $$;
drop trigger if exists trg_orders_amounts on public.orders;
create trigger trg_orders_amounts before insert on public.orders
  for each row execute function public.orders_force_amounts();

create or replace function public.orders_guard() returns trigger language plpgsql as $$
begin
  if new.status is distinct from old.status and (old.status, new.status) not in (
      ('Pending Payment','Paid - Awaiting Shipment'),
      ('Paid - Awaiting Shipment','Shipped'),
      ('Paid - Awaiting Shipment','Cancelled - Refunded'),
      ('Pending Payment','Cancelled - Refunded'),
      ('Shipped','Completed & Released'),
      ('Shipped','Disputed - Return Requested'),
      ('Disputed - Return Requested','Completed & Released'),
      ('Disputed - Return Requested','Returned & Refunded'))
  then raise exception 'illegal_transition: % -> %', old.status, new.status; end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists trg_orders_guard on public.orders;
create trigger trg_orders_guard before update on public.orders
  for each row execute function public.orders_guard();

create or replace function public.orders_block_self_trade() returns trigger language plpgsql as $$
begin
  if (select count(*) from public.orders where buyer_id = new.buyer_id and seller_id = new.seller_id
        and created_at > now() - interval '30 days') >= 3
  then raise exception 'repeat_pair_limit'; end if;
  return new;
end $$;
drop trigger if exists trg_orders_pair on public.orders;
create trigger trg_orders_pair before insert on public.orders
  for each row execute function public.orders_block_self_trade();

-- ---------- 3) audit_log แก้/ลบไม่ได้ ----------
create or replace function public.audit_immutable() returns trigger language plpgsql as $$
begin raise exception 'audit_log_immutable'; end $$;
drop trigger if exists trg_audit_immutable on public.audit_log;
create trigger trg_audit_immutable before update or delete on public.audit_log
  for each row execute function public.audit_immutable();

-- ---------- 4) คิวจอง: เวลาจาก DB + เพดาน 3 คิวต่อคน ----------
create or replace function public.reservations_server_time() returns trigger language plpgsql as $$
begin
  new.created_at := now();
  new.expires_at := case when new.status = 'Active' then now() + interval '24 hours' end;
  return new;
end $$;
drop trigger if exists trg_resv_time on public.reservations;
create trigger trg_resv_time before insert on public.reservations
  for each row execute function public.reservations_server_time();

create or replace function public.cap_active_reservations() returns trigger language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtext(new.buyer_id::text));
  if (select count(*) from public.reservations
      where buyer_id = new.buyer_id and status in ('Active','Waiting')) >= 3
  then raise exception 'queue_cap_reached'; end if;
  return new;
end $$;
drop trigger if exists trg_resv_cap on public.reservations;
create trigger trg_resv_cap before insert on public.reservations
  for each row execute function public.cap_active_reservations();

-- ---------- 5) โควตา API กันบอทเผาเงิน (OCR/SMS/AI) ----------
create table if not exists public.api_usage (
  user_id uuid not null, bucket text not null, window_start timestamptz not null,
  hits int not null default 0, primary key (user_id, bucket, window_start));
alter table public.api_usage enable row level security;

create or replace function public.consume_quota(p_bucket text, p_limit int, p_window interval)
returns boolean language plpgsql security definer set search_path = '' as $$
declare h int;
begin
  if auth.uid() is null then return false; end if;
  insert into public.api_usage as u(user_id, bucket, window_start, hits)
  values (auth.uid(), p_bucket, date_bin(p_window, now(), timestamptz 'epoch'), 1)
  on conflict (user_id, bucket, window_start) do update set hits = u.hits + 1
  returning hits into h;
  return h <= p_limit;
end $$;

-- ---------- 6) สมุดบัญชีแบบเพิ่มอย่างเดียว (เงินเป็นจำนวนเต็มสตางค์) ----------
create table if not exists public.ledger_entries (
  id bigint generated always as identity primary key,
  txn_id uuid not null,
  order_id bigint references public.orders(id),
  account text not null check (account in ('gateway_cash','escrow','seller_payable','platform_revenue','refund_payable')),
  amount_satang bigint not null check (amount_satang <> 0),
  created_at timestamptz not null default now());
alter table public.ledger_entries enable row level security;
revoke all on public.ledger_entries from anon, authenticated;

create or replace function public.ledger_txn_balanced() returns trigger language plpgsql as $$
begin
  if (select sum(amount_satang) from public.ledger_entries where txn_id = new.txn_id) <> 0
  then raise exception 'unbalanced_txn %', new.txn_id; end if;
  return null;
end $$;
drop trigger if exists trg_ledger_balanced on public.ledger_entries;
create constraint trigger trg_ledger_balanced after insert on public.ledger_entries
  deferrable initially deferred for each row execute function public.ledger_txn_balanced();

create or replace function public.ledger_immutable() returns trigger language plpgsql as $$
begin raise exception 'ledger_append_only'; end $$;
drop trigger if exists trg_ledger_ro on public.ledger_entries;
create trigger trg_ledger_ro before update or delete on public.ledger_entries
  for each row execute function public.ledger_immutable();

-- ---------- 7) สิทธิ์ฟังก์ชัน: ปิดทั้งหมดแล้วเปิดเป็นรายตัว ----------
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.is_admin(), public.seller_code(bigint) to anon, authenticated;
grant execute on function public.set_bank_account(text, text, text) to authenticated;
grant execute on function public.reveal_bank_account(uuid) to authenticated;   -- ภายในเช็ก is_admin() อีกชั้น
grant execute on function public.consume_quota(text, int, interval) to authenticated;

-- ---------- 8) Realtime: เผยแพร่เฉพาะตารางสาธารณะ ----------
alter publication supabase_realtime set table public.books;

-- ---------- 9) (เปิดภายหลัง) แอดมินต้องผ่าน 2FA ก่อนใช้สิทธิ์ ----------
-- เปิด TOTP ที่ Authentication > Multi-Factor และลงทะเบียนในบัญชีแอดมินก่อน จึงค่อยรันบล็อกนี้
-- create or replace function public.is_admin() returns boolean language sql stable as $$
--   select coalesce(auth.jwt()->'app_metadata'->>'role','') = 'admin'
--      and coalesce(auth.jwt()->>'aal','') = 'aal2';
-- $$;
