-- Tower Defense Academy v5. Run ONCE in SQL Editor on your existing v4 database.
-- Adds only lesson content and private media; does not change groups/profiles/progress.
begin;
create table if not exists public.lesson_content (
  id uuid primary key default gen_random_uuid(),
  teacher_id text not null,
  lesson_number smallint not null check (lesson_number between 1 and 16),
  title text not null default '',
  summary text not null default '',
  status text not null default 'draft' check (status in ('draft','published')),
  steps jsonb not null default '[]'::jsonb check (jsonb_typeof(steps)='array'),
  updated_at timestamptz not null default now(),
  unique(teacher_id,lesson_number)
);
create index if not exists lesson_content_teacher_idx on public.lesson_content(teacher_id,lesson_number);
create or replace function public.lesson_content_stamp() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at=now(); return new; end $$;
drop trigger if exists lesson_content_stamp_trigger on public.lesson_content;
create trigger lesson_content_stamp_trigger before insert or update on public.lesson_content
for each row execute function public.lesson_content_stamp();

-- The group relation is authoritative. Students cannot read drafts or locked lessons.
create or replace function public.can_view_lesson(owner_id text, lesson_no smallint, lesson_status text)
returns boolean language sql stable security definer set search_path='' as $$
select (owner_id=(select public.current_clerk_id()) and (select public.is_teacher()))
 or (lesson_status='published' and exists (
  select 1 from public.profiles p join public.groups g on g.id=p.group_id
  where p.clerk_id=(select public.current_clerk_id()) and p.role='student'
    and g.teacher_id=owner_id and g.open_through>=lesson_no
 ));
$$;
revoke all on function public.can_view_lesson(text,smallint,text) from public;
grant execute on function public.can_view_lesson(text,smallint,text) to authenticated;

alter table public.lesson_content enable row level security;
revoke all on public.lesson_content from anon;
grant select,insert,delete on public.lesson_content to authenticated;
grant update(title,summary,status,steps) on public.lesson_content to authenticated;
drop policy if exists lesson_content_read_v5 on public.lesson_content;
create policy lesson_content_read_v5 on public.lesson_content for select to authenticated
using ((select public.can_view_lesson(teacher_id,lesson_number,status)));
drop policy if exists lesson_content_insert_v5 on public.lesson_content;
create policy lesson_content_insert_v5 on public.lesson_content for insert to authenticated
with check (teacher_id=(select public.current_clerk_id()) and (select public.is_teacher()));
drop policy if exists lesson_content_update_v5 on public.lesson_content;
create policy lesson_content_update_v5 on public.lesson_content for update to authenticated
using (teacher_id=(select public.current_clerk_id()) and (select public.is_teacher()))
with check (teacher_id=(select public.current_clerk_id()) and (select public.is_teacher()));
drop policy if exists lesson_content_delete_v5 on public.lesson_content;
create policy lesson_content_delete_v5 on public.lesson_content for delete to authenticated
using (teacher_id=(select public.current_clerk_id()) and (select public.is_teacher()));

-- Private media: owner can upload/edit/remove, enrolled students may read owner's assets.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('tda-lesson-assets','tda-lesson-assets',false,10485760,ARRAY['image/png','image/jpeg','image/webp','image/gif'])
on conflict(id) do update set public=false,file_size_limit=10485760,
 allowed_mime_types=ARRAY['image/png','image/jpeg','image/webp','image/gif'];
drop policy if exists tda_assets_read_v5 on storage.objects;
create policy tda_assets_read_v5 on storage.objects for select to authenticated
using (bucket_id='tda-lesson-assets' and (
 (storage.foldername(name))[1]=(select public.current_clerk_id())
 or exists (select 1 from public.profiles p join public.groups g on g.id=p.group_id
   where p.clerk_id=(select public.current_clerk_id()) and p.role='student'
   and g.teacher_id=(storage.foldername(name))[1])
));
drop policy if exists tda_assets_insert_v5 on storage.objects;
create policy tda_assets_insert_v5 on storage.objects for insert to authenticated
with check(bucket_id='tda-lesson-assets' and (storage.foldername(name))[1]=(select public.current_clerk_id()) and (select public.is_teacher()));
drop policy if exists tda_assets_update_v5 on storage.objects;
create policy tda_assets_update_v5 on storage.objects for update to authenticated
using(bucket_id='tda-lesson-assets' and (storage.foldername(name))[1]=(select public.current_clerk_id()) and (select public.is_teacher()))
with check(bucket_id='tda-lesson-assets' and (storage.foldername(name))[1]=(select public.current_clerk_id()) and (select public.is_teacher()));
drop policy if exists tda_assets_delete_v5 on storage.objects;
create policy tda_assets_delete_v5 on storage.objects for delete to authenticated
using(bucket_id='tda-lesson-assets' and (storage.foldername(name))[1]=(select public.current_clerk_id()) and (select public.is_teacher()));
commit;
