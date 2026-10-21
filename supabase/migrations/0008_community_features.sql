-- 0008: contributors and credits, imported-article fields (ileabinibi.com sync), and chat upgrade
-- (replies, reactions, read receipts, avatars). Run after 0007. Safe to run once.

-- ---------- contributors ----------
create table contributors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  slug text unique not null,
  display_name text not null check (char_length(display_name) between 1 and 120),
  avatar_path text,
  bio text,
  created_at timestamptz not null default now()
);
create table content_contributors (
  content_type text not null check (content_type in ('article','event','heritage_record','landmark','person','institution','organisation')),
  content_id uuid not null,
  contributor_id uuid not null references contributors(id) on delete cascade,
  role text not null default 'contributor' check (role in ('author','editor','contributor')),
  position int not null default 0,
  created_at timestamptz not null default now(),
  primary key (content_type, content_id, contributor_id)
);
create index on content_contributors (contributor_id);
create index on content_contributors (content_type, content_id);
do $$ declare t text; begin
  foreach t in array array['contributors','content_contributors'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "public reads" on %I for select to anon, authenticated using (true)', t);
    execute format('create policy "editors write" on %I for insert to authenticated with check (is_editor())', t);
    execute format('create policy "editors update" on %I for update to authenticated using (is_editor()) with check (is_editor())', t);
    execute format('create policy "admins delete" on %I for delete to authenticated using (has_role(''admin''))', t);
  end loop;
end $$;

-- keep a member's public name and picture in step with their profile
create function sync_contributor_from_profile() returns trigger language plpgsql security definer set search_path = public as $$
begin
  update contributors set display_name = coalesce(nullif(new.display_name, ''), display_name), avatar_path = new.avatar_path where user_id = new.id;
  return new;
end $$;
create trigger trg_sync_contributor after update of display_name, avatar_path on profiles for each row execute function sync_contributor_from_profile();

-- find or create the public contributor for a member (p_user) or for a named person (p_name)
create function ensure_contributor(p_user uuid, p_name text) returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid; nm text;
begin
  if p_user is not null then
    select id into cid from contributors where user_id = p_user;
    if cid is not null then return cid; end if;
    select coalesce(nullif(display_name, ''), 'Member') into nm from profiles where id = p_user;
    insert into contributors(user_id, slug, display_name, avatar_path)
      values (p_user, slug_from(coalesce(nm, 'member')), coalesce(nm, 'Member'), (select avatar_path from profiles where id = p_user)) returning id into cid;
    return cid;
  end if;
  nm := trim(coalesce(p_name, ''));
  if nm = '' then raise exception 'A contributor needs a name'; end if;
  select id into cid from contributors where user_id is null and lower(display_name) = lower(nm) limit 1;
  if cid is null then insert into contributors(slug, display_name) values (slug_from(nm), left(nm, 120)) returning id into cid; end if;
  return cid;
end $$;
revoke all on function ensure_contributor(uuid, text) from public, anon, authenticated;

-- editors replace the credit list of one item: credits = [{"name":"Ada Obi","role":"author"}, ...] (first = lead)
create function admin_set_credits(c_type text, c_id uuid, credits jsonb) returns void language plpgsql security definer set search_path = public as $$
declare item jsonb; pos int := 0; cid uuid;
begin
  if not is_editor() then raise exception 'forbidden'; end if;
  if jsonb_typeof(credits) <> 'array' then raise exception 'credits must be a list'; end if;
  delete from content_contributors where content_type = c_type and content_id = c_id;
  for item in select * from jsonb_array_elements(credits) loop
    if trim(coalesce(item->>'name', '')) = '' then continue; end if;
    cid := ensure_contributor(null, item->>'name');
    insert into content_contributors(content_type, content_id, contributor_id, role, position)
      values (c_type, c_id, cid, case when pos = 0 then 'author' when item->>'role' in ('author','editor','contributor') then item->>'role' else 'editor' end, pos)
      on conflict do nothing;
    pos := pos + 1;
  end loop;
end $$;
revoke all on function admin_set_credits(text, uuid, jsonb) from public, anon;
grant execute on function admin_set_credits(text, uuid, jsonb) to authenticated;

-- ---------- fields for items imported from ileabinibi.com ----------
do $$ declare t text; begin
  foreach t in array array['articles','events','heritage_records','landmarks','people','institutions','organisations'] loop
    execute format('alter table %I add column if not exists source text not null default ''atlas''', t);
    execute format('alter table %I add column if not exists external_id bigint', t);
    execute format('alter table %I add column if not exists external_url text', t);
    execute format('alter table %I add column if not exists cover_url text', t);
    execute format('create unique index if not exists %I on %I (source, external_id) where external_id is not null', t || '_source_ext_idx', t);
  end loop;
end $$;

drop view if exists articles_public, events_public, heritage_records_public, landmarks_public, people_public, institutions_public, organisations_public;
create view articles_public as select id, slug, community_id, region_text, topic, title, summary, body, author_credit, sources, evidence, published_at, source, external_url, cover_url from articles where status = 'published';
create view events_public as select id, slug, name, alt_names, community_id, landmark_id, summary, body, significance, location_text, region_text, date_start, date_end, confidence, recurrence_note, organiser, public_contact, evidence, last_reviewed_at, source, external_url, cover_url from events where status = 'published';
create view heritage_records_public as select id, slug, category, title, summary, body, community_id, period_text, language, evidence, rights, reuse_terms, contributor_credit, last_reviewed_at, source, external_url, cover_url from heritage_records where status = 'published';
create view landmarks_public as select id, slug, name, community_id, summary, body, case when coord_sensitive then null else lat end as lat, case when coord_sensitive then null else lng end as lng, coord_source, coord_precision, coord_verified, visitor_info, evidence, last_reviewed_at, source, external_url, cover_url from landmarks where status = 'published';
create view people_public as select id, slug, preferred_name, alt_names, summary, body, evidence, last_reviewed_at, source, external_url, cover_url from people where status = 'published' and (not living or consent_confirmed);
create view institutions_public as select id, slug, name, community_id, summary, body, evidence, last_reviewed_at, source, external_url, cover_url from institutions where status = 'published';
create view organisations_public as select id, slug, name, category, community_id, summary, service_area, public_contact, verified, last_confirmed_at, source, external_url, cover_url from organisations where status = 'published';
revoke all on articles_public, events_public, heritage_records_public, landmarks_public, people_public, institutions_public, organisations_public from public, anon, authenticated;
grant select on articles_public, events_public, heritage_records_public, landmarks_public, people_public, institutions_public, organisations_public to anon, authenticated;

-- ---------- approval now records credits ----------
create or replace function approve_submission(sub_id uuid, feedback text default null) returns void language plpgsql security definer set search_path = public as $$
declare s submissions; p jsonb; tgt uuid; new_id uuid; cid uuid; ttype text; nextpos int;
begin
  if not is_editor() then raise exception 'forbidden'; end if;
  select * into s from submissions where id = sub_id for update;
  if not found then raise exception 'Submission not found'; end if;
  if s.status = 'approved' then raise exception 'Already approved'; end if;
  p := s.payload;
  cid := ensure_contributor(s.user_id, null);
  if s.kind = 'article' then
    insert into articles(slug, community_id, region_text, topic, title, summary, body, author_id, author_credit, sources, status, published_at, last_reviewed_at, source_submission_id, created_by)
    values (slug_from(s.title), s.community_id, s.region_text, coalesce(nullif(p->>'topic',''), 'culture')::article_topic, s.title, p->>'summary', coalesce(p->>'body',''), s.user_id,
            nullif(p->>'author_credit',''), p->>'sources', 'published', now(), now(), s.id, auth.uid()) returning id into new_id;
    insert into content_contributors(content_type, content_id, contributor_id, role, position) values ('article', new_id, cid, 'author', 0) on conflict do nothing;
  elsif s.kind = 'event' then
    insert into events(slug, name, community_id, summary, body, location_text, region_text, date_start, date_end, organiser, confidence, evidence, status, author_id, last_reviewed_at, created_by)
    values (slug_from(s.title), s.title, s.community_id, p->>'summary', p->>'body', p->>'location', s.region_text, nullif(p->>'date_start','')::date, nullif(p->>'date_end','')::date,
            p->>'organiser', 'tentative', 'community_submitted', 'published', s.user_id, now(), auth.uid()) returning id into new_id;
    insert into content_contributors(content_type, content_id, contributor_id, role, position) values ('event', new_id, cid, 'author', 0) on conflict do nothing;
  elsif s.kind = 'edit' and nullif(p->>'target_id','') is not null then
    tgt := (p->>'target_id')::uuid; ttype := p->>'target_type';
    if ttype = 'article' then
      update articles set title = coalesce(nullif(p->>'proposed_title',''), title), summary = coalesce(nullif(p->>'proposed_summary',''), summary), body = coalesce(nullif(p->>'proposed_body',''), body), last_reviewed_at = now() where id = tgt;
    elsif ttype = 'event' then
      update events set name = coalesce(nullif(p->>'proposed_title',''), name), summary = coalesce(nullif(p->>'proposed_summary',''), summary), body = coalesce(nullif(p->>'proposed_body',''), body), last_reviewed_at = now() where id = tgt;
    end if;
    if ttype in ('article','event') then
      select coalesce(max(position), -1) + 1 into nextpos from content_contributors where content_type = ttype and content_id = tgt;
      insert into content_contributors(content_type, content_id, contributor_id, role, position) values (ttype, tgt, cid, 'editor', nextpos) on conflict do nothing;
    end if;
  end if;
  update submissions set status = 'approved', editor_feedback = feedback where id = sub_id;
  insert into moderation_decisions(submission_id, decided_by, decision, notes) values (sub_id, auth.uid(), 'approved', feedback);
end $$;

-- ---------- chat upgrade ----------
alter table chat_messages add column if not exists author_avatar text, add column if not exists reply_to uuid references chat_messages(id) on delete set null;
create or replace function chat_before_insert() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.room <> 'general' and not exists (select 1 from communities where slug = new.room and status = 'published') then raise exception 'Unknown room'; end if;
  if new.reply_to is not null and not exists (select 1 from chat_messages where id = new.reply_to and room = new.room) then new.reply_to := null; end if;
  if exists (select 1 from chat_messages where user_id = new.user_id and created_at > now() - interval '1 second') then raise exception 'Slow down a little.'; end if;
  select coalesce(nullif(display_name, ''), 'Member'), avatar_path into new.author_name, new.author_avatar from profiles where id = new.user_id;
  new.author_name := coalesce(new.author_name, 'Member');
  return new;
end $$;
create index if not exists chat_messages_reply_idx on chat_messages (reply_to);

create table chat_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references chat_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 8),
  created_at timestamptz not null default now(),
  unique (message_id, user_id, emoji)
);
create index on chat_reactions (message_id);
alter table chat_reactions replica identity full;
alter table chat_reactions enable row level security;
create policy "anyone reads reactions" on chat_reactions for select to anon, authenticated using (true);
create policy "members react" on chat_reactions for insert to authenticated with check (user_id = auth.uid() and not is_banned());
create policy "remove own reaction" on chat_reactions for delete to authenticated using (user_id = auth.uid());

