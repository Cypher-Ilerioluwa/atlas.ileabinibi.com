-- Ilẹ̀ Abínibí Atlas: core schema. NOT YET RUN against a live Supabase project; run in a
-- development project first and execute the policy tests in docs/TESTING.md.
create type app_role as enum ('contributor','community_editor','research_editor','admin');
create type evidence_status as enum ('documented','oral_tradition','scholarly_interpretation','disputed','community_submitted','under_review');
create type publish_status as enum ('draft','published','archived');
create type submission_status as enum ('draft','submitted','under_review','changes_requested','approved','rejected');
create type date_confidence as enum ('confirmed','tentative','recurring_variable');
create type rights_status as enum ('cleared','pending','restricted');
create type record_category as enum ('oral_history','document','photograph','audio','video','biography','proverb','folktale','craft','practice','timeline','research_note','terminology','community_record','article');

-- Accent/tone-mark folding for search (ẹ̀ -> e, ṣ -> s). Display text is never altered.
create function immutable_fold(t text) returns text language sql immutable parallel safe as $$
  select lower(regexp_replace(normalize(coalesce(t,''), NFD), '[' || chr(768) || '-' || chr(879) || ']', '', 'g'))
$$;

-- People and roles. Roles live in their own table so users cannot edit them via a profile row.
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  avatar_path text, bio text check (char_length(bio) <= 600),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  granted_by uuid references auth.users(id), granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table sources (
  id uuid primary key default gen_random_uuid(),
  title text not null, author text, publisher text, url text, year int, kind text,
  notes text, created_at timestamptz not null default now()
);

