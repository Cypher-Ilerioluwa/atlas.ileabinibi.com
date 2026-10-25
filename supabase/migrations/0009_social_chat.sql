-- 0009: richer chat (photos, edit, pin, role badges), likes and comments on posts, full formatted body for imported posts.
-- Run after 0008.

-- ---------- chat ----------
alter table chat_messages add column if not exists image_path text, add column if not exists edited_at timestamptz,
  add column if not exists pinned boolean not null default false, add column if not exists author_role text;
alter table chat_messages drop constraint if exists chat_messages_body_check;
alter table chat_messages add constraint chat_messages_body_check check (char_length(body) <= 500 and (char_length(trim(body)) >= 1 or image_path is not null));

create or replace function chat_before_insert() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.room <> 'general' and not exists (select 1 from communities where slug = new.room and status = 'published') then raise exception 'Unknown room'; end if;
  if new.reply_to is not null and not exists (select 1 from chat_messages where id = new.reply_to and room = new.room) then new.reply_to := null; end if;
  if exists (select 1 from chat_messages where user_id = new.user_id and created_at > now() - interval '1 second') then raise exception 'Slow down a little.'; end if;
  select coalesce(nullif(display_name, ''), 'Member'), avatar_path into new.author_name, new.author_avatar from profiles where id = new.user_id;
  new.author_name := coalesce(new.author_name, 'Member');
  new.author_role := case when exists (select 1 from user_roles where user_id = new.user_id and role = 'admin') then 'admin'
                          when exists (select 1 from user_roles where user_id = new.user_id and role in ('community_editor','research_editor')) then 'editor' else null end;
  new.pinned := false; new.edited_at := null;
  return new;
end $$;

create policy "edit own message" on chat_messages for update to authenticated using (user_id = auth.uid() or is_editor()) with check (user_id = auth.uid() or is_editor());
create function chat_lock_fields() returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.user_id := old.user_id; new.room := old.room; new.reply_to := old.reply_to; new.image_path := old.image_path; new.created_at := old.created_at;
  new.author_name := old.author_name; new.author_avatar := old.author_avatar; new.author_role := old.author_role;
  if not is_editor() then new.pinned := old.pinned; end if;
  if new.body is distinct from old.body then new.edited_at := now(); else new.edited_at := old.edited_at; end if;
  return new;
end $$;
create trigger trg_chat_lock before update on chat_messages for each row execute function chat_lock_fields();

-- ---------- likes and comments on posts ----------
create table post_likes (
  content_type text not null check (content_type in ('article','event','heritage_record','landmark','person','institution','organisation','media')),
  content_id uuid not null, user_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now(),
  primary key (content_type, content_id, user_id)
);
create index on post_likes (content_type, content_id);
alter table post_likes enable row level security;
create policy "anyone reads likes" on post_likes for select to anon, authenticated using (true);
create policy "members like" on post_likes for insert to authenticated with check (user_id = auth.uid() and not is_banned());
create policy "remove own like" on post_likes for delete to authenticated using (user_id = auth.uid());

create table post_comments (
  id uuid primary key default gen_random_uuid(),
  content_type text not null check (content_type in ('article','event','heritage_record','landmark','person','institution','organisation','media')),
  content_id uuid not null, user_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null default 'Member', author_avatar text, author_role text,
  body text not null check (char_length(trim(body)) between 1 and 1000), created_at timestamptz not null default now()
);
create index on post_comments (content_type, content_id, created_at);
alter table post_comments enable row level security;
create policy "anyone reads comments" on post_comments for select to anon, authenticated using (true);
create policy "members comment" on post_comments for insert to authenticated with check (user_id = auth.uid() and not is_banned());
create policy "delete own or editor" on post_comments for delete to authenticated using (user_id = auth.uid() or is_editor());
create function comment_before_insert() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from post_comments where user_id = new.user_id and created_at > now() - interval '3 seconds') then raise exception 'Slow down a little.'; end if;
  select coalesce(nullif(display_name, ''), 'Member'), avatar_path into new.author_name, new.author_avatar from profiles where id = new.user_id;
  new.author_name := coalesce(new.author_name, 'Member');
  new.author_role := case when exists (select 1 from user_roles where user_id = new.user_id and role = 'admin') then 'admin'
                          when exists (select 1 from user_roles where user_id = new.user_id and role in ('community_editor','research_editor')) then 'editor' else null end;
  return new;
