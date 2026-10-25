-- 0011: Ilẹ̀ Abínibí (https://ileabinibi.com/) is the author of ALL content in the Atlas.
-- Safe to run more than once. Run it after 0010. It does not delete anyone's credit: people who were
-- credited as author become contributors, and the author line always reads "Ilẹ̀ Abínibí".

-- 1. the author record
insert into contributors (slug, display_name, bio)
values ('ile-abinibi', 'Ilẹ̀ Abínibí', 'The Ilẹ̀ Abínibí team (https://ileabinibi.com/). Author of everything in the Atlas.')
on conflict (slug) do update set display_name = excluded.display_name, bio = excluded.bio;

-- 2. any other contributor stays credited, but as contributor, never as author
update content_contributors set role = 'contributor'
 where role = 'author' and contributor_id <> (select id from contributors where slug = 'ile-abinibi');

-- 3. add the author to every existing item (articles, events, records, landmarks, people, institutions, organisations)
do $$
declare hid uuid; v record;
begin
  select id into hid from contributors where slug = 'ile-abinibi';
  for v in select * from (values ('article','articles'), ('event','events'), ('heritage_record','heritage_records'), ('landmark','landmarks'),
                                 ('person','people'), ('institution','institutions'), ('organisation','organisations')) as x(ct, tbl)
  loop
    -- make room at position 0 (only for items that do not have the author yet, so a re-run changes nothing)
    execute format($q$
      update content_contributors cc set position = cc.position + 1
       where cc.content_type = %L and cc.contributor_id <> %L
         and not exists (select 1 from content_contributors h where h.content_type = cc.content_type and h.content_id = cc.content_id and h.contributor_id = %L)
         and exists (select 1 from %I t where t.id = cc.content_id)$q$, v.ct, hid, hid, v.tbl);
    execute format($q$
      insert into content_contributors (content_type, content_id, contributor_id, role, position)
      select %L, t.id, %L, 'author', 0 from %I t
      on conflict do nothing$q$, v.ct, hid, v.tbl);
  end loop;
end $$;

-- 4. the plain-text credit columns
update articles set author_credit = 'Ilẹ̀ Abínibí' where author_credit is distinct from 'Ilẹ̀ Abínibí';
update heritage_records set contributor_credit = 'Ilẹ̀ Abínibí' where contributor_credit is distinct from 'Ilẹ̀ Abínibí';

-- 5. from now on: nobody else can be saved as "author", and every new item gets the author automatically
create or replace function house_author_only() returns trigger language plpgsql security definer set search_path = public as $$
declare hid uuid;
begin
  if new.role = 'author' then
    select id into hid from contributors where slug = 'ile-abinibi';
    if hid is not null and new.contributor_id <> hid then new.role := 'contributor'; end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_house_author_only on content_contributors;
create trigger trg_house_author_only before insert or update on content_contributors for each row execute function house_author_only();

create or replace function add_house_author() returns trigger language plpgsql security definer set search_path = public as $$
declare hid uuid;
begin
  select id into hid from contributors where slug = 'ile-abinibi';
  if hid is not null then
    insert into content_contributors (content_type, content_id, contributor_id, role, position)
    values (tg_argv[0], new.id, hid, 'author', 0) on conflict do nothing;
  end if;
  return null;
end $$;
drop trigger if exists trg_house_author on articles;
create trigger trg_house_author after insert on articles for each row execute function add_house_author('article');
drop trigger if exists trg_house_author on events;
create trigger trg_house_author after insert on events for each row execute function add_house_author('event');
drop trigger if exists trg_house_author on heritage_records;
create trigger trg_house_author after insert on heritage_records for each row execute function add_house_author('heritage_record');
drop trigger if exists trg_house_author on landmarks;
create trigger trg_house_author after insert on landmarks for each row execute function add_house_author('landmark');
drop trigger if exists trg_house_author on people;
create trigger trg_house_author after insert on people for each row execute function add_house_author('person');
drop trigger if exists trg_house_author on institutions;
create trigger trg_house_author after insert on institutions for each row execute function add_house_author('institution');
drop trigger if exists trg_house_author on organisations;
create trigger trg_house_author after insert on organisations for each row execute function add_house_author('organisation');

-- refresh the web API's view of the database
notify pgrst, 'reload schema';
