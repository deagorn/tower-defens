-- Tower Defense Academy v3 · виконувати в Supabase SQL Editor (один раз)
-- Clerk → Supabase Third Party Auth має бути налаштовано; JWT містить role='authenticated'.
create extension if not exists pgcrypto;

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  teacher_id text not null,
  name text not null check (length(trim(name)) between 1 and 60),
  open_through smallint not null default 1 check (open_through between 1 and 16),
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  clerk_id text primary key,
  nickname text not null check (length(trim(nickname)) between 1 and 60),
  username text not null unique,
  role text not null check (role in ('teacher','student')),
  group_id uuid references public.groups(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint role_group_check check ((role='teacher' and group_id is null) or role='student')
);

create table if not exists public.lesson_progress (
  student_id text not null references public.profiles(clerk_id) on delete cascade,
  lesson_id text not null,
  current_step smallint not null default 0 check (current_step between 0 and 255),
  completed_steps text[] not null default array[]::text[],
  updated_at timestamptz not null default now(),
  primary key(student_id,lesson_id)
);

create index if not exists idx_profiles_group on public.profiles(group_id);
create index if not exists idx_groups_teacher on public.groups(teacher_id);
create index if not exists idx_progress_student on public.lesson_progress(student_id);

create or replace function public.current_clerk_id() returns text
language sql stable security invoker set search_path = '' as $$
  select nullif(auth.jwt()->>'sub','')
$$;

create or replace function public.is_teacher() returns boolean
language sql stable security definer set search_path = '' as $$
 select exists (select 1 from public.profiles p where p.clerk_id=(select public.current_clerk_id()) and p.role='teacher')
$$;

create or replace function public.owns_group(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists (select 1 from public.groups g where g.id=target and g.teacher_id=(select public.current_clerk_id()) and (select public.is_teacher()))
$$;

create or replace function public.can_read_student(target text) returns boolean
language sql stable security definer set search_path = '' as $$
 select target=(select public.current_clerk_id()) or exists (
  select 1 from public.profiles p join public.groups g on g.id=p.group_id
  where p.clerk_id=target and p.role='student' and g.teacher_id=(select public.current_clerk_id())
  and (select public.is_teacher())
 )
$$;

revoke all on function public.current_clerk_id() from public;
revoke all on function public.is_teacher() from public;
revoke all on function public.owns_group(uuid) from public;
revoke all on function public.can_read_student(text) from public;
grant execute on function public.current_clerk_id(), public.is_teacher(), public.owns_group(uuid), public.can_read_student(text) to authenticated;

alter table public.groups enable row level security;
alter table public.profiles enable row level security;
alter table public.lesson_progress enable row level security;

revoke all on public.groups,public.profiles,public.lesson_progress from anon;
grant select,insert,update on public.groups to authenticated;
grant select,insert on public.profiles to authenticated;
grant select,insert,update on public.lesson_progress to authenticated;

create policy groups_read on public.groups for select to authenticated using (
  (teacher_id=(select public.current_clerk_id()) and (select public.is_teacher()))
  or id=(select group_id from public.profiles where clerk_id=(select public.current_clerk_id()) and role='student')
);
create policy groups_insert on public.groups for insert to authenticated with check (
 teacher_id=(select public.current_clerk_id()) and (select public.is_teacher())
);
create policy groups_update on public.groups for update to authenticated using (
 (select public.owns_group(id))
) with check ((select public.owns_group(id)) and teacher_id=(select public.current_clerk_id()));

create policy profiles_read on public.profiles for select to authenticated using (
 (select public.can_read_student(clerk_id))
);
create policy profiles_teacher_add_student on public.profiles for insert to authenticated with check (
 role='student' and group_id is not null and (select public.owns_group(group_id))
);

create policy progress_read on public.lesson_progress for select to authenticated using (
 (select public.can_read_student(student_id))
);
create policy progress_student_insert on public.lesson_progress for insert to authenticated with check (
 student_id=(select public.current_clerk_id()) and
 exists (select 1 from public.profiles p where p.clerk_id=student_id and p.role='student')
);
create policy progress_student_update on public.lesson_progress for update to authenticated using (
 student_id=(select public.current_clerk_id())
) with check (student_id=(select public.current_clerk_id()));

-- Забороняємо змінювати teacher_id/name через UPDATE із браузера: тільки open_through.
revoke update on public.groups from authenticated;
grant update(open_through) on public.groups to authenticated;

-- Час синхронізації призначає сервер.
create or replace function public.progress_timestamp() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at=now(); return new; end $$;
drop trigger if exists set_progress_timestamp on public.lesson_progress;
create trigger set_progress_timestamp before insert or update on public.lesson_progress for each row execute function public.progress_timestamp();

-- Увімкнути realtime для таблиць (потрібно для миттєвих змін)
do $$ begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='groups') then
   alter publication supabase_realtime add table public.groups;
 end if;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='profiles') then
   alter publication supabase_realtime add table public.profiles;
 end if;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='lesson_progress') then
   alter publication supabase_realtime add table public.lesson_progress;
 end if;
end $$;

-- Початковий викладач: виконай ОКРЕМО після реєстрації в Clerk, підстав свій user_...:
-- insert into public.profiles(clerk_id,nickname,username,role)
-- values ('user_ТВІЙ_CLERK_ID','Викладач','teacher_account','teacher');
