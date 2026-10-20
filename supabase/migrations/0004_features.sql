-- Features: articles, notifications, discussion room, proverbs/quiz, bans, approval workflow.
-- Also closes two gaps in 0002: owners could edit editor_feedback, and could edit their own `banned` flag.

-- ---------- profiles: ban flag, protected from self-edit ----------
alter table profiles add column banned boolean not null default false, add column banned_reason text;
create function is_banned() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select banned from profiles where id = auth.uid()), false)
$$;
create function lock_profile_fields() returns trigger language plpgsql as $$
begin
  if auth.uid() is not null and not has_role('admin') then new.banned := old.banned; new.banned_reason := old.banned_reason; end if;
  return new;
end $$;
create trigger trg_lock_profile before update on profiles for each row execute function lock_profile_fields();

-- ---------- submissions: new kinds, location fields, protected editor fields ----------
alter table submissions drop constraint submissions_kind_check;
alter table submissions add constraint submissions_kind_check check (kind in ('article','edit','event','heritage_record','photograph','audio','document','festival','landmark','community','correction','other'));
alter table submissions add column community_id uuid references communities(id) on delete set null, add column region_text text;
alter table submissions add constraint submissions_place_required check (char_length(trim(coalesce(region_text,''))) >= 2);
create function lock_submission_fields() returns trigger language plpgsql as $$
begin
  if auth.uid() is not null and not is_editor() then
    new.editor_feedback := old.editor_feedback; new.assigned_to := old.assigned_to; new.user_id := old.user_id;
  end if;
  return new;
end $$;
create trigger trg_lock_submission before update on submissions for each row execute function lock_submission_fields();
drop policy "create own" on submissions;
create policy "create own" on submissions for insert to authenticated
  with check (user_id = auth.uid() and status in ('draft','submitted') and not is_banned());

-- ---------- articles (approved posts shown on city pages) ----------
create type article_topic as enum ('history','people','language','culture','food','spirituality','names','popular_event');
create table articles (
  id uuid primary key default gen_random_uuid(), slug text unique not null,
  community_id uuid references communities(id) on delete set null, region_text text,
  topic article_topic not null, title text not null, summary text, body text not null,
  author_id uuid references auth.users(id) on delete set null, author_credit text, sources text,
  evidence evidence_status not null default 'community_submitted',
  status publish_status not null default 'draft', published_at timestamptz, last_reviewed_at timestamptz,
  source_submission_id uuid references submissions(id) on delete set null,
  created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index on articles (community_id, topic) where status = 'published';
alter table articles enable row level security;
create policy "editors read" on articles for select to authenticated using (is_editor());
create policy "editors insert" on articles for insert to authenticated with check (is_editor());
create policy "editors update" on articles for update to authenticated using (is_editor()) with check (is_editor());
create policy "admins delete" on articles for delete to authenticated using (has_role('admin'));
create trigger trg_touch_articles before update on articles for each row execute function touch_updated_at();
create trigger trg_audit_articles after insert or update or delete on articles for each row execute function log_change();
create view articles_public as
  select id, slug, community_id, region_text, topic, title, summary, body, author_credit, sources, evidence, published_at
  from articles where status = 'published';

-- ---------- events: richer fields ----------
alter table events add column body text, add column author_id uuid references auth.users(id) on delete set null, add column region_text text, add column cover_path text;
drop view events_public;
create view events_public as
  select id, slug, name, alt_names, community_id, landmark_id, summary, body, significance, location_text, region_text, date_start, date_end, confidence, recurrence_note, organiser, public_contact, evidence, last_reviewed_at
  from events where status = 'published';
revoke all on events_public, articles_public from public, anon, authenticated;   -- views are auto-updatable: never leave write access
grant select on events_public, articles_public to anon, authenticated;

-- ---------- notifications (in-app) ----------
create table notifications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'system' check (kind in ('submission','message','system')),
  title text not null check (char_length(title) <= 160), body text check (char_length(body) <= 2000), link text,
  read_at timestamptz, created_at timestamptz not null default now()
);
create index on notifications (user_id, created_at desc);
alter table notifications enable row level security;
create policy "own notifications read" on notifications for select to authenticated using (user_id = auth.uid());
create policy "own notifications mark read" on notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own notifications delete" on notifications for delete to authenticated using (user_id = auth.uid());
-- No insert policy: notifications are created only by the trusted functions/triggers below.
create function lock_notification_fields() returns trigger language plpgsql as $$
begin new.title := old.title; new.body := old.body; new.link := old.link; new.kind := old.kind; new.user_id := old.user_id; return new; end $$;
create trigger trg_lock_notification before update on notifications for each row execute function lock_notification_fields();

