# Tower Defense Academy — production checklist (v5.6)

**Do not publish yet.** This archive is ready for deployment testing, not proof of production security.

## 1. Backups
- Export ALL groups (JSON) and ALL lessons (ZIP, including screenshots). Keep both offline in a protected folder.
- Perform a trial ZIP import **in a disposable environment** (do not overwrite live lesson data).
- Clerk accounts/passwords are not included in group/lesson exports. If migrating to a separate production Clerk instance, provision accounts anew or use a supported Clerk migration method; IDs differ and group/profile references require an explicit mapping. Never import actual passwords into a browser file.

## 2. Review access (Supabase)
- Run `supabase/audit-v5.6-readonly.sql` and inspect RLS on all four tables and storage policies. This is read-only and cannot guarantee security alone.
- Test as a real student: cannot read another student's profile/progress, cannot edit group settings, cannot read drafts/locked lessons, cannot write lesson content, cannot upload to another teacher's folder.
- Test as teacher: only own groups, students, content. Re-check `GRANT` column permissions and all SECURITY DEFINER functions for SQL injection, search path, and role checks.
- Note: the lesson media storage read policy in v5 may allow a student to fetch media in their teacher's asset folder even for a lesson not yet opened if they know the path; do not use this as hard secrecy until media access is tightened.
- Review whether public static example lesson `lesson.html` should remain available. A GitHub Pages static file is public.

## 3. Clerk production
- Development `pk_test_` keys and accounts are NOT automatically the same as production `pk_live_` accounts.
- Create/configure production instance with its actual domain and authentication policies. Clerk may require a **custom domain you control**; check domain requirements and DNS settings before choosing GitHub Pages URL as the main auth domain.
- Connect the production Clerk issuer to Supabase Authentication → Third-Party Auth separately; do not remove the development connection until tests are complete. Verify JWT `role=authenticated`.
- Use only the production PUBLISHABLE key in `config.js`. Never put Clerk secret keys, Supabase secret/service_role keys, or DB password in the ZIP/repository. The Supabase publishable key is intended for client use and RLS is the actual security boundary.
- Because the Clerk user ID will differ if you recreate accounts, **do not point the production site at the existing database with mismatched profile IDs**. Plan a migration and mapping or use separate staging/production DBs.

## 4. GitHub Pages
- Publish static files at the repository root (or correctly configured Pages folder). Relative navigation links and asset URLs are used.
- Turn on HTTPS and check custom domain DNS, certificate, Clerk authorized origins and redirect URLs.
- After deployment, test `/index.html`, `/editor.html`, `/course.html`, `/scripts.html`, `/lesson.html` and browser back/refresh on desktop/mobile.
- Run two accounts on two different browsers and verify group changes, progress, images, YouTube and Wordwall. Do not rely on Wordwall scores being synced.

## 5. Production go/no-go
Do not enroll real children until you have tested Clerk production login, RLS negative tests, backup restore, media protection and mobile usability.
