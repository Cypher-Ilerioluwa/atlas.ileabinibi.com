-- 0015: "I'm going" on events. Members mark events they will attend; everyone can see the number going.
-- Run after 0014. Safe to run more than once.
create table if not exists event_rsvps (
  event_id uuid not null references events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
alter table event_rsvps enable row level security;

drop policy if exists "read own rsvps" on event_rsvps;
create policy "read own rsvps" on event_rsvps for select to authenticated using (user_id = auth.uid());
drop policy if exists "add own rsvp" on event_rsvps;
create policy "add own rsvp" on event_rsvps for insert to authenticated
  with check (user_id = auth.uid() and not is_banned() and exists (select 1 from events e where e.id = event_id and e.status = 'published'));
drop policy if exists "remove own rsvp" on event_rsvps;
create policy "remove own rsvp" on event_rsvps for delete to authenticated using (user_id = auth.uid());

-- only the number is public, never who is going
create or replace function event_rsvp_count(p_event uuid) returns int
language sql stable security definer set search_path = public as $$ select count(*)::int from event_rsvps where event_id = p_event $$;
grant execute on function event_rsvp_count(uuid) to anon, authenticated;
grant select, insert, delete on event_rsvps to authenticated;

notify pgrst, 'reload schema';
