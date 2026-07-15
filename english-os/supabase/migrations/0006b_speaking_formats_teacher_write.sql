-- ============================================================================
-- 0006b_speaking_formats_teacher_write.sql
-- Let teachers/admins add more speaking suggestion formats.
-- Safe to re-run after 0006.
-- ============================================================================

drop policy if exists "speaking_formats_admin" on public.speaking_formats;
drop policy if exists "speaking_formats_write_teacher" on public.speaking_formats;
create policy "speaking_formats_write_teacher" on public.speaking_formats
  for all to authenticated
  using (public.is_teacher())
  with check (public.is_teacher());
