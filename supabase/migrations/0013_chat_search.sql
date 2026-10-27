-- 0013: search inside chat messages (all rooms, or one room), ignoring accents and capital letters:
-- typing "ibadan" finds "Ìbàdàn", "ose" finds "ọ̀ṣẹ̀". Run after 0012. Safe to run more than once.
create extension if not exists unaccent with schema extensions;

create index if not exists chat_messages_room_created_idx on chat_messages (room, created_at desc);

-- p_query: the words to find in the message text or the sender's name (2+ letters)
-- p_room:  only this room (empty = every room)
-- p_kind:  'photo' = messages with a photo, 'link' = messages with a web link or shared music (empty = all)
create or replace function search_chat(p_query text default '', p_room text default null, p_kind text default null, p_limit int default 40)
returns setof chat_messages
language sql stable
set search_path = public, extensions
as $$
  with q as (
    select case when length(trim(coalesce(p_query, ''))) >= 2
                then '%' || unaccent(lower(replace(replace(replace(trim(p_query), '\', '\\'), '%', '\%'), '_', '\_'))) || '%' end as pat
  )
  select m.* from chat_messages m, q
  where (p_room is null or m.room = p_room)
    and (p_kind is null or (p_kind = 'photo' and m.image_path is not null) or (p_kind = 'link' and m.body ~* '(https?://|/media/\?m=)'))
    and ((q.pat is null and p_kind is not null)
         or (q.pat is not null and (unaccent(lower(m.body)) like q.pat escape '\' or unaccent(lower(m.author_name)) like q.pat escape '\')))
  order by m.created_at desc
  limit least(greatest(coalesce(p_limit, 40), 1), 100)
$$;
grant execute on function search_chat(text, text, text, int) to anon, authenticated;

notify pgrst, 'reload schema';
