-- Storage buckets and access rules. Each statement is guarded: if your project does not allow
-- creating storage policies from the SQL editor, this file still finishes and prints a warning.
-- Then create the policies by hand (see docs/GO_LIVE.md, "If a check says MISSING").

do $$ begin
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
    ('public-media', 'public-media', true, 5242880, array['image/jpeg','image/png','image/webp']),
    ('private-submissions', 'private-submissions', false, 26214400, array['image/jpeg','image/png','image/webp','audio/mpeg','audio/mp4','audio/ogg','application/pdf']),
    ('avatars', 'avatars', true, 1048576, array['image/jpeg','image/png','image/webp'])
  on conflict (id) do nothing;
exception when others then
  raise warning 'Could not create buckets by SQL (%). Create them in Dashboard > Storage: public-media (public), avatars (public), private-submissions (private).', sqlerrm;
end $$;

do $$
declare stmt text;
begin
  foreach stmt in array array[
    $p$create policy "public media readable" on storage.objects for select to anon, authenticated using (bucket_id = 'public-media')$p$,
    $p$create policy "editors write public media" on storage.objects for insert to authenticated with check (bucket_id = 'public-media' and public.is_editor())$p$,
    $p$create policy "editors update public media" on storage.objects for update to authenticated using (bucket_id = 'public-media' and public.is_editor())$p$,
    $p$create policy "own submission upload" on storage.objects for insert to authenticated with check (bucket_id = 'private-submissions' and (storage.foldername(name))[1] = auth.uid()::text)$p$,
    $p$create policy "own submission read" on storage.objects for select to authenticated using (bucket_id = 'private-submissions' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_editor()))$p$,
    $p$create policy "own submission delete" on storage.objects for delete to authenticated using (bucket_id = 'private-submissions' and (storage.foldername(name))[1] = auth.uid()::text)$p$,
    $p$create policy "avatars readable" on storage.objects for select to anon, authenticated using (bucket_id = 'avatars')$p$,
    $p$create policy "own avatar write" on storage.objects for insert to authenticated with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)$p$,
    $p$create policy "own avatar update" on storage.objects for update to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)$p$,
    $p$create policy "own avatar delete" on storage.objects for delete to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)$p$
  ] loop
    begin
      execute stmt;
    exception
      when duplicate_object then null;
      when others then raise warning 'Storage policy not created (%): %', sqlerrm, left(stmt, 70);
    end;
  end loop;
end $$;
