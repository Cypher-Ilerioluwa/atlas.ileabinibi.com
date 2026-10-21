-- Run any time. Shows one row per check with OK or MISSING. Nothing is changed.
select item, expected, found, case when ok then 'OK' else 'MISSING' end as status from (
  select 'Tables created' as item, '33' as expected, count(*)::text as found, count(*) >= 33 as ok
    from pg_tables where schemaname = 'public'
  union all
  select 'Tables with security (RLS) OFF', '0', count(*)::text, count(*) = 0
    from pg_tables where schemaname = 'public' and not rowsecurity
  union all
  select 'Public views', '11', count(*)::text, count(*) >= 11
    from pg_views where schemaname = 'public' and viewname like '%\_public' escape '\'
  union all
  select 'Key functions (has_role, is_editor, approve_submission, admin_list_users, admin_set_role, admin_send_notification, delete_my_account, search_public, ensure_contributor, admin_set_credits)', '10', count(*)::text, count(*) = 10
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('has_role','is_editor','approve_submission','admin_list_users','admin_set_role','admin_send_notification','delete_my_account','search_public','ensure_contributor','admin_set_credits')
  union all
  select 'Sign-up trigger on auth.users', '1', count(*)::text, count(*) = 1
    from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'auth' and c.relname = 'users' and t.tgname = 'on_auth_user_created'
  union all
  select 'Admin trigger on auth.users', '1', count(*)::text, count(*) = 1
    from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'auth' and c.relname = 'users' and t.tgname = 'bootstrap_admin'
  union all
  select 'Storage buckets (public-media, avatars, private-submissions)', '3', count(*)::text, count(*) = 3
    from storage.buckets where id in ('public-media','avatars','private-submissions')
  union all
  select 'Private bucket is private', '1', count(*)::text, count(*) = 1
    from storage.buckets where id = 'private-submissions' and not public
  union all
  select 'Storage access rules (policies)', '10', count(*)::text, count(*) >= 10
    from pg_policies where schemaname = 'storage' and tablename = 'objects'
      and policyname in ('public media readable','editors write public media','editors update public media','own submission upload','own submission read','own submission delete','avatars readable','own avatar write','own avatar update','own avatar delete')
  union all
  select 'Live chat switched on (realtime: messages, reactions, read receipts)', '3', count(*)::text, count(*) = 3
    from pg_publication_tables where pubname = 'supabase_realtime' and tablename in ('chat_messages','chat_reactions','chat_reads')
) c order by ok, item;
