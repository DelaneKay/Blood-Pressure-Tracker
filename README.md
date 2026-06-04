# Blood Pressure Health Tracker

A private, no-build web app for daily blood pressure, pulse, medication, weight, food, nutrients, and exercise tracking.

## Open the app

For the full app with AI photo analysis:

```powershell
node server.js
```

Then open:

```text
http://127.0.0.1:5178
```

The old `index.html` direct-open mode still works for basic logging, but AI needs the backend.

## Online deployment

This app needs a Node backend, so it should not be deployed to GitHub Pages. Use a host that can run `server.js`.

The repo includes a Render blueprint:

```text
render.yaml
```

Render environment variables to set:

```env
NODE_ENV=production
HOST=0.0.0.0
GEMINI_API_KEY=your_private_key
GEMINI_MODEL=gemini-2.5-flash
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_private_service_role_key
APP_USERNAME=your_username
APP_PASSWORD=strong_private_password
SESSION_SECRET=long_random_secret
```

Online persistence uses Supabase. SQLite remains available only as a local fallback when Supabase env vars are not set.

GitHub Actions:

- Add repository secret `RENDER_DEPLOY_HOOK_URL`
- Push to `main`
- The workflow checks `server.js`, then triggers the Render deploy hook

Do not put Gemini keys, Supabase service-role keys, passwords, session secrets, or SQLite files in GitHub.

## Supabase setup

Create a Supabase project, then open the SQL editor and run:

```text
supabase-schema.sql
```

This creates the `logs` table used by the backend. The frontend never talks directly to Supabase. The Node backend talks to Supabase with `SUPABASE_SERVICE_ROLE_KEY`, so keep that key private in Render environment variables only.

Use the Supabase Project Settings API page to copy:

- `SUPABASE_URL`
- `service_role` key for `SUPABASE_SERVICE_ROLE_KEY`

## What it tracks

- Blood pressure, pulse, and daily status
- SAST date/time for every log
- Atenolol 100 / Kiara and 1/2 Adco-Retic logging
- Weight trends against blood pressure trends
- Potassium and magnesium targets from your notes
- Low-carb food quality signals
- Daily exercise, with cycling instead of running
- Local coach recommendations
- Whole-log analysis across recent readings, food, medicine, exercise, potassium, magnesium, and weight
- Food photo upload, preview, and AI-ready confirmation flow
- Edit saved logs
- Portion-based food estimates
- Weekly and monthly reports
- Local reminders while the app is open
- AI chat for questions about your logs, low-carb meals, BP support habits, and doctor-discussion prompts
- AI nutrition feedback for daily potassium, magnesium, net carb, carb:fiber ratio, and glycemic load results
- JSON export of your logs
- JSON import of your logs
- SQLite database download
- SQLite backend storage in `health_tracker.db`

## Food limit calculation

The app uses a small food-serving database for foods from your notes and common caution foods. When you type foods such as `avocado`, `spinach`, `eggs`, `chicken`, `hibiscus`, `bread`, or `rice`, the app estimates potassium, magnesium, carbs, fiber, net carbs, and glycemic load.

Daily food targets are checked like this:

- Potassium: meet or exceed 4,700mg
- Magnesium: meet or exceed 800mg
- Net carbs: stay at or below 50g
- Carb-to-fiber ratio: stay below 7:1
- Glycemic load: stay below 10

If you manually enter potassium or magnesium, the app uses the higher value between your manual entry and the food estimate. This keeps the app useful when you know a more accurate number from a label, supplement, or meal plan.

## AI food photo analysis

The current app includes the full user flow for food photo analysis:

- Upload a meal photo
- Preview the image
- Run analysis
- Review identified foods
- Confirm or remove foods
- Add confirmed foods into the food log

The browser-only app cannot securely run a private AI vision API by itself because API keys should not be placed in public front-end JavaScript.

This project now includes a small Node backend in `server.js`. Put your Gemini key in `.env`:

```env
GEMINI_API_KEY=paste_your_new_key_here
GEMINI_MODEL=gemini-2.5-flash
PORT=5178
```

If a key was pasted into chat or shared anywhere, revoke it and create a new one before using it.

Whole-log analysis already works locally using your saved readings and food logs. A future backend can replace or extend that with a stronger AI coach.

## Storage

Online storage uses Supabase Postgres. Local fallback storage uses:

```text
health_tracker.db
```

The frontend saves, loads, deletes individual entries, imports, and exports logs through backend API routes:

- `GET /api/logs`
- `POST /api/logs`
- `PUT /api/logs`
- `DELETE /api/logs/:id`
- `GET /api/database-backup`
- `POST /api/analyze-logs`
- `POST /api/analyze-nutrition`
- `POST /api/chat`

The old browser-only local storage is no longer the source of truth.

When using Supabase, the **Download DB** button exports a JSON backup of your logs. When using local SQLite fallback, it downloads the SQLite database file.

## Login protection

If `APP_PASSWORD` is set, the app requires login before accessing health logs, AI chat, photo analysis, reports, or database backups.

In production, `APP_PASSWORD` and `SESSION_SECRET` are required. The server will refuse to start without them.

## Reminders and reports

The Reports tab shows 7-day and 30-day summaries for average BP, pulse, high readings, medicine consistency, exercise, caution-food days, and weight change.

Reminders are local browser reminders. They check every 30 seconds while the app is open. Browser notifications can be enabled from the Reports tab, but the app must remain open for the reminders to fire.

## AI chat

The Chat tab sends your question to the backend, and the backend adds recent SQLite logs plus the app's blood-pressure and low-carb notes before calling Gemini. It can discuss patterns in your logs, potassium/magnesium and low-carb targets, food choices, cycling/exercise, breathing, sleep, stress, and questions to ask your clinician.

The chat is not Dr Eric Berg DC and does not replace your clinician. It can discuss low-carb/BP concepts inspired by your notes, but it should not diagnose or change medication.

## Nutrition feedback

The Food Limits panel uses local rules first, then asks Gemini for more specific feedback. Potassium and magnesium are minimum targets. Net carbs, carb:fiber ratio, and glycemic load are maximum limits. The AI prompt asks for South Africa-friendly food suggestions where possible.

## Key safety

`.gitignore` excludes `.env`, `health_tracker.db`, backup database files, uploads, and logs. Keep your Gemini API key in `.env` only.

## Medical safety

This app is a tracker and habit coach, not a diagnosis tool. Do not stop or change prescribed medication because of app feedback.

The blood pressure categories use American Heart Association thresholds. A reading above 180 systolic or above 120 diastolic is treated as crisis range. If that happens with chest pain, shortness of breath, weakness, vision changes, confusion, severe headache, or other concerning symptoms, seek emergency care immediately.

Potassium, magnesium, vitamin D, iodine, zinc, arginine, garlic extract, fish oil, cod liver oil, and other supplements can interact with health conditions or medicines. Ask your clinician before using high-dose supplements or potassium products, especially if you have kidney disease or medication changes.
