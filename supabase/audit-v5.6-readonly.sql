-- READ ONLY. Do not change data or permissions. Run as database owner in SQL Editor.
select c.relname as table_name, c.relrowsecurity as rls_enabled, c.relforcerowsecurity as force_rls
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('groups','profiles','lesson_progress','lesson_content') and c.relkind='r'
order by c.relname;

select schemaname,tablename,policyname,roles,cmd,qual,with_check
from pg_policies where (schemaname='public' and tablename in ('groups','profiles','lesson_progress','lesson_content'))
 or (schemaname='storage' and tablename='objects') order by schemaname,tablename,policyname;

select table_name,grantee,privilege_type,column_name from information_schema.column_privileges
where table_schema='public' and table_name in ('groups','profiles','lesson_progress','lesson_content')
 and grantee in ('anon','authenticated') order by table_name,grantee,privilege_type,column_name;

select id,public,file_size_limit,allowed_mime_types from storage.buckets where id='tda-lesson-assets';
