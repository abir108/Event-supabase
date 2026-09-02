# CloudTech Bookkeeping — Event Lead Capture

Static site (no build step) for collecting leads at an event booth:

- **`index.html`** — public registration form participants reach by scanning a QR code. They enter name, phone, email and get a 4-digit gift code on screen, with instructions on where to collect their gift. Duplicate phone numbers/emails are rejected.
- **`staff.html`** — a single combined **Staff & Admin console**. After signing in:
  - **Redeem tab** — booth staff enter a participant's 4-digit code, see their info, and confirm to mark the gift as given (a code can only be redeemed once).
  - **Dashboard tab** — live stats (registered / redeemed / pending), a searchable table of every lead with registration time, and a CSV export button.

Backend is Supabase (Postgres + Auth), called directly from the browser via the anon public key — no server to run.

## Setup

1. **Create a Supabase project** at [supabase.com](https://supabase.com) (free tier is enough for an event).
2. **Run the schema**: open the SQL Editor in your project and run [`supabase/schema.sql`](supabase/schema.sql). This creates the `leads` table and locks it down with row-level security so:
   - anyone can submit a new lead (insert only, and never read the table back — tokens stay private),
   - only signed-in staff can look up, list, or redeem leads,
   - phone numbers and emails must be unique (case-insensitive for email).
3. **Create a staff/admin account**: in the Supabase dashboard go to Authentication → Users → Add user, and create an email/password login for each person who needs access to `staff.html` (there's no separate "admin" login — anyone signed in sees both the Redeem and Dashboard tabs).
4. **Fill in your project keys**: open [`assets/supabase-client.js`](assets/supabase-client.js) and replace `SUPABASE_URL` and `SUPABASE_ANON_KEY` with the values from your project's Settings → API page. The anon key is safe to expose publicly — it's the one meant for browser use, and RLS is what actually protects the data.
5. **Logo**: already placed at `assets/logo.png`. If it's ever missing, both pages fall back to a text wordmark automatically.
6. **Deploy the folder** as a static site — e.g. drag-and-drop onto [Netlify](https://app.netlify.com/drop), or `vercel deploy`, or GitHub Pages. No build command needed.
7. **Generate your QR code** with any third-party QR generator, pointing it at your deployed `index.html` URL.

## At the event

- Print the QR code and display it at your booth.
- Participants scan it → fill the form → get a 4-digit code shown on their phone, with steps on where to bring it.
- Staff open `staff.html` on a booth device, sign in once, and use the **Redeem** tab to look up and confirm each code.
- Anyone with a login can switch to the **Dashboard** tab to see live counts, search/filter all leads, and export everything to CSV.

## Notes

- Phone numbers and emails aren't validated against real formats beyond basic HTML input types — add stricter validation if you need it.
- CSV export happens client-side from the Dashboard tab (no need to touch the Supabase Table Editor), but you can also use Table Editor → `leads` → Export CSV directly in Supabase if preferred.
- If you re-run `schema.sql` later, it's written to be safe to re-run (policies are dropped and recreated, indexes use `if not exists`).
