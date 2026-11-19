-- Tower Defense Academy v4: run ONCE in SQL Editor on the EXISTING v3 database.
-- Does not delete or modify existing groups, profiles, or progress.
begin;
-- Grant only the column permissions necessary for editing; no student may edit role/clerk_id.
revoke update on public.groups from authenticated;
grant update(name, open_through) on public.groups to authenticated;
grant delete on public.groups to authenticated;
grant update(nickname, username, group_id), delete on public.profiles to authenticated;

-- Existing group update RLS policy uses owns_group() and remains valid for rename.
-- An empty group may be deleted by its owning teacher only.
drop policy if exists groups_teacher_delete_empty on public.groups;
create policy groups_teacher_delete_empty on public.groups
for delete to authenticated using (
  (select public.owns_group(id))
  and not exists (select 1 from public.profiles p where p.group_id = groups.id)
);

-- Update an existing student only when their current group belongs to this teacher;
-- the new group must ALSO belong to the same teacher.
drop policy if exists profiles_teacher_edit_student on public.profiles;
create policy profiles_teacher_edit_student on public.profiles
for update to authenticated
using (role='student' and group_id is not null and (select public.owns_group(group_id)))
with check (role='student' and group_id is not null and (select public.owns_group(group_id)));

-- Removal of a student profile cascades to lesson_progress, but DOES NOT delete
-- their separate Clerk account (that remains a manual Clerk Dashboard action).
drop policy if exists profiles_teacher_delete_student on public.profiles;
create policy profiles_teacher_delete_student on public.profiles
for delete to authenticated
using (role='student' and group_id is not null and (select public.owns_group(group_id)));
commit;
