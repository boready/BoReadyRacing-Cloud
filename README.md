# Bo Ready Racing #38 Sponsor Finder

Static GitHub Pages frontend with Supabase Authentication and PostgreSQL RLS. No server running on the home computer is required.

## Setup
1. Edit `config.js`: paste your project's **publishable** (`sb_publishable_...`) or legacy **anon** key. The project URL is prefilled from your previously shared screenshot; verify it in Supabase Project Settings.
2. Upload `index.html`, `style.css`, `app.js`, `config.js`, `.nojekyll` to the **root** of the GitHub repository, replacing the older files. GitHub Pages should be configured to deploy from `main` / root.
3. In Supabase, ensure the `public.leads` table exists with the schema expected by the original app. Keep RLS and owner-specific policies enabled. The app adds `owner_id` when creating a lead.
4. Create a user in Supabase Authentication, disable public signups, then sign in to the published site.
5. Test adding one lead with a real public email source URL, editing, email draft, and CSV export.

**Security:** Never upload database passwords, secret/service-role keys, JWTs, or private sponsor exports to a public GitHub repository. The publishable key is intended to be public only when RLS and grants are correctly configured.

**Note:** This is a sponsor **tracker**, not an automated web-wide business discovery crawler. Draft email opens the device's configured email application; it does not send automatically. GitHub Pages hosting and Supabase free tiers have usage and inactivity limits, and free-tier availability is subject to provider terms.
