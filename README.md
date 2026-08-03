# Shortcut — local shorts generator + one-click YouTube upload

A React + Node front end wrapped around your existing `AI-Youtube-Shorts-Generator`
Python pipeline. Paste a video link, it generates ranked vertical shorts on
your own machine, and you can upload the ones you pick straight to your
YouTube channel.

**Use this only on content you have the rights to** (your own channel,
licensed, or Creative-Commons content). It doesn't do anything to bypass
copyright — that's not something software can do; it just automates the
edit → upload steps for content you're already allowed to repost.

## 1. Project layout

Put this folder next to your existing Python repo, e.g.:

```
New folder/
├── AI-Youtube-Shorts-Generator/   ← the Python pipeline you already set up
└── shortcut/                      ← this project
    ├── backend/
    └── frontend/
```

## 2. Backend setup

```powershell
cd shortcut\backend
npm install
copy .env.example .env
notepad .env
```

In `.env`, set:
- `PYTHON_PROJECT_DIR` — full path to your `AI-Youtube-Shorts-Generator` folder (forward slashes)
- `PYTHON_BIN` — full path to `venv\Scripts\python.exe` inside that project, so it always uses the right environment, e.g.
  `C:/Users/ASUS/New folder/AI-Youtube-Shorts-Generator/venv/Scripts/python.exe`
- Leave the Google fields for now — set those in step 4.

Run it:
```powershell
npm run dev
```
You should see `Shortcut backend running on http://localhost:4000`.

## 3. Frontend setup

In a second terminal:
```powershell
cd shortcut\frontend
npm install
npm run dev
```
Open the URL it prints (usually `http://localhost:5173`).

At this point you can already paste a video link and generate clips — the
"Connect YouTube" step below is only needed for the upload button.

## 4. YouTube API setup (one-time)

YouTube uploads require your own Google Cloud project — there's no way
around this, Google requires every app to register.

1. Go to https://console.cloud.google.com and create a new project (or pick an existing one).
2. In the sidebar, go to **APIs & Services → Library**, search **YouTube Data API v3**, and click **Enable**.
3. Go to **APIs & Services → OAuth consent screen**.
   - User type: **External**
   - Fill in an app name (e.g. "Shortcut"), your email for support/contact.
   - Add scope `https://www.googleapis.com/auth/youtube.upload`.
   - Under **Test users**, add your own Google account's email — while the app is unpublished, only test users can authenticate.
4. Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
   - Application type: **Web application**
   - Authorized redirect URI: `http://localhost:4000/auth/google/callback`
   - Click Create — copy the **Client ID** and **Client Secret**.
5. Paste those into `backend/.env`:
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   GOOGLE_REDIRECT_URI=http://localhost:4000/auth/google/callback
   ```
6. Restart the backend (`Ctrl+C`, then `npm run dev` again).

Now click **Connect YouTube** in the app — it'll send you to Google's consent
screen, then back to the app once authorized.

### Quota note
The YouTube Data API's free daily quota is 10,000 units; each upload costs
1,600 units — so roughly **6 uploads per day** on the default free quota.
That's a Google-side limit on the API itself, not something this app can
change. If you need more, you can request a quota increase from Google Cloud
Console (Quotas page) — approval isn't guaranteed and can take a few days.

## 5. Using it

1. Paste a video URL, pick how many clips, click **Generate**.
2. Wait — this runs the same download → transcribe → highlight-detect →
   crop pipeline you tested from the command line, so timing is the same
   (several minutes for a long video).
3. Review the generated clips, edit the title/description if you want,
   click **Upload to YouTube** on the ones you want to publish.
4. Clips upload as **private** by default (see `routes/youtube.js` in the
   backend if you want to change that) so you can review on YouTube before
   making them public.

## Notes / next steps

- This is built for **local, single-user use** — YouTube tokens are held in
  an in-memory session, not a database. Fine for running on your own
  machine; would need auth + persistent storage before deploying anywhere
  multi-user.
- If you rerun a video you've already processed, the Python pipeline reuses
  its cached download/transcript automatically (same as when you ran it
  from the CLI).
- The Gemini free tier caps at ~20 highlight-detection calls per day — see
  the notes from your earlier CLI testing if you hit `429` errors again.
