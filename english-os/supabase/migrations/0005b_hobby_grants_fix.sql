-- ============================================================================
-- 0005b_hobby_grants_fix.sql
-- Run this if Interest suggestions stay empty after 0005.
-- Safe to re-run.
-- ============================================================================

grant select, insert, update, delete on table public.hobbies to authenticated;
grant select, insert, update, delete on table public.hobby_aliases to authenticated;
grant select, insert, update, delete on table public.hobby_suggestions to authenticated;
grant select, insert, update, delete on table public.student_hobbies to authenticated;

-- Quick check (optional): how many pending suggestions exist?
-- select id, raw_text, status, created_at from public.hobby_suggestions order by created_at desc;
