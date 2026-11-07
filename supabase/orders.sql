-- =====================================================================
-- ระบบคำสั่งซื้อจริง (ช่วงทดสอบ: ไม่เก็บเงินจริง — แอดมินกด "ยืนยันชำระ" แทน Gateway)
-- รันหลัง schema.sql + hardening.sql ใน SQL Editor (+ query ใหม่) — รันซ้ำได้
-- หลักการ: ผู้ใช้เขียนตาราง orders ตรงไม่ได้ ทุกการเปลี่ยนสถานะต้องผ่านฟังก์ชันด้านล่าง
-- เมื่อต่อ Gateway จริง: ให้ webhook (service role) เรียก admin_approve_payment แทนแอดมิน
-- =====================================================================

-- ---------- 1) คอลัมน์/ค่าที่เพิ่ม ----------
alter table public.orders
  add column if not exists paid_at timestamptz,
  add column if not exists shipped_at timestamptz,
  add column if not exists payout_paid_at timestamptz,
  add column if not exists admin_note text not null default '';

alter table public.orders drop constraint if exists orders_payout_status_check;
alter table public.orders add constraint orders_payout_status_check check (payout_status in (
  'Waiting Buyer Payment','Holding in Escrow','Frozen - Dispute Pending Admin','Released to Seller',
  'Refunded to Buyer (Seller Pays Return Fee)','Refunded to Buyer (Seller Overdue 48h)',
  'Refunded to Buyer','Cancelled - No Payment'));

-- ---------- 2) Storage: หลักฐาน (ส่วนตัว ไม่เปิดสาธารณะ) ----------
-- โครงสร้างพาธ: {user_id}/{order_id}/{ชื่อไฟล์}  อัปโหลดได้เฉพาะโฟลเดอร์ตัวเอง แก้/ลบไม่ได้
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('order-evidence', 'order-evidence', false, 52428800,
  array['image/jpeg','image/png','image/webp','video/mp4','video/quicktime','video/webm'])
on conflict (id) do update set public = false,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "evidence_insert_own" on storage.objects;
create policy "evidence_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'order-evidence' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "evidence_read_parties" on storage.objects;
create policy "evidence_read_parties" on storage.objects for select to authenticated
  using (bucket_id = 'order-evidence' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin()
    or exists (select 1 from public.orders o
               where o.id::text = (storage.foldername(name))[2]
                 and (o.buyer_id = auth.uid() or o.seller_id = auth.uid()))));

-- ---------- 3) helper ตรวจพาธหลักฐาน ----------
create or replace function public._ev_ok(p_path text, p_uid uuid, p_order bigint)
returns boolean language sql immutable as $$
  select p_path is not null and char_length(p_path) < 220 and p_path !~ '\.\.'
     and p_path like (p_uid::text || '/' || p_order::text || '/%') $$;

-- ---------- 4) ผู้ซื้อสร้างคำสั่งซื้อ (ราคา/ค่าธรรมเนียมคิดจาก DB เท่านั้น) ----------
create or replace function public.place_order(p_book_id bigint, p_name text, p_phone text, p_address text)
returns public.orders language plpgsql security definer set search_path = public as $$
declare b public.books; o public.orders;
begin
  if auth.uid() is null then raise exception 'unauthenticated'; end if;
  if not public.consume_quota('place_order', 10, interval '1 hour') then raise exception 'rate_limited'; end if;
  if char_length(trim(coalesce(p_name,''))) < 2 or char_length(trim(coalesce(p_phone,''))) < 9
     or char_length(trim(coalesce(p_address,''))) < 10 then raise exception 'invalid_recipient'; end if;
  select * into b from public.books where id = p_book_id for update;
  if not found then raise exception 'book_not_found'; end if;
  if b.seller_id = auth.uid() then raise exception 'own_book'; end if;
  if b.stock <= 0 or b.stock_status <> 'Available' then raise exception 'sold_out'; end if;
  insert into public.orders(book_id, buyer_id, seller_id, book_title, book_price, shipping_fee,
      platform_fee, total_amount, seller_payout, recipient_name, recipient_phone, shipping_address)
  values (b.id, auth.uid(), b.seller_id, b.title, b.price, b.shipping_fee, 0, 0, 0,
      left(trim(p_name),120), left(trim(p_phone),20), left(trim(p_address),500))
  returning * into o;
  update public.books set stock = stock - 1,
         stock_status = case when stock - 1 <= 0 then 'Sold Out' else stock_status end
   where id = b.id;
  insert into public.audit_log(actor_id, action, target) values (auth.uid(), 'order_placed', o.order_code);
  return o;
