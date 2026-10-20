-- DANGER: deletes everything the Atlas migrations created (tables, data, functions, buckets' policies).
-- Use ONLY on a brand-new or throw-away project, to start again after a failed attempt.
-- It does not delete your Supabase user accounts (auth.users).

do $$ begin
  begin drop trigger if exists on_auth_user_created on auth.users; exception when others then null; end;
  begin drop trigger if exists bootstrap_admin on auth.users; exception when others then null; end;
end $$;

do $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname = 'storage' and tablename = 'objects'
           and policyname in ('public media readable','editors write public media','editors update public media','own submission upload','own submission read','own submission delete','avatars readable','own avatar write','own avatar update','own avatar delete') loop
    begin execute format('drop policy %I on storage.objects', r.policyname); exception when others then null; end;
  end loop;
end $$;

drop view if exists communities_public, landmarks_public, heritage_records_public, events_public, people_public, institutions_public, organisations_public, family_histories_public, community_names_public, media_public, articles_public cascade;

drop table if exists
  chat_messages, quiz_questions, proverbs, notifications, articles, audit_log, event_reminders, push_subscriptions, notification_prefs, saved_records,
  correction_requests, moderation_decisions, submissions, calendar_observances, media_assets, record_relations, record_sources,
  family_histories, organisations, institutions, people, events, landmarks, heritage_records, community_names, communities, sources, user_roles, profiles cascade;

drop function if exists
  has_role, is_editor, is_banned, touch_updated_at, handle_new_user, log_change, search_public, immutable_fold, lock_profile_fields,
  lock_submission_fields, lock_notification_fields, notify_submission_change, chat_before_insert, slug_from, approve_submission,
  admin_send_notification, admin_set_ban, admin_edit_user, admin_delete_user, delete_my_account, admin_list_users, admin_set_role, grant_bootstrap_admin cascade;

drop type if exists article_topic, record_category, rights_status, date_confidence, submission_status, publish_status, evidence_status, app_role cascade;
