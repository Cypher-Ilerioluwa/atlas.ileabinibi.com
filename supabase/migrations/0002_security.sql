-- Row Level Security, roles, public views, storage and audit triggers.
create function has_role(r app_role) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles where user_id = auth.uid() and role = r)
$$;
create function is_editor() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles where user_id = auth.uid() and role in ('community_editor','research_editor','admin'))
$$;
create function touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

-- New user: create profile + preferences. Roles are never granted here.
create function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles(id, display_name) values (new.id, left(coalesce(new.raw_user_meta_data->>'display_name',''), 80));
  insert into notification_prefs(user_id) values (new.id);
  return new;
end $$;
do $$ begin
  create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();
exception when insufficient_privilege then
  raise warning 'Could not create the sign-up trigger on auth.users (permission). Run 0006_selfcheck.sql and see the guide, section "If a check says MISSING".';
end $$;

-- Audit trail (written by trusted triggers only; clients have no insert policy).
create function log_change() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into audit_log(actor_id, action, target_type, target_id, detail)
  values (auth.uid(), tg_op, tg_table_name, coalesce((to_jsonb(new)->>'id'), (to_jsonb(old)->>'id'), (to_jsonb(new)->>'user_id')),
          jsonb_build_object('new_status', to_jsonb(new)->>'status', 'old_status', to_jsonb(old)->>'status'));
  return null;
end $$;