end $$;

-- ---------- 5) แอดมิน: ยืนยันชำระ (ช่วงทดสอบ) / ยกเลิก ----------
create or replace function public.admin_approve_payment(p_order bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  update public.orders set status = 'Paid - Awaiting Shipment', payout_status = 'Holding in Escrow',
         paid_at = now(), shipping_deadline = now() + interval '48 hours'
   where id = p_order and status = 'Pending Payment';
  if not found then raise exception 'bad_status'; end if;
  insert into public.audit_log(actor_id, action, target) values (auth.uid(), 'approve_payment', p_order::text);
end $$;

create or replace function public.admin_cancel_order(p_order bigint, p_note text default '')
returns void language plpgsql security definer set search_path = public as $$
declare o public.orders; late boolean; n int;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select * into o from public.orders where id = p_order for update;
  if not found or o.status not in ('Pending Payment','Paid - Awaiting Shipment') then raise exception 'bad_status'; end if;
  late := o.status = 'Paid - Awaiting Shipment' and o.shipping_deadline is not null and now() > o.shipping_deadline;
  update public.orders set status = 'Cancelled - Refunded',
         payout_status = case when o.status = 'Pending Payment' then 'Cancelled - No Payment'
                              when late then 'Refunded to Buyer (Seller Overdue 48h)' else 'Refunded to Buyer' end,
         strike_recorded = o.strike_recorded or late, admin_note = left(coalesce(p_note,''), 500)
   where id = p_order;
  update public.books set stock = stock + 1, stock_status = 'Available' where id = o.book_id;
  if late and not o.strike_recorded then   -- ส่งล่าช้าเกิน 48 ชม.: ดาวเตือน 1 ดวง, ครบ 3 ระงับสิทธิ์ขาย 6 เดือน
    update public.profiles set strike_count = strike_count + 1,
           seller_banned_until = case when strike_count + 1 >= 3 then now() + interval '6 months' else seller_banned_until end
     where id = o.seller_id;
  end if;
  insert into public.audit_log(actor_id, action, target, detail)
  values (auth.uid(), 'cancel_order', p_order::text, jsonb_build_object('late', late));
end $$;

-- ---------- 6) ผู้ขายส่งของ (ต้องมีรูปก่อนแพ็ก + ใบเสร็จขนส่ง + เลขพัสดุ) ----------
create or replace function public.seller_ship(p_order bigint, p_carrier text, p_tracking text,
                                              p_pack text[], p_receipt text)
returns void language plpgsql security definer set search_path = public as $$
declare o public.orders; t text; pth text;
begin
  select * into o from public.orders where id = p_order for update;
  if not found or o.seller_id <> auth.uid() then raise exception 'forbidden'; end if;
  if o.status <> 'Paid - Awaiting Shipment' then raise exception 'bad_status'; end if;
  t := upper(regexp_replace(coalesce(p_tracking,''), '\s', '', 'g'));
  if t !~ '^[A-Z0-9]{8,20}$' then raise exception 'invalid_tracking'; end if;
  if p_pack is null or cardinality(p_pack) < 1 or cardinality(p_pack) > 5 then raise exception 'need_pack_photo'; end if;
  foreach pth in array p_pack loop
    if not public._ev_ok(pth, auth.uid(), p_order) then raise exception 'bad_path'; end if;
  end loop;
  if not public._ev_ok(p_receipt, auth.uid(), p_order) then raise exception 'bad_path'; end if;
  update public.orders set status = 'Shipped', carrier = left(coalesce(p_carrier,''), 60), tracking_no = t,
         pack_photo_paths = p_pack, receipt_photo_path = p_receipt, shipped_at = now(),
         inspection_expires_at = now() + interval '7 days'
   where id = p_order;
  insert into public.audit_log(actor_id, action, target) values (auth.uid(), 'seller_ship', p_order::text);
end $$;

