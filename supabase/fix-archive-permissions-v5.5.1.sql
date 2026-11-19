-- Tower Defense Academy v5.5.1: fix archive permissions only.
-- Safe to execute after the columns is_archived and archived_at already exist.
-- No records or tables are deleted; does not grant UPDATE of teacher_id or open_through.
begin;
grant update(is_archived, archived_at) on table public.groups to authenticated;
commit;

-- Optional check after execution (returns two TRUE values):
select has_column_privilege('authenticated','public.groups','is_archived','UPDATE') as can_archive,
       has_column_privilege('authenticated','public.groups','archived_at','UPDATE') as can_set_archive_date;
