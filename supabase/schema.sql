-- =====================================================================
-- Schema สำหรับ Supabase (PostgreSQL) — ตลาดหนังสือมือสอง + Escrow
-- วิธีใช้: Supabase Dashboard > SQL Editor > New query > วางทั้งไฟล์ > Run
-- รันซ้ำได้ปลอดภัย (idempotent) ยกเว้นส่วน seed ที่ไม่มี
-- หลักการ: ทุกตารางเปิด RLS, ผู้ใช้ทั่วไปแก้ข้อมูลเงิน/สถานะ/ดาวเตือนเองไม่ได้
-- สิทธิ์แอดมิน = app_metadata.role = 'admin' (ผู้ใช้แก้เองไม่ได้ ต่างจาก user_metadata)
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- helper: เป็นแอดมินหรือไม่ ----------
create or replace function public.is_admin()
returns boolean language sql stable as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin';
$$;

-- ---------- 1) profiles (ข้อมูลสาธารณะของสมาชิก) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  seller_no bigint generated always as identity unique,
  username text not null check (char_length(username) between 2 and 60),
  phone_number text not null default '',
  strike_count int not null default 0,
  strike_month text not null default '',
  seller_banned_until timestamptz,
  created_at timestamptz not null default now()
);

-- รหัสผู้ขาย SLR-0001 (คำนวณจาก seller_no ทุกคนมีแน่นอน)
create or replace function public.seller_code(n bigint)
returns text language sql immutable as $$
  select 'SLR-' || lpad(n::text, 4, '0');
$$;

-- สร้างโปรไฟล์อัตโนมัติเมื่อสมัครสมาชิก
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, phone_number)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'username', ''), split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'phone_number', '')
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- 2) seller_bank (ข้อมูลบัญชีธนาคาร: ส่วนตัว เห็นเฉพาะเจ้าของ) ----------
-- หมายเหตุ: ก่อนใช้งานจริงควรเข้ารหัสเลขบัญชี (pgcrypto/Vault) ตามแผน PDPA
create table if not exists public.seller_bank (
  user_id uuid primary key references auth.users(id) on delete cascade,
  bank_name text not null default '',
  bank_account_no text not null default '',
  bank_account_name text not null default '',
  updated_at timestamptz not null default now()
);

-- ---------- 3) books ----------
create table if not exists public.books (
  id bigint generated always as identity primary key,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  code text not null unique default ('BK-' || upper(substr(gen_random_uuid()::text, 1, 8))),
  title text not null,
  en_title text not null default '',
  author text not null default '',
  translator text not null default '-',
  publisher text not null default '',
  category text not null,
  category_name text not null default '',
  original_price numeric(10,2) not null check (original_price >= 0),
  price numeric(10,2) not null check (price >= 0),
  shipping_fee numeric(10,2) not null default 40 check (shipping_fee >= 0),
  packing_note text not null default 'ผู้ขายแพ็กจัดส่งตามมาตรฐานของผู้ขาย',
  condition_percent int not null check (condition_percent between 0 and 100),
  condition_grade text not null default '',
  condition_note text not null default '',          -- เช่น 'water' = มีรอยน้ำจางๆ
  defect_details text not null default '',
  images jsonb not null default '[]'::jsonb,
  stock_status text not null default 'Available' check (stock_status in ('Available','Reserved','Sold Out')),
  stock int not null default 1 check (stock >= 0),
  is_new_arrival boolean not null default false,
  pages int,
  publish_year int,
  isbn text default '',
  synopsis text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists idx_books_category on public.books(category);
create index if not exists idx_books_status on public.books(stock_status);
create index if not exists idx_books_seller on public.books(seller_id);

-- ---------- 4) reservations ----------
create table if not exists public.reservations (
  id bigint generated always as identity primary key,
  book_id bigint not null references public.books(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  queue_no int not null,
  status text not null check (status in ('Waiting','Active','Expired','Completed')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique (book_id, buyer_id),
  unique (book_id, queue_no),
  check (buyer_id <> seller_id)           -- ห้ามจองหนังสือตัวเอง
);

-- ---------- 5) orders (เงินและสถานะ: ฝั่งผู้ใช้อ่านได้อย่างเดียว) ----------
create sequence if not exists public.order_code_seq start 1;

create table if not exists public.orders (
  id bigint generated always as identity primary key,
  order_code text not null unique
    default ('ESC-' || lpad(nextval('public.order_code_seq')::text, 6, '0')),
  book_id bigint not null references public.books(id),
  reservation_id bigint references public.reservations(id),
  buyer_id uuid not null references public.profiles(id),
  seller_id uuid not null references public.profiles(id),
  book_title text not null,
  book_price numeric(10,2) not null,
  shipping_fee numeric(10,2) not null,
  platform_fee numeric(10,2) not null,
  total_amount numeric(10,2) not null,
  seller_payout numeric(10,2) not null,
  status text not null default 'Pending Payment' check (status in (
    'Pending Payment','Paid - Awaiting Shipment','Shipped','Completed & Released',
    'Disputed - Return Requested','Returned & Refunded','Cancelled - Refunded')),
  payout_status text not null default 'Waiting Buyer Payment' check (payout_status in (
    'Waiting Buyer Payment','Holding in Escrow','Frozen - Dispute Pending Admin','Released to Seller',
    'Refunded to Buyer (Seller Pays Return Fee)','Refunded to Buyer (Seller Overdue 48h)')),
  slip_reference text not null default '',
  tracking_no text not null default '',
  carrier text not null default '',
  shipping_deadline timestamptz,
  inspection_expires_at timestamptz,
  dispute_category text not null default '',
  dispute_reason text not null default '',
  dispute_evidence text not null default '',
  escrow_frozen boolean not null default false,
  strike_recorded boolean not null default false,
  recipient_name text not null,
  recipient_phone text not null,
  shipping_address text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (buyer_id <> seller_id),                                  -- กัน wash trading ขั้นพื้นฐาน
  check (total_amount = book_price + shipping_fee + platform_fee),
  check (seller_payout = book_price + shipping_fee)
);
create index if not exists idx_orders_buyer on public.orders(buyer_id);
create index if not exists idx_orders_seller on public.orders(seller_id);
-- เลขพัสดุห้ามซ้ำข้ามออเดอร์ (กันใช้เลขเดิมหลอก)
create unique index if not exists uq_orders_tracking
  on public.orders(carrier, tracking_no) where tracking_no <> '';

-- ---------- 6) reviews ----------
create table if not exists public.reviews (
  id bigint generated always as identity primary key,
  order_id bigint unique references public.orders(id),
  book_id bigint not null references public.books(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text not null default '',
  created_at timestamptz not null default now()
);

-- ---------- 7) audit_log (บันทึกการกระทำของแอดมิน ห้ามแก้/ลบ) ----------
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  target text not null default '',
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.profiles     enable row level security;
alter table public.seller_bank  enable row level security;
alter table public.books        enable row level security;
alter table public.reservations enable row level security;
alter table public.orders       enable row level security;
alter table public.reviews      enable row level security;
alter table public.audit_log    enable row level security;

