-- Tower Defense Academy v5.3: group archive, NON-DESTRUCTIVE.
-- Run once after upgrade-v4.sql and upgrade-v5.sql.
-- Does not remove or rename existing groups, pupils, lessons or progress.
begin;
alter table public.groups add column if not exists is_archived boolean not null default false;
alter table public.groups add column if not exists archived_at timestamptz;
-- Keep existing ownership-based UPDATE RLS policies; allow changing only archive metadata.
grant update(is_archived, archived_at) on public.groups to authenticated;
create index if not exists tda_groups_teacher_archive_idx
  on public.groups(teacher_id, is_archived);
commit;