-- ---------- 7) ผู้ซื้อยืนยันรับของ / แจ้งปัญหา ----------
create or replace function public.buyer_confirm(p_order bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.orders set status = 'Completed & Released', buyer_confirmed_at = now()
   where id = p_order and buyer_id = auth.uid() and status = 'Shipped';
  if not found then raise exception 'bad_status'; end if;
  insert into public.audit_log(actor_id, action, target) values (auth.uid(), 'buyer_confirm', p_order::text);
end $$;

create or replace function public.buyer_dispute(p_order bigint, p_category text, p_reason text, p_video text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if char_length(trim(coalesce(p_reason,''))) < 10 then raise exception 'reason_too_short'; end if;
  if not public._ev_ok(p_video, auth.uid(), p_order) then raise exception 'bad_path'; end if;
  update public.orders set status = 'Disputed - Return Requested', escrow_frozen = true,
         payout_status = 'Frozen - Dispute Pending Admin', dispute_category = left(coalesce(p_category,''), 60),
         dispute_reason = left(trim(p_reason), 1000), unboxing_video_path = p_video
   where id = p_order and buyer_id = auth.uid() and status = 'Shipped';
  if not found then raise exception 'bad_status'; end if;
  insert into public.audit_log(actor_id, action, target) values (auth.uid(), 'buyer_dispute', p_order::text);
end $$;

-- ---------- 8) แอดมิน: ตัดสินข้อพิพาท / ปล่อยออเดอร์ที่ผู้ซื้อไม่ยืนยัน / บันทึกโอนให้ผู้ขายแล้ว ----------
create or replace function public.admin_resolve_dispute(p_order bigint, p_refund boolean, p_note text default '')
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_refund then
    update public.orders set status = 'Returned & Refunded', escrow_frozen = false,
           payout_status = 'Refunded to Buyer (Seller Pays Return Fee)', admin_note = left(coalesce(p_note,''), 500)
     where id = p_order and status = 'Disputed - Return Requested';
  else
    update public.orders set status = 'Completed & Released', escrow_frozen = false,
           payout_status = 'Holding in Escrow', admin_note = left(coalesce(p_note,''), 500)
     where id = p_order and status = 'Disputed - Return Requested';
  end if;
  if not found then raise exception 'bad_status'; end if;
  insert into public.audit_log(actor_id, action, target, detail)
  values (auth.uid(), 'resolve_dispute', p_order::text, jsonb_build_object('refund', p_refund));
end $$;

create or replace function public.admin_release_unconfirmed()
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  update public.orders set status = 'Completed & Released'
   where status = 'Shipped' and inspection_expires_at is not null and inspection_expires_at < now();
  get diagnostics n = row_count;
  insert into public.audit_log(actor_id, action, target, detail)
  values (auth.uid(), 'release_unconfirmed', '', jsonb_build_object('count', n));
  return n;
end $$;

create or replace function public.admin_mark_paid_out(p_ids bigint[])
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  update public.orders set payout_status = 'Released to Seller', payout_paid_at = now()
   where id = any(p_ids) and status = 'Completed & Released' and payout_status = 'Holding in Escrow';
  get diagnostics n = row_count;
  insert into public.audit_log(actor_id, action, target, detail)
  values (auth.uid(), 'mark_paid_out', '', jsonb_build_object('ids', p_ids, 'count', n));
  return n;
end $$;

-- ---------- 9) สิทธิ์เรียกใช้ฟังก์ชัน ----------
revoke all on function public._ev_ok(text, uuid, bigint) from public, anon, authenticated;
revoke all on function
  public.place_order(bigint, text, text, text), public.admin_approve_payment(bigint),
  public.admin_cancel_order(bigint, text), public.seller_ship(bigint, text, text, text[], text),
  public.buyer_confirm(bigint), public.buyer_dispute(bigint, text, text, text),
  public.admin_resolve_dispute(bigint, boolean, text), public.admin_release_unconfirmed(),
  public.admin_mark_paid_out(bigint[])
  from public, anon;
grant execute on function
  public.place_order(bigint, text, text, text), public.admin_approve_payment(bigint),
  public.admin_cancel_order(bigint, text), public.seller_ship(bigint, text, text, text[], text),
  public.buyer_confirm(bigint), public.buyer_dispute(bigint, text, text, text),
  public.admin_resolve_dispute(bigint, boolean, text), public.admin_release_unconfirmed(),
  public.admin_mark_paid_out(bigint[])
  to authenticated;