-- profiles: ใครก็ดูชื่อผู้ขาย/รหัสผู้ขายได้, แก้ได้เฉพาะของตัวเอง (เฉพาะคอลัมน์ที่อนุญาต)
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select using (true);
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- seller_bank: เจ้าของเท่านั้น (แอดมินดูได้ตอนต้องโอนเงิน)
drop policy if exists bank_owner on public.seller_bank;
create policy bank_owner on public.seller_bank for all
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid());

-- books: ทุกคนอ่านได้, ผู้ขายจัดการของตัวเอง, ผู้ถูกแบนลงขายไม่ได้
drop policy if exists books_read on public.books;
create policy books_read on public.books for select using (true);
drop policy if exists books_insert_own on public.books;
create policy books_insert_own on public.books for insert to authenticated
  with check (
    seller_id = auth.uid()
    and not exists (select 1 from public.profiles p
                    where p.id = auth.uid() and p.seller_banned_until > now())
  );
drop policy if exists books_update_own on public.books;
create policy books_update_own on public.books for update to authenticated
  using (seller_id = auth.uid()) with check (seller_id = auth.uid());
drop policy if exists books_delete_own on public.books;
create policy books_delete_own on public.books for delete to authenticated
  using (seller_id = auth.uid() or public.is_admin());

-- reservations: เห็นเฉพาะผู้ซื้อ/ผู้ขาย/แอดมิน; ผู้ซื้อสร้างของตัวเองได้
drop policy if exists resv_read on public.reservations;
create policy resv_read on public.reservations for select to authenticated
  using (buyer_id = auth.uid() or seller_id = auth.uid() or public.is_admin());
drop policy if exists resv_insert on public.reservations;
create policy resv_insert on public.reservations for insert to authenticated
  with check (buyer_id = auth.uid());

-- orders: อ่านได้เฉพาะคู่ค้า+แอดมิน; "ไม่มี policy insert/update/delete" = ฝั่งหน้าเว็บเขียนตรงไม่ได้
-- การสร้าง/เปลี่ยนสถานะ/ปล่อยเงินจะทำผ่านฟังก์ชัน security definer / Netlify Function ในขั้นถัดไป
drop policy if exists orders_read on public.orders;
create policy orders_read on public.orders for select to authenticated
  using (buyer_id = auth.uid() or seller_id = auth.uid() or public.is_admin());

-- reviews: ทุกคนอ่านได้; รีวิวได้เฉพาะผู้ซื้อของออเดอร์ที่จบแล้ว
drop policy if exists reviews_read on public.reviews;
create policy reviews_read on public.reviews for select using (true);
drop policy if exists reviews_insert on public.reviews;
create policy reviews_insert on public.reviews for insert to authenticated
  with check (
    buyer_id = auth.uid()
    and exists (select 1 from public.orders o
                where o.id = order_id and o.buyer_id = auth.uid()
                  and o.status = 'Completed & Released')
  );

-- audit_log: แอดมินอ่านได้อย่างเดียว (เขียนผ่านฟังก์ชัน/trigger เท่านั้น)
drop policy if exists audit_admin_read on public.audit_log;
create policy audit_admin_read on public.audit_log for select to authenticated
  using (public.is_admin());

-- =====================================================================
-- สิทธิ์ระดับคอลัมน์: กันผู้ใช้แก้ดาวเตือน/สถานะแบนของตัวเอง
-- =====================================================================
revoke update on public.profiles from authenticated, anon;
grant  update (username, phone_number) on public.profiles to authenticated;

revoke insert, update, delete on public.orders from authenticated, anon;
revoke insert, update, delete on public.audit_log from authenticated, anon;

-- ผู้ขายเปลี่ยน seller_id ของหนังสือไม่ได้
revoke update on public.books from authenticated;
grant  update (title, en_title, author, translator, publisher, category, category_name,
               original_price, price, shipping_fee, packing_note, condition_percent,
               condition_grade, condition_note, defect_details, images, stock_status,
               stock, pages, publish_year, isbn, synopsis)
  on public.books to authenticated;
