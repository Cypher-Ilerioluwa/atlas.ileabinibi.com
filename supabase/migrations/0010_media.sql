-- 0010: Media. Members share music and playlists from active streaming platforms TO COMMUNITIES.
-- Only links from the supported platforms are accepted (checked here, in the database, not just in the browser).
create table media_shares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  community_id uuid not null references communities(id) on delete cascade,
  platform text not null default 'spotify' check (platform in ('spotify','apple_music','youtube','youtube_music','soundcloud','audiomack','deezer','tidal','boomplay')),
  kind text not null default 'track' check (kind in ('track','album','playlist','video','artist','show','episode')),
  url text not null check (char_length(url) between 12 and 500),
  title text not null check (char_length(trim(title)) between 1 and 120),
  artist text check (char_length(artist) <= 120),
  note text check (char_length(note) <= 280),
  cover_url text,
  invite boolean not null default false,
  listen_at timestamptz,
  shared_from uuid references media_shares(id) on delete set null,
  author_name text not null default 'Member', author_avatar text, author_role text,
  status text not null default 'published' check (status in ('published','hidden')),
  created_at timestamptz not null default now()
);
create index on media_shares (community_id, created_at desc);
create index on media_shares (status, created_at desc);
create index on media_shares (user_id, created_at desc);

create function media_before_insert() returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.url := trim(new.url);
  if new.url !~* '^https://' then raise exception 'Use a secure (https) link'; end if;
  new.platform := case
    when new.url ~* '^https://(www\.)?open\.spotify\.com/' then 'spotify'
    when new.url ~* '^https://(www\.)?(music|embed\.music)\.apple\.com/' then 'apple_music'
    when new.url ~* '^https://music\.youtube\.com/' then 'youtube_music'
    when new.url ~* '^https://((www|m)\.)?youtube\.com/' or new.url ~* '^https://youtu\.be/' then 'youtube'
    when new.url ~* '^https://(www\.)?soundcloud\.com/' then 'soundcloud'
    when new.url ~* '^https://(www\.)?audiomack\.com/' then 'audiomack'
    when new.url ~* '^https://(www\.)?deezer\.com/' then 'deezer'
    when new.url ~* '^https://((www|listen)\.)?tidal\.com/' then 'tidal'
    when new.url ~* '^https://((www|m)\.)?boomplay\.com/' then 'boomplay'
    else null end;
  if new.platform is null then raise exception 'Only links from Spotify, Apple Music, YouTube, YouTube Music, SoundCloud, Audiomack, Deezer, Tidal and Boomplay are accepted'; end if;
  if not exists (select 1 from communities where id = new.community_id and status = 'published') then raise exception 'Choose a community to share with'; end if;
  if exists (select 1 from media_shares where user_id = new.user_id and created_at > now() - interval '20 seconds') then raise exception 'Slow down a little.'; end if;
  if (select count(*) from media_shares where user_id = new.user_id and created_at > now() - interval '1 day') >= 15 then raise exception 'You have reached today''s sharing limit.'; end if;
  if new.cover_url is not null and new.cover_url !~* '^https://' then new.cover_url := null; end if;
  select coalesce(nullif(display_name, ''), 'Member'), avatar_path into new.author_name, new.author_avatar from profiles where id = new.user_id;
  new.author_name := coalesce(new.author_name, 'Member');
  new.author_role := case when exists (select 1 from user_roles where user_id = new.user_id and role = 'admin') then 'admin'
                          when exists (select 1 from user_roles where user_id = new.user_id and role in ('community_editor','research_editor')) then 'editor' else null end;
  new.status := 'published';
  return new;
end $$;
create trigger trg_media_before_insert before insert on media_shares for each row execute function media_before_insert();

-- an invitation also appears in that community's chat room
create function media_after_insert() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.invite then
    begin
      insert into chat_messages(room, user_id, body)
        select c.slug, new.user_id, left('🎧 Listen with me: ' || new.title, 150) || E'\n/media/?m=' || new.id from communities c where c.id = new.community_id;
    exception when others then null; end;
  end if;
  return null;
end $$;
create trigger trg_media_after_insert after insert on media_shares for each row execute function media_after_insert();

create function media_lock_fields() returns trigger language plpgsql as $$
begin new.user_id := old.user_id; new.community_id := old.community_id; new.url := old.url; new.platform := old.platform; new.created_at := old.created_at; return new; end $$;
create trigger trg_media_lock before update on media_shares for each row execute function media_lock_fields();

alter table media_shares enable row level security;
create policy "anyone reads shared music" on media_shares for select to anon, authenticated using (status = 'published' or is_editor());
create policy "members share music" on media_shares for insert to authenticated with check (user_id = auth.uid() and not is_banned());
create policy "editors moderate music" on media_shares for update to authenticated using (is_editor()) with check (is_editor());
create policy "delete own or editor" on media_shares for delete to authenticated using (user_id = auth.uid() or is_editor());