create table chat_reads (
  room text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null default 'Member',
  author_avatar text,
  last_read_at timestamptz not null default now(),
  primary key (room, user_id)
);
alter table chat_reads replica identity full;
alter table chat_reads enable row level security;
create policy "anyone reads receipts" on chat_reads for select to anon, authenticated using (true);
create policy "own receipt insert" on chat_reads for insert to authenticated with check (user_id = auth.uid());
create policy "own receipt update" on chat_reads for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create function chat_reads_fill() returns trigger language plpgsql security definer set search_path = public as $$
begin
  select coalesce(nullif(display_name, ''), 'Member'), avatar_path into new.author_name, new.author_avatar from profiles where id = new.user_id;
  new.author_name := coalesce(new.author_name, 'Member'); new.last_read_at := now();
  return new;
end $$;
create trigger trg_chat_reads_fill before insert or update on chat_reads for each row execute function chat_reads_fill();

do $$ declare t text; begin
  foreach t in array array['chat_reactions','chat_reads'] loop
    begin execute format('alter publication supabase_realtime add table %I', t);
    exception when others then raise warning 'Could not add % to realtime (%). Switch it on in Dashboard > Database > Publications.', t, sqlerrm; end;
  end loop;
end $$;

-- ---------- credit the pilot content ----------
insert into contributors (slug, display_name) values ('ile-abinibi-atlas-prototype', 'Ilẹ̀ Abínibí Atlas prototype') on conflict (slug) do nothing;
insert into content_contributors (content_type, content_id, contributor_id, role, position)
  select 'article', a.id, c.id, 'author', 0 from articles a, contributors c where c.slug = 'ile-abinibi-atlas-prototype' and a.author_credit = 'Ilẹ̀ Abínibí Atlas prototype' on conflict do nothing;