end $$;
create trigger trg_comment_before_insert before insert on post_comments for each row execute function comment_before_insert();

-- ---------- formatted body (for imported posts) ----------
do $$ declare t text; begin
  foreach t in array array['articles','events','heritage_records','landmarks','people','institutions','organisations'] loop
    execute format('alter table %I add column if not exists body_html text', t);
    execute format('alter table %I add column if not exists external_modified timestamptz', t);
  end loop;
end $$;
drop view if exists articles_public, events_public, heritage_records_public, landmarks_public, people_public, institutions_public, organisations_public;
create view articles_public as select id, slug, community_id, region_text, topic, title, summary, body, body_html, author_credit, sources, evidence, published_at, source, external_url, cover_url from articles where status = 'published';
create view events_public as select id, slug, name, alt_names, community_id, landmark_id, summary, body, body_html, significance, location_text, region_text, date_start, date_end, confidence, recurrence_note, organiser, public_contact, evidence, last_reviewed_at, source, external_url, cover_url from events where status = 'published';
create view heritage_records_public as select id, slug, category, title, summary, body, body_html, community_id, period_text, language, evidence, rights, reuse_terms, contributor_credit, last_reviewed_at, source, external_url, cover_url from heritage_records where status = 'published';
create view landmarks_public as select id, slug, name, community_id, summary, body, body_html, case when coord_sensitive then null else lat end as lat, case when coord_sensitive then null else lng end as lng, coord_source, coord_precision, coord_verified, visitor_info, evidence, last_reviewed_at, source, external_url, cover_url from landmarks where status = 'published';
create view people_public as select id, slug, preferred_name, alt_names, summary, body, body_html, evidence, last_reviewed_at, source, external_url, cover_url from people where status = 'published' and (not living or consent_confirmed);
create view institutions_public as select id, slug, name, community_id, summary, body, body_html, evidence, last_reviewed_at, source, external_url, cover_url from institutions where status = 'published';
create view organisations_public as select id, slug, name, category, community_id, summary, service_area, public_contact, verified, last_confirmed_at, source, external_url, cover_url from organisations where status = 'published';
revoke all on articles_public, events_public, heritage_records_public, landmarks_public, people_public, institutions_public, organisations_public from public, anon, authenticated;
grant select on articles_public, events_public, heritage_records_public, landmarks_public, people_public, institutions_public, organisations_public to anon, authenticated;

-- ---------- chat photos bucket (guarded, like 0005) ----------
do $$ begin
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('chat-media', 'chat-media', true, 3145728, array['image/jpeg','image/png','image/webp']) on conflict (id) do nothing;
exception when others then raise warning 'Could not create the chat-media bucket by SQL (%). Create it in Dashboard > Storage as a public bucket.', sqlerrm; end $$;
do $$
declare stmt text;
begin
  foreach stmt in array array[
    $p$create policy "chat media readable" on storage.objects for select to anon, authenticated using (bucket_id = 'chat-media')$p$,
    $p$create policy "own chat media upload" on storage.objects for insert to authenticated with check (bucket_id = 'chat-media' and (storage.foldername(name))[1] = auth.uid()::text)$p$,
    $p$create policy "own chat media delete" on storage.objects for delete to authenticated using (bucket_id = 'chat-media' and (storage.foldername(name))[1] = auth.uid()::text)$p$
  ] loop
    begin execute stmt; exception when duplicate_object then null; when others then raise warning 'Storage policy not created (%): %', sqlerrm, left(stmt, 70); end;
  end loop;
end $$;

-- unread-notification badges update live
do $$ begin
  alter publication supabase_realtime add table notifications;
exception when others then raise warning 'Could not add notifications to realtime (%). Switch it on in Dashboard > Database > Publications.', sqlerrm; end $$;
