-- ============================================================
-- บอร์ดงานแผนกบุคคลและสวัสดิการ — Supabase schema
-- โปรเจกต์: uhefxwccuqagnbrbidbh
-- วิธีใช้: วางทั้งไฟล์นี้ใน Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- ---------- extensions ----------
create extension if not exists "pgcrypto";

-- ---------- staff (เจ้าหน้าที่ในแผนก) ----------
create table if not exists public.staff (
  id           uuid primary key references auth.users(id) on delete cascade,
  full_name    text not null,
  nickname     text not null,               -- เนย / จ๋อม / บีบี / ปันปัน / จ๊อบ
  role         text not null default 'member' check (role in ('head','member')),
  scope        text not null default '',     -- ขอบเขตงานที่รับผิดชอบ แสดงใต้ชื่อในบอร์ด
  avatar_color text not null default '#c65d82',
  avatar_url   text,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);

alter table public.staff enable row level security;

drop policy if exists "staff_select_all" on public.staff;
create policy "staff_select_all"
  on public.staff for select
  to public
  using (auth.role() = 'authenticated');

drop policy if exists "staff_update_self" on public.staff;
create policy "staff_update_self"
  on public.staff for update
  to public
  using (auth.role() = 'authenticated' and id = auth.uid())
  with check (id = auth.uid());

-- ---------- tasks (งานในบอร์ด) ----------
create table if not exists public.tasks (
  id           uuid primary key default gen_random_uuid(),
  assigned_to  uuid not null references public.staff(id) on delete cascade,
  created_by   uuid references public.staff(id) on delete set null,
  title        text not null,
  category     text not null default '',    -- เช่น เงินเดือน / ประกันสังคม / บรรจุ / เครื่องแต่งกาย
  status       text not null default 'todo' check (status in ('doing','todo','done')),
  due_date     date,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists tasks_assigned_to_idx on public.tasks(assigned_to);
create index if not exists tasks_status_idx on public.tasks(status);

alter table public.tasks enable row level security;

-- ทุกคนในแผนกเห็นงานทั้งหมด (จ๊อบดูภาพรวม, ทีมเห็นงานกันเองเพื่อความโปร่งใส)
drop policy if exists "tasks_select_all" on public.tasks;
create policy "tasks_select_all"
  on public.tasks for select
  to public
  using (auth.role() = 'authenticated');

-- เพิ่มงานได้: เจ้าของงานเอง หรือหัวหน้าแผนกมอบหมายให้ใครก็ได้
drop policy if exists "tasks_insert" on public.tasks;
create policy "tasks_insert"
  on public.tasks for insert
  to public
  with check (
    auth.role() = 'authenticated'
    and (
      assigned_to = auth.uid()
      or exists (select 1 from public.staff s where s.id = auth.uid() and s.role = 'head')
    )
  );

-- แก้ไข/เปลี่ยนสถานะได้: เจ้าของงาน หรือหัวหน้าแผนก
drop policy if exists "tasks_update" on public.tasks;
create policy "tasks_update"
  on public.tasks for update
  to public
  using (
    auth.role() = 'authenticated'
    and (
      assigned_to = auth.uid()
      or exists (select 1 from public.staff s where s.id = auth.uid() and s.role = 'head')
    )
  );

-- ลบได้: เจ้าของงาน หรือหัวหน้าแผนก
drop policy if exists "tasks_delete" on public.tasks;
create policy "tasks_delete"
  on public.tasks for delete
  to public
  using (
    auth.role() = 'authenticated'
    and (
      assigned_to = auth.uid()
      or exists (select 1 from public.staff s where s.id = auth.uid() and s.role = 'head')
    )
  );

-- อัปเดต updated_at / completed_at อัตโนมัติ
create or replace function public.tasks_set_timestamps()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if new.status = 'done' and (old.status is distinct from 'done') then
    new.completed_at := now();
  elsif new.status <> 'done' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_set_timestamps_trg on public.tasks;
create trigger tasks_set_timestamps_trg
  before update on public.tasks
  for each row execute function public.tasks_set_timestamps();

-- ---------- drive_files (แคชรายการไฟล์ล่าสุดจาก Google Drive กลาง) ----------
-- แถวในตารางนี้ถูกเขียนโดย /api/drive-upload.js (service role) เพื่อให้หน้าเว็บ
-- แสดงประวัติ/ผู้อัปโหลดได้เร็วโดยไม่ต้องเรียก Drive API ทุกครั้งที่โหลดหน้า
create table if not exists public.drive_files (
  id            uuid primary key default gen_random_uuid(),
  drive_file_id text not null unique,
  file_name     text not null,
  mime_type     text,
  size_bytes    bigint,
  web_view_link text,
  uploaded_by   uuid references public.staff(id) on delete set null,
  uploaded_at   timestamptz not null default now()
);

alter table public.drive_files enable row level security;

drop policy if exists "drive_files_select_all" on public.drive_files;
create policy "drive_files_select_all"
  on public.drive_files for select
  to public
  using (auth.role() = 'authenticated');

-- การ insert ทำผ่าน service role key ใน /api/drive-upload.js เท่านั้น (ไม่เปิด insert policy ให้ client)

-- ---------- storage bucket: avatar รูปโปรไฟล์วงกลม ----------
insert into storage.buckets (id, name, public)
values ('staff-avatars', 'staff-avatars', true)
on conflict (id) do nothing;

drop policy if exists "staff_avatars_public_read" on storage.objects;
create policy "staff_avatars_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'staff-avatars');

drop policy if exists "staff_avatars_own_write" on storage.objects;
create policy "staff_avatars_own_write"
  on storage.objects for insert
  to public
  with check (
    bucket_id = 'staff-avatars'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "staff_avatars_own_update" on storage.objects;
create policy "staff_avatars_own_update"
  on storage.objects for update
  to public
  using (
    bucket_id = 'staff-avatars'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================
-- ข้อมูลเริ่มต้น (แก้ไข id ให้ตรงกับ auth.users จริงหลังสร้างบัญชีแล้ว)
-- ตัวอย่าง: สร้างผู้ใช้ใน Authentication → Users ก่อน แล้วค่อยรัน insert ด้านล่าง
-- โดยแทน 'UUID-ของ-จ๊อบ' ด้วย id จริงที่ได้จากตาราง auth.users
-- ============================================================
-- insert into public.staff (id, full_name, nickname, role, scope, avatar_color, sort_order) values
--   ('UUID-ของ-จ๊อบ',   'จ๊อบ',   'จ๊อบ',   'head',   'หัวหน้าแผนก · ดูภาพรวมงานทั้งหมด',                                   '#a8446a', 0),
--   ('UUID-ของ-เนย',    'เนย',    'เนย',    'member', 'เงินเดือน ค่าตอบแทน ประกันสังคม กยศ. และงานอื่นๆ ตามที่ได้รับมอบหมาย', '#c99a3f', 1),
--   ('UUID-ของ-จ๋อม',   'จ๋อม',   'จ๋อม',   'member', 'การจัดจ้าง ลาออก โอนย้าย บรรจุ เงินบำเหน็จ คำสั่ง',                     '#4b7fa6', 2),
--   ('UUID-ของ-บีบี',   'บีบี',   'บีบี',   'member', 'เครื่องแต่งกาย ค่าจัดการงานศพ สัญญาจ้าง',                              '#5c8a6d', 3),
--   ('UUID-ของ-ปันปัน', 'ปันปัน', 'ปันปัน', 'member', 'ประกันสุขภาพและอุบัติเหตุกลุ่ม',                                        '#8a5aa8', 4);
