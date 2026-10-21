// Field definitions for the generic content editor. Column names match supabase/migrations/0001.
const EVIDENCE = ['documented','oral_tradition','scholarly_interpretation','disputed','community_submitted','under_review'];
const STATUS = ['draft','published','archived'];
const t = (name, label, extra = {}) => ({ name, label, type: 'text', ...extra });
const ta = (name, label, extra = {}) => ({ name, label, type: 'textarea', ...extra });
const sel = (name, label, options, extra = {}) => ({ name, label, type: 'select', options, ...extra });
const num = (name, label) => ({ name, label, type: 'number' });
const chk = (name, label) => ({ name, label, type: 'checkbox' });
const date = (name, label) => ({ name, label, type: 'date' });
const comm = (name, label) => ({ name, label, type: 'community' });
const lines = (name, label, extra = {}) => ({ name, label, type: 'lines', ...extra });
const status = sel('status', 'Publication status', STATUS, { required: true });
const evidence = sel('evidence', 'Evidence label', EVIDENCE, { required: true });

export const TABLES = {
  articles: { label: 'Articles', title: 'title', fields: [
    t('slug', 'URL slug (auto if empty)'), t('title', 'Title', { required: true }),
    sel('topic', 'Topic', ['history','people','language','culture','food','spirituality','names','popular_event'], { required: true }),
    comm('community_id', 'Community'), t('region_text', 'City or region'), ta('summary', 'Summary'), ta('body', 'Article text', { required: true }),
    t('author_credit', 'Author credit'), ta('sources', 'Sources'), evidence, status ] },
  communities: { label: 'Communities and kingdoms', title: 'preferred_name', fields: [
    t('slug', 'URL slug (auto if empty)'), t('preferred_name', 'Preferred name (with tone marks)', { required: true }),
    sel('kind', 'Type', ['town','kingdom','community','diaspora'], { required: true }), t('country', 'Country', { required: true }), sel('region_group', 'Region group (for map filters)', ['Nigeria','West Africa','Americas','Europe','Other']), t('admin_area', 'State or administrative area'),
    num('lat', 'Latitude'), num('lng', 'Longitude'), t('coord_source', 'Coordinate source'), t('coord_precision', 'Coordinate precision'),
    chk('coord_verified', 'Coordinate verified'), chk('coord_sensitive', 'Sensitive: hide coordinates from the public'),
    ta('summary', 'Summary'), ta('body', 'Full text'), evidence, status ] },
  heritage_records: { label: 'Heritage records', title: 'title', fields: [
    t('slug', 'URL slug (auto if empty)'), t('title', 'Title', { required: true }),
    sel('category', 'Category', ['oral_history','document','photograph','audio','video','biography','proverb','folktale','craft','practice','timeline','research_note','terminology','community_record','article'], { required: true }),
    ta('summary', 'Summary'), ta('body', 'Full text'), t('period_text', 'Date or period'), t('language', 'Language'),
    sel('rights', 'Rights status', ['pending','cleared','restricted'], { required: true }), t('reuse_terms', 'Reuse terms'), t('contributor_credit', 'Contributor credit'), evidence, status ] },
  landmarks: { label: 'Landmarks', title: 'name', fields: [
    t('slug', 'URL slug (auto if empty)'), t('name', 'Name', { required: true }), ta('summary', 'Summary'), ta('body', 'Full text'),
    num('lat', 'Latitude'), num('lng', 'Longitude'), t('coord_source', 'Coordinate source'), t('coord_precision', 'Coordinate precision'),
    chk('coord_verified', 'Coordinate verified'), chk('coord_sensitive', 'Sensitive: hide coordinates from the public'),
    ta('visitor_info', 'Visitor information (only if verified)'), evidence, status ] },
  events: { label: 'Festivals and events', title: 'name', fields: [
    t('slug', 'URL slug (auto if empty)'), t('name', 'Name', { required: true }), ta('summary', 'Summary'), ta('significance', 'Cultural significance'),
    t('location_text', 'Location'), date('date_start', 'Start date'), date('date_end', 'End date'),
    sel('confidence', 'Date confidence', ['confirmed','tentative','recurring_variable'], { required: true }), t('recurrence_note', 'Recurrence note'),
    t('organiser', 'Organiser'), t('public_contact', 'Public contact (only if permitted)'), evidence, status ] },
  people: { label: 'Notable people', title: 'preferred_name', fields: [
    t('slug', 'URL slug (auto if empty)'), t('preferred_name', 'Preferred name', { required: true }), ta('summary', 'Summary'), ta('body', 'Biography'),
    chk('living', 'Person is living'), chk('consent_confirmed', 'Consent to publish confirmed'), evidence, status ] },
  institutions: { label: 'Traditional institutions', title: 'name', fields: [
    t('slug', 'URL slug (auto if empty)'), t('name', 'Name', { required: true }), ta('summary', 'Summary'), ta('body', 'Full text'), evidence, status ] },
  organisations: { label: 'Organisations and services', title: 'name', fields: [
    t('slug', 'URL slug (auto if empty)'), t('name', 'Name', { required: true }), t('category', 'Category', { required: true }), ta('summary', 'Summary'),
    t('service_area', 'Service area'), t('public_contact', 'Public contact (only if permitted)'), chk('verified', 'Verified by an editor'), status ] },
  proverbs: { label: 'Proverbs', title: 'text_original', fields: [
    t('text_original', 'Proverb (with tone marks and underdots)', { required: true }), t('translation', 'Translation', { required: true }), ta('meaning', 'Meaning or use'), t('source', 'Source'), status ] },
  quiz_questions: { label: 'Quiz questions', title: 'question', fields: [
    t('question', 'Question', { required: true }), lines('options', 'Answer options (one per line, 2 to 6)', { required: true }), num('answer_index', 'Correct option number (first = 0)'),
    ta('explanation', 'Explanation'), comm('community_id', 'Community'), status ] }
};
export const ROLES = ['contributor','community_editor','research_editor','admin'];
export const SUBMISSION_STATUSES = ['submitted','under_review','changes_requested','approved','rejected','draft'];

