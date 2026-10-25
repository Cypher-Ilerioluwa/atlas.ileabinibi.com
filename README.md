# Ilẹ̀ Abínibí Atlas

Yorùbá heritage map, archive and calendar. Static site (HTML, CSS, vanilla ES modules) + Supabase + Netlify.
Production target: https://atlas.ileabinibi.com/ (the WordPress site at ileabinibi.com is not touched).

Designed and developed by Cypher Ilerioluwa. Portfolio: https://cypherilerioluwa.netlify.app/

## Status (honest)

| Area | State |
|---|---|
| Home, Map, city (community) pages with topic filters, Community hub, Events, Contribute, Account | Built and clicked through in a browser in demo mode |
| Dashboard: Overview, Account, Posts (list/grid/boxed), Notifications, Settings (theme, install, updates, push, delete account) | Built; live behaviour needs Supabase |
| Admin tab: monitoring, submissions, users, content for 10 record types, messages, push, corrections, audit | Built; live behaviour needs Supabase |
| Place, article and event data | **Demonstration only** until you publish real records |
| Kọ́jọ́dá calendar (page, converter, festivals) | Built from the original app's rules and tested against its code; see docs/CALENDAR_VERIFICATION.md |
| Chat (replies, reactions, read receipts, typing, online users), credits and contributor pages, ileabinibi.com import, app-style mobile layout | Built; live behaviour needs Supabase and the new SQL files |
| SQL (11 SQL files), push function | Written, **never run**. Follow docs/GO_LIVE.md; 0006_selfcheck.sql reports what is missing |
| Static pages per community/article for SEO, duplicate merge, event reminders, email notifications | Not built |

**Start here: `docs/GO_LIVE.md`** (Supabase, Netlify, domain, admin, push).

## Run locally

```
npm run build      # src/ -> dist/ (partials, meta, sitemap.xml, robots.txt, SW version)
npm test           # unit tests (Node 20+)
npm run serve      # build and serve dist/ on :8080
```

## Layout

- `src/` pages (`<dir>/index.html` => clean URLs), `css/`, `js/`, `assets/`, `partials/`
- `src/js/calendar/` Gregorian helpers and the Kọ́jọ́dá module (independent of the UI)
- `scripts/build.mjs` build; `supabase/migrations/` database; `tests/`; `docs/`
- Each page starts with `<!--page title="" desc="" nav="" [noindex]-->`; the build fills head tags, canonical, robots.

## Deploy

1. Create a private GitHub repo `ile-abinibi-atlas`, push this folder.
2. Netlify: import the repo (`netlify.toml` sets build command and publish dir). Add the custom domain `atlas.ileabinibi.com`.
3. In your DNS provider add ONLY a CNAME for `atlas` pointing to the target Netlify shows. Do not change nameservers or WordPress records.
4. Supabase: new project, run `supabase/migrations/*.sql` in order, set Auth redirect URLs to the Netlify preview and production origins, then fill `src/js/config.js` with the public URL and anon key.
5. Never commit the service-role key or VAPID private key; use Netlify environment variables.

## Map tiles

Uses the OpenStreetMap standard tile server with attribution. Its usage policy is for light use; before launch consider a commercial or self-hosted provider.

## Admin access
See docs/GO_LIVE.md steps 8 and 9. Demo mode (no Supabase): open /account/ and choose Preview as member or admin; data stays in the tab.