insert into content_contributors (content_type, content_id, contributor_id, role, position)
  select 'heritage_record', h.id, c.id, 'author', 0 from heritage_records h, contributors c where c.slug = 'ile-abinibi-atlas-prototype' and h.contributor_credit = 'Ilẹ̀ Abínibí Atlas prototype' on conflict do nothing;
insert into content_contributors (content_type, content_id, contributor_id, role, position)
  select 'event', x.id, c.id, 'author', 0 from events x, contributors c where c.slug = 'ile-abinibi-atlas-prototype' and x.slug in ('osun-osogbo-festival', 'ojude-oba', 'eyo-festival', 'olojo-festival') on conflict do nothing;
insert into content_contributors (content_type, content_id, contributor_id, role, position)
  select 'landmark', x.id, c.id, 'author', 0 from landmarks x, contributors c where c.slug = 'ile-abinibi-atlas-prototype' and x.slug in ('osun-osogbo-sacred-grove', 'oyotunji-african-village') on conflict do nothing;
insert into content_contributors (content_type, content_id, contributor_id, role, position)
  select 'person', x.id, c.id, 'author', 0 from people x, contributors c where c.slug = 'ile-abinibi-atlas-prototype' and x.slug in ('oduduwa', 'samuel-ajayi-crowther') on conflict do nothing;
insert into content_contributors (content_type, content_id, contributor_id, role, position)
  select 'institution', x.id, c.id, 'author', 0 from institutions x, contributors c where c.slug = 'ile-abinibi-atlas-prototype' and x.slug in ('alaafin-of-oyo') on conflict do nothing;
insert into content_contributors (content_type, content_id, contributor_id, role, position)
  select 'organisation', x.id, c.id, 'author', 0 from organisations x, contributors c where c.slug = 'ile-abinibi-atlas-prototype' and x.slug in ('oyotunji-african-village-org') on conflict do nothing;