export const slugify = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Every function the platform is meant to have, and where it stands. Shown in Admin > All functions.
export const FUNCTIONS = [
  ['Public', 'Home with daily quiz and streak, search suggestions, latest posts, events, topics, install prompt', 'Built'],
  ['Public', 'Map, community pages with topic filters, Read more, single post pages, all posts', 'Built'],
  ['Public', 'Library: heritage records, landmarks, people, institutions, organisations', 'Built'],
  ['Credits', 'Authors and co-editors on every item; contributor pages listing all their work', 'Built'],
  ['Calendar', 'Kọ́jọ́dá calendar, Gregorian view, converter, festivals; checked against the original code', 'Built and tested'],
  ['Community hub', 'Chat with replies, reactions, read receipts, typing, online users; quiz, guess game, proverbs', 'Built, live chat needs Supabase'],
  ['Accounts', 'Sign in, create account, forgot and reset password, sign out', 'Built, needs Supabase'],
  ['Dashboard', 'Overview, Account, Posts, Notifications, Settings, delete account', 'Built, needs Supabase'],
  ['Contribute', 'Article, correction and event forms with required location, consent and files', 'Built, needs Supabase'],
  ['Admin', 'Monitoring, submissions, users, content in 10 sections with credits, messages, push, corrections, audit', 'Built'],
  ['Admin', 'Import from ileabinibi.com by WordPress tags, hourly and on demand', 'Built, needs deploy and tags'],
  ['Admin', 'Duplicate detection and merge; media gallery review', 'Not built'],
  ['PWA', 'App-style bottom bar, offline shell, update check, install button', 'Built, device testing pending'],
  ['SEO', 'Sitemap, robots, canonical, meta for static pages', 'Built'],
  ['SEO', 'Static crawlable page per post and community', 'Not built (pages load by script)'],
  ['Database', 'Schema, RLS, storage, approval, credits, chat, admin functions (9 SQL files)', 'Written, run in order']
];
