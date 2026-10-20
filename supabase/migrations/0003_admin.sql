-- Admin bootstrap and admin-only functions. Authorisation lives HERE (database), not in the browser.

-- 1) The owner's email becomes admin automatically, but ONLY once the address is confirmed
--    (Supabase sets email_confirmed_at after the user clicks the confirmation link), so nobody
--    can claim the role by merely signing up with that address.
create function grant_bootstrap_admin() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if lower(new.email) = 'cypherilerioluwa@gmail.com' and new.email_confirmed_at is not null then
    insert into user_roles(user_id, role, granted_by) values (new.id, 'admin'::app_role, new.id) on conflict do nothing;
  end if;
  return new;
end $$;
do $$ begin
  create trigger bootstrap_admin after insert or update of email, email_confirmed_at on auth.users
    for each row execute function grant_bootstrap_admin();
exception when insufficient_privilege then
  raise warning 'Could not create the admin trigger on auth.users (permission). Run 0006_selfcheck.sql; the manual admin SQL in the guide still works.';
end $$;
-- If the account already exists and is confirmed, grant now.
insert into user_roles(user_id, role)
  select id, 'admin'::app_role from auth.users where lower(email) = 'cypherilerioluwa@gmail.com' and email_confirmed_at is not null
  on conflict do nothing;

-- 2) Admin-only user listing (auth.users is not readable from the browser).
create function admin_list_users() returns table(id uuid, email text, display_name text, roles text[], created_at timestamptz, last_sign_in_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not has_role('admin') then raise exception 'forbidden'; end if;
  return query
    select u.id, u.email::text, p.display_name,
           coalesce((select array_agg(r.role::text order by r.role) from user_roles r where r.user_id = u.id), '{}'),
           u.created_at, u.last_sign_in_at
    from auth.users u left join profiles p on p.id = u.id
    order by u.created_at desc limit 500;
end $$;

-- 3) Grant or revoke a role by email. Refuses to remove the last admin.
create function admin_set_role(target_email text, target_role app_role, make_grant boolean) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if not has_role('admin') then raise exception 'forbidden'; end if;
  select id into uid from auth.users where lower(email) = lower(trim(target_email));
  if uid is null then raise exception 'No user with that email. They must create an account first.'; end if;
  if make_grant then
    insert into user_roles(user_id, role, granted_by) values (uid, target_role, auth.uid()) on conflict do nothing;
  else
    if target_role = 'admin' and (select count(*) from user_roles where role = 'admin') <= 1 then
      raise exception 'Cannot remove the last administrator.';
    end if;
    delete from user_roles where user_id = uid and role = target_role;
  end if;
end $$;

revoke all on function admin_list_users() from public, anon;
revoke all on function admin_set_role(text, app_role, boolean) from public, anon;
grant execute on function admin_list_users() to authenticated;
grant execute on function admin_set_role(text, app_role, boolean) to authenticated;
