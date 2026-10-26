-- 0012: push notifications to EVERYONE for every new chat message, shared song and new article / event / record.
-- Run after 0011. Needs the Netlify function "notify-new" (docs/GO_LIVE.md, Part V).
--
-- >>> BEFORE YOU RUN: change PASTE-THE-SAME-SECRET-AS-IN-NETLIFY (about 25 lines down) to the long random text
-- >>> you saved in Netlify as PUSH_WEBHOOK_SECRET. Never commit the real secret to GitHub.
-- Safe to run more than once. If the secret is left as PASTE-..., an already saved secret is kept.

create extension if not exists pg_net;

-- each person can switch these off in Settings > Notifications (everyone starts with them ON)
alter table notification_prefs add column if not exists new_content boolean not null default true;
alter table notification_prefs add column if not exists chat_messages boolean not null default true;

-- where to send the news. Only the trigger below can read this table (no policies, no access for the app).
create table if not exists push_hook_config (id int primary key default 1 check (id = 1), url text not null, secret text not null);
alter table push_hook_config enable row level security;
revoke all on push_hook_config from anon, authenticated;
insert into push_hook_config (id, url, secret)
values (1, 'https://atlas.ileabinibi.com/.netlify/functions/notify-new', 'PASTE-THE-SAME-SECRET-AS-IN-NETLIFY')
on conflict (id) do update set url = excluded.url,
  secret = case when excluded.secret like 'PASTE-%' then push_hook_config.secret else excluded.secret end;

-- the trigger: tell the Netlify function that something new exists. It never blocks or breaks the original save.
create or replace function push_notify_new() returns trigger language plpgsql security definer set search_path = public as $$
declare cfg record; rec jsonb := to_jsonb(new);
begin
  -- an edit only matters when the status changes (for example a draft becomes published)
  if tg_op = 'UPDATE' and (rec ->> 'status') is not distinct from (to_jsonb(old) ->> 'status') then return null; end if;
  select url, secret into cfg from public.push_hook_config where id = 1;
  if cfg.url is null or cfg.secret like 'PASTE-%' then return null; end if;
  perform net.http_post(
    url := cfg.url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', cfg.secret),
    body := jsonb_build_object('type', tg_op, 'table', tg_table_name,
              'record', rec - 'body' - 'body_html' - 'search' - 'payload' - 'sources',
              'old_record', case when tg_op = 'UPDATE' then jsonb_build_object('status', to_jsonb(old) ->> 'status') else null end),
    timeout_milliseconds := 5000);
  return null;
exception when others then
  return null;
end $$;

drop trigger if exists trg_push_new on chat_messages;
create trigger trg_push_new after insert on chat_messages for each row execute function push_notify_new();
drop trigger if exists trg_push_new on media_shares;
create trigger trg_push_new after insert on media_shares for each row execute function push_notify_new();
drop trigger if exists trg_push_new on articles;
create trigger trg_push_new after insert or update on articles for each row execute function push_notify_new();
drop trigger if exists trg_push_new on events;
create trigger trg_push_new after insert or update on events for each row execute function push_notify_new();
drop trigger if exists trg_push_new on heritage_records;
create trigger trg_push_new after insert or update on heritage_records for each row execute function push_notify_new();
drop trigger if exists trg_push_new on landmarks;
create trigger trg_push_new after insert or update on landmarks for each row execute function push_notify_new();
drop trigger if exists trg_push_new on people;
create trigger trg_push_new after insert or update on people for each row execute function push_notify_new();
drop trigger if exists trg_push_new on institutions;
create trigger trg_push_new after insert or update on institutions for each row execute function push_notify_new();
drop trigger if exists trg_push_new on organisations;
create trigger trg_push_new after insert or update on organisations for each row execute function push_notify_new();

notify pgrst, 'reload schema';