-- Public content tables (status = published is what visitors may see, via *_public views).
create table communities (
  id uuid primary key default gen_random_uuid(), slug text unique not null,
  preferred_name text not null, kind text not null check (kind in ('town','kingdom','community','diaspora')),
  country text not null, admin_area text,
  lat double precision check (lat between -90 and 90), lng double precision check (lng between -180 and 180),
  coord_source text, coord_precision text, coord_verified boolean not null default false, coord_sensitive boolean not null default false,
  summary text, body text, evidence evidence_status not null default 'under_review',
  status publish_status not null default 'draft', last_reviewed_at timestamptz,
  created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  search tsvector generated always as (to_tsvector('simple', immutable_fold(preferred_name || ' ' || coalesce(summary,'') || ' ' || country))) stored
);
create table community_names (
  id uuid primary key default gen_random_uuid(), community_id uuid not null references communities(id) on delete cascade,
  name text not null, kind text not null default 'alternative' check (kind in ('alternative','historical','spelling')), name_folded text generated always as (immutable_fold(name)) stored
);
create table heritage_records (
  id uuid primary key default gen_random_uuid(), slug text unique not null,
  category record_category not null, title text not null, summary text, body text,
  community_id uuid references communities(id), period_text text, language text,
  evidence evidence_status not null default 'under_review', rights rights_status not null default 'pending', reuse_terms text, contributor_credit text,
  status publish_status not null default 'draft', last_reviewed_at timestamptz,
  created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  search tsvector generated always as (to_tsvector('simple', immutable_fold(title || ' ' || coalesce(summary,'')))) stored
);
create table landmarks (
  id uuid primary key default gen_random_uuid(), slug text unique not null, name text not null,
  community_id uuid references communities(id), summary text, body text,
  lat double precision check (lat between -90 and 90), lng double precision check (lng between -180 and 180),
  coord_source text, coord_precision text, coord_verified boolean not null default false, coord_sensitive boolean not null default false,
  visitor_info text, evidence evidence_status not null default 'under_review',
  status publish_status not null default 'draft', last_reviewed_at timestamptz,
  created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table events (
  id uuid primary key default gen_random_uuid(), slug text unique not null, name text not null, alt_names text[],
  community_id uuid references communities(id), landmark_id uuid references landmarks(id),
  summary text, significance text, location_text text,
  date_start date, date_end date, confidence date_confidence not null default 'tentative', recurrence_note text,
  organiser text, public_contact text, evidence evidence_status not null default 'under_review',
  status publish_status not null default 'draft', last_reviewed_at timestamptz,
  created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (date_end is null or date_start is null or date_end >= date_start)
);
create table people (
  id uuid primary key default gen_random_uuid(), slug text unique not null, preferred_name text not null, alt_names text[],
  summary text, body text, living boolean not null default false, consent_confirmed boolean not null default false,
  evidence evidence_status not null default 'under_review', status publish_status not null default 'draft', last_reviewed_at timestamptz,
  created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (not (living and status = 'published' and not consent_confirmed))
);
create table institutions (
  id uuid primary key default gen_random_uuid(), slug text unique not null, name text not null, community_id uuid references communities(id),
  summary text, body text, evidence evidence_status not null default 'under_review',
  status publish_status not null default 'draft', last_reviewed_at timestamptz,
  created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table organisations (
  id uuid primary key default gen_random_uuid(), slug text unique not null, name text not null, category text not null,
  community_id uuid references communities(id), summary text, service_area text, public_contact text,
  verified boolean not null default false, last_confirmed_at timestamptz,
  status publish_status not null default 'draft',
  created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table family_histories (
  id uuid primary key default gen_random_uuid(), slug text unique not null, family_name text not null, community_id uuid references communities(id),
  summary text, body text, consent_confirmed boolean not null default false, evidence evidence_status not null default 'community_submitted',
  status publish_status not null default 'draft',
  created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (status <> 'published' or consent_confirmed)
);

-- Cross-cutting
create table record_sources (record_type text not null, record_id uuid not null, source_id uuid not null references sources(id) on delete cascade, citation_note text, primary key (record_type, record_id, source_id));
create table record_relations (id uuid primary key default gen_random_uuid(), from_type text not null, from_id uuid not null, to_type text not null, to_id uuid not null, relation text not null);
create table media_assets (
  id uuid primary key default gen_random_uuid(), record_type text, record_id uuid,
  bucket text not null check (bucket in ('public-media','private-submissions')), path text not null,
  mime text not null, bytes bigint not null check (bytes > 0), alt_text text, credit text,
  rights rights_status not null default 'pending', is_public boolean not null default false,
  uploaded_by uuid references auth.users(id), created_at timestamptz not null default now(),
  check (not is_public or (rights = 'cleared' and bucket = 'public-media')), unique (bucket, path)
);
create table calendar_observances (
  id uuid primary key default gen_random_uuid(), name text not null, event_id uuid references events(id),
  -- Kọ́jọ́dá position is stored as data, but only entered once the calendar module is verified.
  kojoda_ref jsonb, gregorian_month smallint, gregorian_day smallint, description text, confidence date_confidence not null default 'tentative',
  status publish_status not null default 'draft'
);

-- Submissions and moderation (private by default)
create table submissions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('heritage_record','photograph','audio','document','festival','landmark','community','correction','other')),
  title text not null check (char_length(title) <= 200), payload jsonb not null default '{}'::jsonb,
  consent_given boolean not null default false, media_permission text,
  status submission_status not null default 'draft', editor_feedback text, assigned_to uuid references auth.users(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table moderation_decisions (
  id uuid primary key default gen_random_uuid(), submission_id uuid not null references submissions(id) on delete cascade,
  decided_by uuid not null references auth.users(id), decision submission_status not null, notes text, created_at timestamptz not null default now()
);
create table correction_requests (
  id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete set null,
  record_type text not null, record_id uuid, message text not null check (char_length(message) between 10 and 4000),
  contact_email text, status text not null default 'open' check (status in ('open','in_review','resolved','declined')),
  created_at timestamptz not null default now()
);

-- Per-user data
create table saved_records (user_id uuid not null references auth.users(id) on delete cascade, record_type text not null, record_id uuid not null, created_at timestamptz not null default now(), primary key (user_id, record_type, record_id));
create table notification_prefs (user_id uuid primary key references auth.users(id) on delete cascade, submission_updates boolean not null default true, event_reminders boolean not null default true, announcements boolean not null default false, updated_at timestamptz not null default now());
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique, p256dh text not null, auth text not null, user_agent text, created_at timestamptz not null default now(), expired_at timestamptz
);
create table event_reminders (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, event_id uuid not null references events(id) on delete cascade, remind_at timestamptz not null, sent_at timestamptz, unique (user_id, event_id, remind_at));
create table audit_log (id bigint generated always as identity primary key, actor_id uuid, action text not null, target_type text not null, target_id text, detail jsonb, at timestamptz not null default now());

create index on communities using gin (search);
create index on heritage_records using gin (search);
create index on community_names (name_folded);
create index on heritage_records (community_id); create index on events (date_start);
create index on submissions (user_id, status); create index on record_sources (record_type, record_id);
create index on push_subscriptions (user_id); create index on event_reminders (remind_at) where sent_at is null;
