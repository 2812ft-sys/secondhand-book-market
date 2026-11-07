-- แยกที่อยู่เป็น ตำบล/อำเภอ (ใช้ร่วมกันใน onboarding และ checkout) — รันซ้ำได้
alter table public.user_private
  add column if not exists ship_subdistrict text not null default '' check (char_length(ship_subdistrict) <= 60),
  add column if not exists ship_district text not null default '' check (char_length(ship_district) <= 60);