create function notify_submission_change() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status and new.status in ('under_review','changes_requested','approved','rejected') then
    insert into notifications(user_id, kind, title, body, link) values (new.user_id, 'submission',
      case new.status when 'approved' then 'Your submission was approved' when 'rejected' then 'Your submission was not accepted'
                      when 'changes_requested' then 'Changes requested on your submission' else 'Your submission is under review' end,
      '“' || left(new.title, 120) || '”' || coalesce(E'\n' || nullif(new.editor_feedback,''), ''), '/account/#posts');
  end if;
  return new;
end $$;
create trigger trg_notify_submission after update on submissions for each row execute function notify_submission_change();

-- ---------- discussion room (Realtime) ----------
create table chat_messages (
  id uuid primary key default gen_random_uuid(), room text not null default 'general',
  user_id uuid not null references auth.users(id) on delete cascade, author_name text not null default 'Member',
  body text not null check (char_length(trim(body)) between 1 and 500), created_at timestamptz not null default now()
);
create index on chat_messages (room, created_at desc);
alter table chat_messages enable row level security;
create policy "anyone reads chat" on chat_messages for select to anon, authenticated using (true);
create policy "members post" on chat_messages for insert to authenticated with check (user_id = auth.uid() and not is_banned());
create policy "delete own or admin" on chat_messages for delete to authenticated using (user_id = auth.uid() or is_editor());
create function chat_before_insert() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from chat_messages where user_id = new.user_id and created_at > now() - interval '2 seconds') then raise exception 'Slow down a little.'; end if;
  new.author_name := coalesce(nullif((select display_name from profiles where id = new.user_id), ''), 'Member');
  return new;
end $$;
create trigger trg_chat_before_insert before insert on chat_messages for each row execute function chat_before_insert();
do $$ begin
  alter publication supabase_realtime add table chat_messages;
exception when others then
  raise warning 'Could not add chat_messages to the realtime publication (%). Switch it on in Dashboard > Database > Publications.', sqlerrm;
end $$;