do $$
declare t text;
begin
  -- content tables: editors manage everything; visitors read ONLY through *_public views
  foreach t in array array['communities','community_names','heritage_records','landmarks','events','people','institutions','organisations','family_histories','sources','record_sources','record_relations','media_assets','calendar_observances'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "editors read" on %I for select to authenticated using (is_editor())', t);
    execute format('create policy "editors insert" on %I for insert to authenticated with check (is_editor())', t);
    execute format('create policy "editors update" on %I for update to authenticated using (is_editor()) with check (is_editor())', t);
    execute format('create policy "admins delete" on %I for delete to authenticated using (has_role(''admin''))', t);
  end loop;
  foreach t in array array['communities','heritage_records','landmarks','events','people','institutions','organisations','family_histories','submissions','profiles'] loop
    execute format('create trigger %I before update on %I for each row execute function touch_updated_at()', 'trg_touch_'||t, t);
  end loop;
  foreach t in array array['communities','heritage_records','landmarks','events','people','institutions','organisations','family_histories','submissions','user_roles','correction_requests'] loop
    execute format('create trigger %I after insert or update or delete on %I for each row execute function log_change()', 'trg_audit_'||t, t);
  end loop;
end $$;

-- Public views: published rows only, internal columns removed, sensitive coordinates withheld.
create view communities_public as
  select id, slug, preferred_name, kind, country, admin_area,
         case when coord_sensitive then null else lat end as lat, case when coord_sensitive then null else lng end as lng,
         coord_source, coord_precision, coord_verified, summary, body, evidence, last_reviewed_at
  from communities where status = 'published';
create view landmarks_public as
  select id, slug, name, community_id, summary, body,
         case when coord_sensitive then null else lat end as lat, case when coord_sensitive then null else lng end as lng,
         coord_source, coord_precision, coord_verified, visitor_info, evidence, last_reviewed_at
  from landmarks where status = 'published';
create view heritage_records_public as
  select id, slug, category, title, summary, body, community_id, period_text, language, evidence, rights, reuse_terms, contributor_credit, last_reviewed_at
  from heritage_records where status = 'published';
create view events_public as
  select id, slug, name, alt_names, community_id, landmark_id, summary, significance, location_text, date_start, date_end, confidence, recurrence_note, organiser, public_contact, evidence, last_reviewed_at
  from events where status = 'published';
create view people_public as
  select id, slug, preferred_name, alt_names, summary, body, evidence, last_reviewed_at from people where status = 'published' and (not living or consent_confirmed);
create view institutions_public as
  select id, slug, name, community_id, summary, body, evidence, last_reviewed_at from institutions where status = 'published';
create view organisations_public as
  select id, slug, name, category, community_id, summary, service_area, public_contact, verified, last_confirmed_at from organisations where status = 'published';
create view family_histories_public as
  select id, slug, family_name, community_id, summary, body, evidence from family_histories where status = 'published' and consent_confirmed;
create view community_names_public as
  select n.id, n.community_id, n.name, n.kind from community_names n join communities c on c.id = n.community_id and c.status = 'published';
create view media_public as
  select id, record_type, record_id, path, mime, alt_text, credit from media_assets where is_public and rights = 'cleared' and bucket = 'public-media';
revoke all on communities_public, landmarks_public, heritage_records_public, events_public, people_public, institutions_public, organisations_public, family_histories_public, community_names_public, media_public from public, anon, authenticated;
grant select on communities_public, landmarks_public, heritage_records_public, events_public, people_public, institutions_public, organisations_public, family_histories_public, community_names_public, media_public to anon, authenticated;

-- Global search over published content only, tolerant of diacritics.
create function search_public(q text, lim int default 20) returns table(kind text, slug text, title text, summary text)
language sql stable security definer set search_path = public as $$
  with t as (select plainto_tsquery('simple', immutable_fold(q)) as tsq, immutable_fold(q) as folded)
  select 'community', c.slug, c.preferred_name, c.summary from communities c, t where c.status='published' and (c.search @@ t.tsq or exists (select 1 from community_names n where n.community_id=c.id and n.name_folded like '%'||t.folded||'%'))
  union all
  select 'heritage', h.slug, h.title, h.summary from heritage_records h, t where h.status='published' and h.search @@ t.tsq
  limit least(coalesce(lim,20), 50)
$$;
revoke all on function search_public(text,int) from public; grant execute on function search_public(text,int) to anon, authenticated;

-- Profiles, roles, per-user tables
alter table profiles enable row level security;
create policy "own profile read" on profiles for select to authenticated using (id = auth.uid() or is_editor());
create policy "own profile update" on profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

alter table user_roles enable row level security;
create policy "read own roles" on user_roles for select to authenticated using (user_id = auth.uid() or has_role('admin'));
create policy "admins grant" on user_roles for insert to authenticated with check (has_role('admin'));
create policy "admins revoke" on user_roles for delete to authenticated using (has_role('admin'));
-- No update policy: roles are granted or revoked, never edited. First admin is inserted manually with the service role.

alter table submissions enable row level security;
create policy "own or editor read" on submissions for select to authenticated using (user_id = auth.uid() or is_editor());
create policy "create own" on submissions for insert to authenticated with check (user_id = auth.uid() and status in ('draft','submitted'));
create policy "edit own before review" on submissions for update to authenticated
  using (user_id = auth.uid() and status in ('draft','changes_requested')) with check (user_id = auth.uid() and status in ('draft','submitted'));
create policy "editors review" on submissions for update to authenticated using (is_editor()) with check (is_editor());
create policy "delete own draft" on submissions for delete to authenticated using (user_id = auth.uid() and status = 'draft');

alter table moderation_decisions enable row level security;
create policy "editors read decisions" on moderation_decisions for select to authenticated using (is_editor());
create policy "editors record decisions" on moderation_decisions for insert to authenticated with check (is_editor() and decided_by = auth.uid());

alter table correction_requests enable row level security;
create policy "anyone files a correction" on correction_requests for insert to anon, authenticated with check (user_id is null or user_id = auth.uid());
create policy "owner or editor read" on correction_requests for select to authenticated using (user_id = auth.uid() or is_editor());
create policy "editors update" on correction_requests for update to authenticated using (is_editor()) with check (is_editor());

alter table saved_records enable row level security;
create policy "own saved" on saved_records for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
alter table notification_prefs enable row level security;
create policy "own prefs" on notification_prefs for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
alter table push_subscriptions enable row level security;
create policy "own subs" on push_subscriptions for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
alter table event_reminders enable row level security;
create policy "own reminders" on event_reminders for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
alter table audit_log enable row level security;
create policy "admins read audit" on audit_log for select to authenticated using (has_role('admin'));

-- Storage buckets and policies live in 0005_storage.sql.
