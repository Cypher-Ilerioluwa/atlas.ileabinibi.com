# Testing

Automated: `npm test` (search folding, demo data integrity, Gregorian helpers; Kọ́jọ́dá cases are `todo` until verified).

Manual, before launch (none completed yet):
- Map: markers, clustering, filters, URL sharing, tile-failure and offline behaviour, keyboard use, 360px width.
- PWA: manifest validity, install on Android Chrome and desktop, offline page, update toast.
- Database (run in a dev Supabase project with four users: visitor, contributor, editor, admin):
  - anon cannot select base tables; anon reads `*_public` views and only published rows
  - sensitive coordinates are null in `communities_public`/`landmarks_public`
  - contributor can insert/read/edit own draft submissions, cannot set status to approved, cannot read others' submissions
  - contributor cannot insert into `user_roles`; only admin can grant/revoke
  - private-submissions objects readable only by owner and editors; public-media writable only by editors
  - `audit_log` rows appear for submission and role changes; only admin can read them
- SEO: titles, canonicals, sitemap, robots, 404 status on Netlify.