-- ---------- proverbs and quiz (managed by editors; nothing seeded) ----------
create table proverbs (id uuid primary key default gen_random_uuid(), text_original text not null, translation text not null, meaning text, source text, status publish_status not null default 'draft', created_at timestamptz not null default now());
create table quiz_questions (id uuid primary key default gen_random_uuid(), question text not null, options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 6), answer_index int not null check (answer_index >= 0), explanation text, community_id uuid references communities(id), status publish_status not null default 'draft', created_at timestamptz not null default now());
do $$ declare t text; begin
  foreach t in array array['proverbs','quiz_questions'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "public reads published" on %I for select to anon, authenticated using (status = ''published'')', t);
    execute format('create policy "editors read all" on %I for select to authenticated using (is_editor())', t);
    execute format('create policy "editors write" on %I for insert to authenticated with check (is_editor())', t);
    execute format('create policy "editors update" on %I for update to authenticated using (is_editor()) with check (is_editor())', t);
    execute format('create policy "admins delete" on %I for delete to authenticated using (has_role(''admin''))', t);
  end loop; end $$;

-- ---------- approval: approving PUBLISHES (article/event) or applies the edit ----------
create function slug_from(t text) returns text language sql volatile as $$
  select trim(both '-' from regexp_replace(immutable_fold(t), '[^a-z0-9]+', '-', 'g')) || '-' || left(replace(gen_random_uuid()::text, '-', ''), 6)
$$;
create function approve_submission(sub_id uuid, feedback text default null) returns void language plpgsql security definer set search_path = public as $$
declare s submissions; p jsonb; tgt uuid;
begin
  if not is_editor() then raise exception 'forbidden'; end if;
  select * into s from submissions where id = sub_id for update;
  if not found then raise exception 'Submission not found'; end if;
  if s.status = 'approved' then raise exception 'Already approved'; end if;
  p := s.payload;
  if s.kind = 'article' then
    insert into articles(slug, community_id, region_text, topic, title, summary, body, author_id, author_credit, sources, status, published_at, last_reviewed_at, source_submission_id, created_by)
    values (slug_from(s.title), s.community_id, s.region_text, coalesce(nullif(p->>'topic',''), 'culture')::article_topic, s.title, p->>'summary', coalesce(p->>'body',''), s.user_id,
            nullif(p->>'author_credit',''), p->>'sources', 'published', now(), now(), s.id, auth.uid());
  elsif s.kind = 'event' then
    insert into events(slug, name, community_id, summary, body, location_text, region_text, date_start, date_end, organiser, confidence, evidence, status, author_id, last_reviewed_at, created_by)
    values (slug_from(s.title), s.title, s.community_id, p->>'summary', p->>'body', p->>'location', s.region_text, nullif(p->>'date_start','')::date, nullif(p->>'date_end','')::date,
            p->>'organiser', 'tentative', 'community_submitted', 'published', s.user_id, now(), auth.uid());
  elsif s.kind = 'edit' and nullif(p->>'target_id','') is not null then
    tgt := (p->>'target_id')::uuid;
    if p->>'target_type' = 'article' then
      update articles set title = coalesce(nullif(p->>'proposed_title',''), title), summary = coalesce(nullif(p->>'proposed_summary',''), summary), body = coalesce(nullif(p->>'proposed_body',''), body), last_reviewed_at = now() where id = tgt;
    elsif p->>'target_type' = 'event' then
      update events set name = coalesce(nullif(p->>'proposed_title',''), name), summary = coalesce(nullif(p->>'proposed_summary',''), summary), body = coalesce(nullif(p->>'proposed_body',''), body), last_reviewed_at = now() where id = tgt;
    end if;
  end if;
  update submissions set status = 'approved', editor_feedback = feedback where id = sub_id;
  insert into moderation_decisions(submission_id, decided_by, decision, notes) values (sub_id, auth.uid(), 'approved', feedback);
end $$;

-- ---------- admin: messaging, bans, user edit/delete ----------
create function admin_send_notification(audience text, emails text[], n_title text, n_body text, n_link text default null) returns int
language plpgsql security definer set search_path = public as $$
declare c int;
begin
  if not has_role('admin') then raise exception 'forbidden'; end if;
  if char_length(trim(coalesce(n_title,''))) = 0 then raise exception 'Title is required'; end if;
  insert into notifications(user_id, kind, title, body, link)
  select u.id, 'message', n_title, n_body, n_link from auth.users u
  where case audience
    when 'all' then true
    when 'editors' then exists (select 1 from user_roles r where r.user_id = u.id and r.role in ('community_editor','research_editor','admin'))
    when 'contributors' then exists (select 1 from submissions s where s.user_id = u.id)
    when 'selected' then lower(u.email) = any (select lower(x) from unnest(emails) x)
    else false end;
  get diagnostics c = row_count; return c;
end $$;

create function admin_set_ban(target uuid, ban boolean, reason text default null) returns void language plpgsql security definer set search_path = public as $$
begin
  if not has_role('admin') then raise exception 'forbidden'; end if;
  if target = auth.uid() then raise exception 'You cannot ban yourself.'; end if;
  update profiles set banned = ban, banned_reason = case when ban then reason else null end where id = target;
end $$;

create function admin_edit_user(target uuid, new_name text) returns void language plpgsql security definer set search_path = public as $$
begin
  if not has_role('admin') then raise exception 'forbidden'; end if;
  update profiles set display_name = left(new_name, 80) where id = target;
end $$;

create function admin_delete_user(target uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if not has_role('admin') then raise exception 'forbidden'; end if;
  if target = auth.uid() then raise exception 'Use the danger zone in Settings to delete your own account.'; end if;
  if exists (select 1 from user_roles where user_id = target and role = 'admin') and (select count(*) from user_roles where role = 'admin') <= 1 then raise exception 'Cannot delete the last administrator.'; end if;
  delete from auth.users where id = target;
end $$;

create function delete_my_account() returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if exists (select 1 from user_roles where user_id = auth.uid() and role = 'admin') and (select count(*) from user_roles where role = 'admin') <= 1 then
    raise exception 'You are the only administrator. Promote another administrator first.'; end if;
  delete from auth.users where id = auth.uid();
end $$;

drop function admin_list_users();
create function admin_list_users() returns table(id uuid, email text, display_name text, roles text[], banned boolean, created_at timestamptz, last_sign_in_at timestamptz, submissions bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not has_role('admin') then raise exception 'forbidden'; end if;
  return query select u.id, u.email::text, p.display_name,
    coalesce((select array_agg(r.role::text order by r.role) from user_roles r where r.user_id = u.id), '{}'),
    coalesce(p.banned, false), u.created_at, u.last_sign_in_at, (select count(*) from submissions s where s.user_id = u.id)
  from auth.users u left join profiles p on p.id = u.id order by u.created_at desc limit 500;
end $$;

revoke all on function approve_submission(uuid,text), admin_send_notification(text,text[],text,text,text), admin_set_ban(uuid,boolean,text), admin_edit_user(uuid,text), admin_delete_user(uuid), delete_my_account(), admin_list_users(), slug_from(text) from public, anon;
grant execute on function approve_submission(uuid,text), admin_send_notification(text,text[],text,text,text), admin_set_ban(uuid,boolean,text), admin_edit_user(uuid,text), admin_delete_user(uuid), delete_my_account(), admin_list_users() to authenticated;
