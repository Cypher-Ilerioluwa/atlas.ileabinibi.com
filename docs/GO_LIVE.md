# Ilẹ̀ Abínibí Atlas: go live at atlas.ileabinibi.com (no terminal on your computer)

Everything below is done in a web browser: GitHub, Supabase, Netlify and your domain's DNS page. The only command-line step is one optional command for push notifications, and it runs in **GitHub Codespaces**, a terminal that opens inside your browser. Tick each box as you go.

---

## Part A. How it fits together

| Piece | Job | Where |
|---|---|---|
| Website files | Everything visitors see | **GitHub** (stores them) and **Netlify** (builds and hosts them) |
| Database, logins, uploads, live chat | Members, posts, events, discussion room | **Supabase** |
| Push sender | Sends push notifications | A small function that Netlify runs for you |
| Your address | `atlas.ileabinibi.com` | One DNS record at your domain host |

You do not rent or manage a server. Your WordPress site at ileabinibi.com is not touched.

**Order of work:** GitHub, then Supabase, then sign-in settings, then Netlify, then your domain, then admin, then optional push.

**Costs:** every service has a free tier that is enough to start. Free tiers have limits, so check each pricing page before announcing the site.

## Part B. What you need before starting

- [ ] A **GitHub** account (github.com)
- [ ] A **Supabase** account (supabase.com)
- [ ] A **Netlify** account (netlify.com). Use "Sign up with GitHub" to make step G easier
- [ ] Login to wherever the DNS for **ileabinibi.com** is managed (your registrar, your web host's cPanel, or Cloudflare)
- [ ] The file `ile-abinibi-atlas.zip` on your computer or phone-with-computer-mode. **Unzip it** (right-click, Extract all). You will see folders `src`, `supabase`, `netlify`, `scripts`, `docs`, `tests` and files `netlify.toml`, `package.json`, `README.md`
- [ ] A password manager or a safe note for the keys you will create

---

## Part C. Put the files on GitHub (browser only)

1. Go to github.com, click **+** (top right) > **New repository**.
2. Name it `ile-abinibi-atlas`, choose **Private**, leave "Add a README" **off**, click **Create repository**.
3. On the empty repository page click **uploading an existing file**.
4. Open your unzipped folder. **Select everything inside it** (the folders and files, not the zip, and not the outer folder itself) and **drag them into the GitHub page**. There are 69 files, which is within GitHub's 100-file limit for one upload.
5. Wait until every file shows in the list. Scroll down, leave the message as is, click **Commit changes**.
6. Check the repository now shows `src`, `supabase`, `netlify`, `scripts`, `docs`, `tests`, `netlify.toml`, `package.json`. Open `src` and confirm you see folders like `css`, `js`, `map`, `account`.
7. Hidden files (names starting with a dot, such as `.gitignore` and `.env.example`) may not upload. That does not stop the site working. Optional: **Add file > Create new file**, name it `.gitignore`, paste this, and commit: `node_modules/` then `dist/` then `.env` (one per line).

If a folder is missing, click **Add file > Upload files** and drag just that folder.

---

## Part D. Create the Supabase project and database

1. supabase.com > **New project**. Name `ile-abinibi-atlas`. Pick the region nearest most of your users. Create a strong database password and save it. Click create and wait until it finishes.

### D1. Run the database files, in order

> **Already ran some files?** Run only the ones you have not run yet, in number order. If you ran 0001 to 0009 before this update, run just **0010** and **0011** now, then `0006_selfcheck.sql` again.

Use **Supabase > SQL Editor > New query** for every file. For each file: in GitHub open `supabase` > `migrations` > the file, click the **Copy raw file** icon (two squares, top right), paste into a new Supabase query, press **Run**, and wait for "Success" before the next one. Do not run two files in the same query tab.

1. `0001_core_schema.sql`
2. `0002_security.sql`
3. `0003_admin.sql`
4. `0004_features.sql`
5. `0005_storage.sql`
6. `0007_publish_content.sql` (publishes the pilot content from your prototype)
7. `0008_community_features.sql` (contributors and credits, imports from ileabinibi.com, chat replies, reactions and read receipts)
8. `0009_social_chat.sql` (chat photos, edit and pin, likes and comments, formatted imported posts, live notification badges)
9. `0010_media.sql` (shared music and playlists). Safe to run again. **If the Media page says "Could not find the table 'public.media_shares' in the schema cache", this file has not been run yet: run it now.** It ends by refreshing Supabase's API cache, so no restart is needed
10. `0011_house_author.sql` (makes **Ilẹ̀ Abínibí** the author of all content, linking to https://ileabinibi.com/). Safe to run again
11. `0006_selfcheck.sql` last: it changes nothing and shows OK or MISSING for each part

**If a file fails**
1. Do not run the later files. Scroll the result panel and copy the **red error message in full** (it names the line). Send it to me; one error message is all I need.
2. A failed file changes nothing, because each file runs as one unit. To retry the same file, just run it again.
3. **Starting over** (only on a brand-new project with no data you care about): run `0000_reset.sql` first. It deletes everything the Atlas files created (it does not delete user accounts), then run files 1 to 5 again.
4. Common causes: running files out of order, running a file twice (messages like "already exists"), or pasting a partly copied file. Always use **Copy raw file** and paste the whole thing.

### D2. Check it worked

Run `0006_selfcheck.sql`. Every row must say **OK**:

| Check | Meaning |
|---|---|
| Tables created (36) | The database tables exist |
| Tables with security OFF (0) | Every table is protected |
| Public views (11) | Public pages can read published content |
| Key functions (10) | Approval, admin, credits and search functions exist |
| Sign-up trigger / Admin trigger | New accounts get a profile; your admin email is recognised |
| Storage buckets (4), Private bucket is private | Upload areas exist (including chat photos); private uploads are not public |
| Storage access rules (13) | Who may upload or read files |
| Live updates switched on (4) | Chat, reactions, read receipts and notification badges update instantly |

**If a check says MISSING**, fix only that item:
- **Sign-up trigger or Admin trigger missing:** Supabase did not allow the SQL to attach to the user table. Contact me with the warning text; meanwhile the manual admin SQL in Part I still works, but new sign-ups will not get a profile row until this is fixed.
- **Storage buckets missing:** Dashboard > **Storage > New bucket**. Create `public-media` (public), `avatars` (public), `chat-media` (public) and `private-submissions` (**not** public).
- **Storage access rules missing (fewer than 10):** Dashboard > **Storage > Policies**, or send me the warning and I will give the exact rules to paste in the policy editor. Without them, uploads (pictures and attachments) will be refused, but everything else works.
- **Live chat switched on missing:** Dashboard > **Database > Publications > supabase_realtime**, switch on the tables `chat_messages`, `chat_reactions`, `chat_reads` and `notifications`.

### D3. Copy your keys
Supabase > **Project Settings > API** (may be named "API Keys"). Copy into your password manager:
- **Project URL** (like `https://abcd1234.supabase.co`)
- **anon / publishable key** (safe to put in the website)
- **service_role / secret key** (**secret**: only ever pasted into Netlify in Part G)

---

## Part E. Sign-in settings in Supabase (uses your subdomain)

1. **Authentication > URL Configuration**
   - **Site URL:** `https://atlas.ileabinibi.com`
   - **Redirect URLs:** click Add and enter `https://atlas.ileabinibi.com/**`. You will add your Netlify address here too in Part G.
   If these are wrong, confirmation and password-reset links fail.
2. **Authentication > Providers > Email:** keep **Confirm email ON**. Set minimum password length to **10**.
3. **Email sending.** Supabase's built-in sender is for testing and allows very few emails per hour. Before inviting members, open **Authentication > Emails** (or **SMTP settings**, the name varies) and connect your own sender:
   - Create an account with an email provider such as Resend, Brevo or Postmark and add your domain `ileabinibi.com`.
   - They show DNS records (SPF, DKIM). Add them at your DNS host. These are extra records and do not affect your website.
   - Paste their SMTP host, port, username and password into Supabase and set the sender to something like `no-reply@ileabinibi.com`.

---

## Part F. Connect the website to Supabase (edit in GitHub)

1. In GitHub open `src` > `js` > `config.js` and click the **pencil** icon (Edit).
2. Replace the empty quotes so it reads:
```js
export const config = {
  siteUrl: 'https://atlas.ileabinibi.com',
  supabaseUrl: 'https://YOUR-PROJECT.supabase.co',
  supabaseAnonKey: 'YOUR-ANON-OR-PUBLISHABLE-KEY',
  vapidPublicKey: ''
};
```
(Keep any lines already in the file; only fill the values.) 3. Click **Commit changes**.

> After this, demonstration places and sample posts disappear. The site shows only what you publish.

---

## Part G. Deploy on Netlify

1. Netlify > **Add new site > Import an existing project > GitHub** and authorise it for your repository. Pick `ile-abinibi-atlas`.
2. Leave the build settings alone (they come from `netlify.toml`).
3. Open **Site configuration > Environment variables** and add these (mark the keys as secret/sensitive when offered):

| Name | Value |
|---|---|
| `SUPABASE_URL` | your Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | the **secret** key |
| `VAPID_SUBJECT` | `mailto:cypherilerioluwa@gmail.com` |
| `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` | add later, in Part J |

4. Click **Deploy**. Wait for "Published". Open the `something.netlify.app` link and check the home page and menu load.
5. Check **Functions**: the list should show `send-push`.
6. Add the Netlify address to Supabase: **Authentication > URL Configuration > Redirect URLs**, add `https://something.netlify.app/**`.
7. Optional: **Site configuration > Change site name** to something tidy.

If the build fails, open the failed deploy and read the log. Send me the last 30 lines.

---

## Part H. Point atlas.ileabinibi.com at the site

You already created the `atlas` subdomain. Creating one at a web host (for example in cPanel) usually also creates a DNS record pointing at the old hosting. That record has to be replaced, because one name cannot have both an A record and a CNAME.

1. Netlify > **Domain management > Add a domain** > enter `atlas.ileabinibi.com` > confirm. Netlify shows the **exact DNS value** to use (normally your `*.netlify.app` address). Keep this page open.
2. Open the **DNS settings** of ileabinibi.com (cPanel: **Zone Editor**, Namecheap: **Advanced DNS**, GoDaddy: **DNS**, Cloudflare: **DNS**).
3. Find existing records whose name is `atlas` (or `atlas.ileabinibi.com`). **Delete** any A, AAAA or CNAME record for `atlas`. Do not touch any other record, and do not touch the records for `www`, the main domain, or email.
4. **Add one record:**
   - **Type:** CNAME
   - **Name / Host:** `atlas`
   - **Value / Target:** exactly what Netlify showed (no `https://`, no slash)
   - **TTL:** automatic or 300
5. Use **DNS pointing**, not "URL redirect" or "domain forwarding" at your host. Forwarding breaks HTTPS and sign-in.
6. On **Cloudflare**, set the record to **DNS only** (grey cloud) at first.
7. If your host keeps an `atlas` folder or WordPress subdomain site, you can leave it unused or remove it afterwards. Your main WordPress site is unaffected.
8. Wait a few minutes to a few hours. Check at dnschecker.org by entering `atlas.ileabinibi.com` with type CNAME.
9. Back in Netlify > Domain management, wait for **HTTPS** to show a certificate (automatic). Turn on **Force HTTPS** if offered.
10. Open **https://atlas.ileabinibi.com/**. You should see the padlock and the Atlas.
11. In Netlify > Domain management set `atlas.ileabinibi.com` as the **Primary domain**, so the old `*.netlify.app` address redirects to it.
12. Confirm Part E still lists `https://atlas.ileabinibi.com/**` and the Site URL.

---

## Part I. Make yourself administrator

1. Open `https://atlas.ileabinibi.com/account/` > **Sign up** with **cypherilerioluwa@gmail.com** and a strong password.
2. Open the confirmation email and click the link. Admin is granted only after the email is confirmed, so nobody else can claim it.
3. **Sign in.** You land on your dashboard automatically, and the top menu changes from "Sign in / Sign up" to **Dashboard**. The sidebar shows **Admin**. When you log out you return to the Sign in / Sign up page.
4. If it does not, in Supabase **SQL Editor** run this once, then sign out and in:
```sql
insert into user_roles(user_id, role)
select id, 'admin' from auth.users
where lower(email) = 'cypherilerioluwa@gmail.com' and email_confirmed_at is not null
on conflict do nothing;
```

**Giving others rights:** Admin > **Users** > **Roles** next to the person > choose a role > **Grant**. They must have an account first.

| Role | Can do |
|---|---|
| member | Sign in, contribute, see own posts and notifications, join chat |
| community_editor, research_editor | Review submissions, edit and publish content, handle corrections |
| admin | Everything, including users, messages, push and the audit trail |

**Ban** stops posting and chat. **Delete** erases an account. The last admin cannot be demoted or deleted.

---

## Part J. Push notifications (optional; everything else works without it)

You need two keys: a **public** one (goes in the website) and a **private** one (goes only in Netlify).

**Easiest way, in your browser's F12 console (nothing is installed or uploaded):**
1. Open your own site (`https://atlas.ileabinibi.com`, or your `*.netlify.app` address) in Chrome, Edge or Firefox. It must be an https page.
2. Press **F12**, open the **Console** tab. If the browser asks, type `allow pasting` and press Enter.
3. Paste this and press Enter:
```js
(async () => {
  const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const pub = await crypto.subtle.exportKey('raw', kp.publicKey);
  const jwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
  console.log('VAPID_PUBLIC_KEY  = ' + b64u(pub));
  console.log('VAPID_PRIVATE_KEY = ' + jwk.d);
  console.log('lengths (expect 87 and 43):', b64u(pub).length, jwk.d.length);
})();
```
4. Copy both lines into your password manager. Generate **once** only: a new pair would cut off everyone who already turned push on. Never paste the private key into GitHub, a chat, or `config.js`.

*Alternative with a terminal:* GitHub > your repo > **Code > Codespaces > Create codespace**, then run `npx web-push generate-vapid-keys`, and delete the codespace afterwards.

**Then:**
1. Edit `src/js/config.js` in GitHub (as in Part F) and put the **public** key in `vapidPublicKey`. Commit.
2. In Netlify > Environment variables add `VAPID_PUBLIC_KEY` (public) and `VAPID_PRIVATE_KEY` (private, secret). Then **Deploys > Trigger deploy > Deploy site**.
3. Test: sign in > **Settings > Push notifications > Turn on** and allow the browser prompt. Then **Admin > Push notifications** and send yourself one.

Limits: on iPhone and iPad push only works after the app is added to the home screen (iOS 16.4 or later). The admin screen reports how many deliveries the push service accepted, not how many people read them.

---

## Part K. Publish the pilot content, then add your own

### K1. Publish the content from your prototype
If you did not already run it in Part D1: open `0007_publish_content.sql` in GitHub, **Copy raw file**, paste it in a new Supabase query and **Run**. It is safe to run twice; rows that exist are skipped. Then run `0008_community_features.sql`, which credits this content to "Ilẹ̀ Abínibí Atlas prototype".
3. The result table at the bottom shows what is now published. Expect: 27 communities, 22 articles, 13 heritage records, 2 landmarks, 4 events, 2 people, 1 institution, 1 organisation, 1 proverb, 13 quiz questions.
4. Reload the site. It now shows:

| Content | Where visitors see it |
|---|---|
| Communities and kingdoms | **Map** (markers and list), each has a **View Community** page |
| Articles | The community's page, under topic filters (History, Language, Names, Spirituality, Culture, Food, Popular events); general ones show on **Community > Latest updates** |
| Heritage records, Landmarks, Notable people, Traditional institutions, Organisations | **Library** (open it from the Map or Community page, or the Home page) |
| Festivals and events | **Events** (dates show "to be confirmed" until you add them in Admin) |
| Proverbs | **Community > Proverbs** |
| Quiz questions | **Community > Quiz** (mixed with map-based questions) |

**What this content is, and is not.** Everything comes from the files you supplied (the prototype's 27 places, its language, belief, culture, food, festival, proverb and history sections). I added nothing from outside them. It is marked **published** as you asked, but the prototype itself says each entry still needs source citations and community review. Two wording choices to check: I changed "Yoruba" to "Abínibí" everywhere except the language's own name "Èdè Yorùbá" and the history entry about the name "Yoruba" itself, because changing those would make them false. Landmark coordinates are left empty, because the prototype did not give them.

### K2. Manage it as admin
Dashboard > **Admin**. Each section (Articles, Communities, Heritage records, Landmarks, Festivals and events, Notable people, Traditional institutions, Organisations and services, Proverbs, Quiz questions) lets you create, edit, publish, unpublish and delete. Use **Publish all drafts** to publish a whole section at once. Edit dates for festivals, add coordinates for landmarks, and add sources as you verify them.

### K3. Members' contributions
Members submit at **/contribute/**. Review them in **Admin > Submissions**. "Approve and publish" puts an article on its community page or an event on the Events page, and notifies the author. Request changes and Reject need written feedback.

## Part L. Test before announcing

Use three accounts: you (admin), a second email as a **member**, a third as an **editor** (grant the role). Use a private/incognito window for the extra accounts.

- [ ] A member can submit an article, a correction and an event, and cannot submit without a city or region.
- [ ] Their post shows as Pending, then updates after your decision, with a notification.
- [ ] A member does **not** see the Admin tab.
- [ ] An unapproved submission is not visible publicly. After approval it appears on the right page.
- [ ] Ban a test member: they can no longer chat or submit.
- [ ] Promote and demote works. Demoting the only admin is refused.
- [ ] A message to "Everyone" arrives in test members' Notifications.
- [ ] Sign-up email and forgot-password email arrive and their links work.
- [ ] Deleting a test member's account works.
- [ ] Two browsers on the Community page see each other's chat messages immediately.
- [ ] Push test arrives on a device with push turned on.
- [ ] Light theme is the default; Settings can switch to Dark.
- [ ] Install the app on Android Chrome and on desktop; the offline page appears when offline.
- [ ] Layout holds on phone, tablet and desktop.

---

## Part M. Tell search engines

1. search.google.com/search-console > **Add property** > `https://atlas.ileabinibi.com` > verify (the DNS option is easiest; it adds a TXT record).
2. **Sitemaps** > submit `https://atlas.ileabinibi.com/sitemap.xml`.
3. Note: community city pages load by script and are marked noindex for now. Indexable pages per community are not built yet.

---

## Part N. Day-to-day running

- **Edit the site:** open a file in GitHub, click the pencil, change it, **Commit changes**. Netlify rebuilds in about a minute. To preview first, commit to a new branch and Netlify makes a deploy preview.
- **Undo a bad change:** Netlify > **Deploys** > an older good deploy > **Publish deploy**.
- **Database changes:** never change tables by hand only. Add a new numbered file in `supabase/migrations/` (for example `0005_name.sql`), run it in SQL Editor, and commit it to GitHub.
- **Backups:** Supabase paid plans include daily backups. On the free plan nothing is kept for you, so use **Table Editor** to export key tables as CSV on a schedule, download uploaded files from **Storage**, or upgrade the plan once you have real members.
- **Watching limits:** each month check Supabase (database size, storage, bandwidth, auth emails) and Netlify (bandwidth, functions). The free OpenStreetMap tiles are for light use only.
- **Moderation:** chat is public. Check it, delete bad messages, ban repeat offenders.
- **If a secret leaks:** reset the Supabase secret key and update Netlify; for push, regenerate the keys (Part J) and redeploy.
- **Legal:** the footer no longer links to a privacy policy or terms. Publish them somewhere reachable, and state what you store (email, name, submissions, uploads, push subscription).

---

## Part O. Troubleshooting

| Problem | Fix |
|---|---|
| Netlify build says secrets were found | `netlify.toml` already lists the public keys to ignore. Make sure you did not paste the **secret** key into `config.js` |
| Confirmation or reset link errors | Fix Site URL and Redirect URLs in Supabase (Part E) |
| A SQL file fails | Copy the full red error and send it to me; see Part D1 "If a file fails" |
| No Admin tab | Email not confirmed, or run the SQL in Part I step 4, then sign in again |
| Sign-up email never arrives | Set up your own email sender (Part E step 3); check spam |
| Domain stuck on "pending" or shows another site | The old `atlas` A/AAAA record still exists, or the CNAME value is wrong; redo Part H steps 3 and 4 |
| Browser warns about the certificate | Wait for Netlify's HTTPS to finish; on Cloudflare use DNS only |
| Map shows no communities | None published yet (Admin > Communities) |
| Chat does not update live | Run `0006_selfcheck.sql`; fix the "Live chat" row; both people must be signed in |
| Settings page shows loading forever | Fixed in the latest update: it now gives up waiting after a few seconds and shows the page. If you still see it, reload once, then use Settings > Check for updates |
| Opening `/.netlify/functions/send-push` in the browser | A short message is correct. It now shows whether the push function is configured. Sending only happens from Admin > Push notifications |
| Push says "not configured" | `vapidPublicKey` missing in `config.js`, Netlify variables missing, or not redeployed |
| Push works on Android but not iPhone | iPhone needs the app added to the home screen (iOS 16.4+) |
| Old content after an update | Reload once, or Settings > Check for updates |

---

## Part Q. Automatic posts from ileabinibi.com (WordPress)

**What is confirmed:** your WordPress REST address `https://ileabinibi.com/wp-json/wp/v2/posts` is public and working, the tag **atlas** exists (id 140) and 10 posts already carry it. No password is needed to read published posts.

**How it works:** every hour a Netlify function asks WordPress for the list of posts tagged `atlas` (just ids and last-modified times), downloads only the posts that are new or changed, and saves them in the Atlas keyed by the WordPress post number, so a re-run updates instead of duplicating. A post that is unpublished, trashed or loses the tag is hidden in the Atlas too (archived, not deleted). Imported posts open inside the Atlas like any other post: same layout, headings, lists, tables and pictures, with comments, likes and saves. Readers are not shown that they came from WordPress, and links to other pages of your own site are removed (links to other imported posts become `https://atlas.ileabinibi.com/post/?s=wp-…` links). The original WordPress address is stored out of sight; each page's canonical link is its own atlas.ileabinibi.com address.

### What the importer works out by itself
If a post has none of the special tags, the importer uses your ordinary WordPress tags and categories: words such as *language, food, festival, history, ifa, orisha* pick the topic, and tags such as *lagos, ijebu, oyo, ife, ibadan* pick the community. The author of every imported post is **Ilẹ̀ Abínibí** (linked to https://ileabinibi.com/), whoever wrote it in WordPress.

### The tags to use (the simple way)
On every WordPress post you want in the Atlas add **two kinds of tag**: the tag `atlas`, plus **one topic tag**. Type the topic exactly as written (capital letter optional):

| Topic tag | Slug WordPress makes | Where it shows in the Atlas |
|---|---|---|
| `History` | history | Posts > History filter, community pages |
| `People` | people | Posts > People |
| `Language` | language | Posts > Language |
| `Culture` | culture | Posts > Culture |
| `Food` | food | Posts > Food |
| `Spirituality` | spirituality | Posts > Spirituality |
| `Names` | names | Posts > Names |
| `Popular events` | popular-events | Posts > Popular events |

Example: a post tagged `atlas`, `History` and `atlas:community:ile-ife` appears in the History filter and on the Ilé-Ifẹ̀ community page. Use only one topic tag per post; if there are several, the first in the table's order wins. A topic can also be set with a WordPress **category** of the same name. The long form `atlas:topic:history` still works and wins if both are present. A post with no topic tag is guessed from its other tags and otherwise filed under Culture.

### Tags you can add to take control (WordPress > Posts > edit > Tags)
| Tag (type it exactly) | Meaning |
|---|---|
| `atlas` | **Required.** Import this post |
| `atlas:type:article` | Where it goes: `article` (default), `event`, `heritage`, `landmark`, `person`, `institution`, `organisation` |
| `atlas:topic:history` | Long form of the topic tags above (`history`, `people`, `language`, `culture`, `food`, `spirituality`, `names`, `popular_event`) |
| `atlas:community:ile-ife` | The community's short name (slug, as in the Atlas address `/city/?c=ile-ife`) |
| `atlas:editor:Ọlá Adé` | One tag per co-editor, shown after the author. The author of every post is always **Ilẹ̀ Abínibí** |
| `atlas:date:2026-08-14` | For events: start date. Optional end date: `atlas:enddate:2026-08-16` |
| `atlas:category:craft` | For heritage records (`oral_history`, `craft`, `practice`, …) or the category of an organisation |

### Settings in Netlify (Site configuration > Environment variables)
You already have `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; the importer uses them. All of these are optional:
| Name | Purpose |
|---|---|
| `WP_BASE_URL` | Your WordPress address. Default `https://ileabinibi.com` |
| `WP_USER` and `WP_APP_PASSWORD` | Only if WordPress ever blocks anonymous reading (a security plugin that limits the REST API). See below |

### Do I need an application password?
**Not today:** your site's published posts are readable without one. Create one only if the import starts failing with "answered 401 or 403". Then: WordPress > **Users > Profile** (best: create a separate user with the **Subscriber** or **Contributor** role just for this) > scroll to **Application Passwords** > name it "Atlas import" > **Add New Application Password** > copy the password shown once. In Netlify add `WP_USER` (that user's login name) and `WP_APP_PASSWORD` (the password, mark it secret) and redeploy. Never put it in GitHub. It can be revoked at any time from the same WordPress screen.

### Running and checking it
- Dashboard > **Admin > Website import**: **Check connection** shows whether the function is deployed and configured; **Sync now** imports straight away and reports: found, checked (changed), new, updated, archived, and any problems.
- It also runs by itself every hour on the published production site.
- If a firewall blocks the function, allow requests to `/wp-json/wp/v2/` from the user agent `IleAbinibiAtlasSync`.
- Wording note: imported posts keep your own words. "Yoruba" is not auto-replaced by "Abínibí" in them, because that would also change titles, quotations and tables. Tell me if you want that applied.

## Part R. Credits and contributor pages

Every post, event and record shows who wrote and edited it. The first name is the author; later names are editors or contributors. Clicking a name opens that person's page with everything they have written, edited or worked on.
- **Members' submissions:** when you approve a submission, its author is credited automatically. When you approve a correction, the person who sent it is added as an editor.
- **Editing credits by hand:** Admin > any content section > Edit > "Credits": one person per line as `Name | role`, the first line being the author.
- **Author:** every item shows **Ilẹ̀ Abínibí** as author, linking to https://ileabinibi.com/. Anyone else who is credited (members whose submissions you approve, `atlas:editor:` tags, names added in Admin) appears after it as editor or contributor.
- **Imported posts:** the author is Ilẹ̀ Abínibí; `atlas:editor:` tags add editors.

## Part S. Media: music and playlists

**Where:** the **Media** page (menu: after Community). Members share a track, album, playlist or video **to a community**; everyone can play it right there. Nothing is uploaded: the music stays on the streaming platform, so there is nothing to host and no copyright files to store.

**Accepted platforms (only these):** Spotify, Apple Music, YouTube, YouTube Music, SoundCloud, Audiomack, Deezer, Tidal and Boomplay. Any other link is refused, both on the page and in the database. Boomplay does not allow playing inside other apps, so its items show an "Open in Boomplay" button.

**How the player works**
- **Play** on any card loads the platform's own player in the player panel (it stays at the top on phones). Play, pause, volume and seeking are the platform's controls; some platforms play only a preview unless the listener is signed in to that platform in the same browser.
- **Next / Previous** move through the list you are looking at (the filters and tabs apply). YouTube videos and SoundCloud tracks also move to the next item by themselves when they end; the other platforms need a tap on Next.
- **Listening now** shows how many members have the same item open, live.
- **Like** a track; **Share to a community** adds it to another community's list. Sharing stays inside the Atlas: there is no copy-link or share-outside button.
- **Invite to listen together** posts an invitation card (with an optional time) and also drops a message with a link into that community's chat room.

**Setting it up**
1. Run `0010_media.sql` (Part D1).
2. Deploy the update (the title lookup function `media-meta` is in the `netlify` folder). It fills in the title, artist and cover automatically for Spotify, YouTube, SoundCloud and Deezer from the pasted link; for the others the member types the title. It needs no extra settings.
3. Moderation: Dashboard > **Admin > Music** lists every share with **Hide** and Edit; deleting is for admins. Members are limited to one share every 20 seconds and 15 a day.
4. Not tested here: the live platform players and the automatic next-track for YouTube and SoundCloud depend on those companies' players, which I could not load from my environment. Test one link from each platform you care about after deploying.

## Part T. Notifications, the phone app and iPhone

- **Unread badges:** a red number appears next to **Dashboard** in the top menu, on the profile icon on phones, on the Notifications tab, in the browser tab title and on the app icon (where the phone allows it). New notifications arrive live, with a short pop-up message.
- **Install on Android and computers:** a small prompt offers to install after a couple of visits, and there is an Install button in More and in Settings.
- **Install on iPhone and iPad:** Apple does not allow any website to add itself to the Home Screen automatically. The Atlas shows a guide (Share, then Add to Home Screen, then Add) from the More sheet, Settings and a polite banner after a few visits. Once installed from Safari it opens full screen like an app, and push notifications work on iPhone only after this step (iOS 16.4 or later).
- **Confirming push:** the address `https://YOUR-SITE.netlify.app/.netlify/functions/send-push` shows `"ready": true` when the four Netlify settings are present. Real delivery is confirmed by turning push on in a signed-in phone's Settings and sending a test from Admin > Push.

## Part U. Fixing "Could not find the table 'public.media_shares' in the schema cache"

The Media page asked Supabase for the table `media_shares`, and Supabase does not have it (or has not noticed it yet). Fix: Supabase > **SQL Editor** > new query > paste all of `supabase/migrations/0010_media.sql` > **Run**. It can be run any number of times and ends with a command that refreshes the API cache. Reload the Media page. If it still shows the message, run `notify pgrst, 'reload schema';` alone in a new query. The app now shows a plain-English version of this message instead of the database wording.

## Part P. Not built yet

Indexable pages per community and article, duplicate-record merging, a media review gallery, email notifications, event reminders, a change-email flow, and the privacy/terms pages.
