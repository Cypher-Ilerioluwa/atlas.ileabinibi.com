-- 0014: show "Updated <date>" on articles and events. Adds the updated_at column to the two public views.
-- Safe to run more than once. Run after 0009 (and after 0011-0013 if you use them).
create or replace view articles_public as select id, slug, community_id, region_text, topic, title, summary, body, body_html, author_credit, sources, evidence, published_at, source, external_url, cover_url, updated_at from articles where status = 'published';
create or replace view events_public as select id, slug, name, alt_names, community_id, landmark_id, summary, body, body_html, significance, location_text, region_text, date_start, date_end, confidence, recurrence_note, organiser, public_contact, evidence, last_reviewed_at, source, external_url, cover_url, updated_at from events where status = 'published';
grant select on articles_public, events_public to anon, authenticated;
notify pgrst, 'reload schema';
