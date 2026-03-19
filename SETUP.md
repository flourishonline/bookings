# Booking App — Setup Guide

## What this does
- Clients pick a service → date → time → fill in details
- Checks your **real Google Calendar** for busy times
- Creates the event with a **Google Meet link** auto-generated
- Adds client as attendee → Google sends them a **calendar invite email**
- Sends a **branded confirmation email** via Resend with the Meet link

---

## Step 1 — Google Cloud Setup

1. Go to https://console.cloud.google.com
2. Create a new project (e.g. "Flourish Booking")
3. Enable the **Google Calendar API**:
   - APIs & Services → Library → search "Google Calendar API" → Enable
4. Create OAuth credentials:
   - APIs & Services → Credentials → Create Credentials → OAuth client ID
   - Application type: **Web application**
   - Name: "Booking App"
   - Authorised redirect URIs: add `http://localhost:3999/callback`
   - Click Create → copy your **Client ID** and **Client Secret**
5. Configure the OAuth consent screen:
   - APIs & Services → OAuth consent screen
   - User type: External
   - Fill in app name, support email
   - Add scope: `https://www.googleapis.com/auth/calendar`
   - Add yourself as a test user

---

## Step 2 — Get your Refresh Token (one-time, run locally)

```bash
# In the booking-app folder:
npm install
GOOGLE_CLIENT_ID=your_id GOOGLE_CLIENT_SECRET=your_secret node scripts/get-token.js
```

- Open the URL it prints in your browser
- Log in with your Google account and grant access
- Your **GOOGLE_REFRESH_TOKEN** will appear in the terminal
- Save it — you only need to do this once

---

## Step 3 — Deploy to Vercel

```bash
# Install Vercel CLI if you haven't already
npm i -g vercel

# In the booking-app folder:
vercel
```

Follow the prompts. Then add your environment variables in the Vercel dashboard
(Settings → Environment Variables) or via CLI:

```bash
vercel env add GOOGLE_CLIENT_ID
vercel env add GOOGLE_CLIENT_SECRET
vercel env add GOOGLE_REFRESH_TOKEN
vercel env add RESEND_API_KEY
vercel env add FROM_EMAIL          # e.g. hello@flourishonline.com.au
vercel env add FROM_NAME           # e.g. Lis Nagle
vercel env add REPLY_TO_EMAIL      # e.g. lis@flourishonline.com.au
vercel env add TIMEZONE            # Australia/Brisbane
vercel env add TIMEZONE_LABEL      # AEST
vercel env add OWNER_NAME          # Lis Nagle
```

Then redeploy:
```bash
vercel --prod
```

---

## Step 4 — Resend (for confirmation emails)

1. Log into https://resend.com
2. Add & verify your domain (same DNS process as your copy generator)
3. Copy your API key → add as `RESEND_API_KEY`
4. Set `FROM_EMAIL` to an address on your verified domain

> **Note**: Google also sends a calendar invite automatically when the event is created,
> so clients get two emails — the Google invite (plain) and your branded confirmation.

---

## Customising your services

Edit the `CONFIG.services` array in `index.html`:

```js
{ id: 'discovery', name: 'Discovery Call', icon: '✨', duration: 30, desc: '...' },
```

- `duration` is in **minutes**
- `id` just needs to be unique

---

## Customising working hours

In `index.html` CONFIG:
```js
workingHours: { start: 9, end: 17 },  // 9am–5pm
workingDays: [1, 2, 3, 4, 5],         // 0=Sun, 1=Mon ... 6=Sat
slotIntervalMins: 30,                  // slot increment
bufferMins: 15,                        // gap between bookings
advanceDays: 60,                       // how far ahead clients can book
```

---

## File structure

```
booking-app/
├── index.html          ← The client-facing booking page
├── api/
│   ├── availability.js ← Returns free/busy from Google Calendar
│   └── book.js         ← Creates event + Meet link + sends email
├── scripts/
│   └── get-token.js    ← Run once to get your refresh token
├── package.json
├── vercel.json
└── SETUP.md            ← This file
```
