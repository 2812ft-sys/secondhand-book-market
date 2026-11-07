-- =====================================================================
-- รองรับสมัคร/เข้าสู่ระบบด้วย Google: ใช้ชื่อจากบัญชี Google เป็นชื่อผู้ใช้
-- รันใน SQL Editor (รันซ้ำได้) — แก้เฉพาะฟังก์ชัน handle_new_user
-- =====================================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare n text;
begin
  n := left(coalesce(
         nullif(new.raw_user_meta_data ->> 'username', ''),
         nullif(new.raw_user_meta_data ->> 'full_name', ''),
         nullif(new.raw_user_meta_data ->> 'name', ''),
         split_part(new.email, '@', 1)), 60);
  if char_length(n) < 2 then n := n || '_'; end if;
  insert into public.profiles (id, username, phone_number)
  values (new.id, n, coalesce(new.raw_user_meta_data ->> 'phone_number', ''));
  return new;
end $$;
