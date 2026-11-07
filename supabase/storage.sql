-- =====================================================================
-- Storage สำหรับรูปหนังสือ — รันหลัง schema.sql (SQL Editor > New query > Run)
-- รูปเปิดดูได้สาธารณะ, อัปโหลด/ลบได้เฉพาะในโฟลเดอร์ของตัวเอง (ชื่อโฟลเดอร์ = user id)
-- จำกัดชนิดไฟล์และขนาด (กันอัปโหลดไฟล์อันตราย/ไฟล์ใหญ่เกิน)
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('book-images', 'book-images', true, 3145728, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "book_images_public_read" on storage.objects;
create policy "book_images_public_read" on storage.objects
  for select using (bucket_id = 'book-images');

drop policy if exists "book_images_upload_own_folder" on storage.objects;
create policy "book_images_upload_own_folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'book-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "book_images_delete_own" on storage.objects;
create policy "book_images_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'book-images' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
