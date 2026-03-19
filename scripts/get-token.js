/**
 * run once locally to get your Google refresh token:
 *   node scripts/get-token.js
 *
 * you'll need to set these env vars first (or paste them in below):
 *   GOOGLE_CLIENT_ID
 *   GOOGLE_CLIENT_SECRET
 */

const { google } = require('googleapis');
const http = require('http');
const url = require('url');

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'PASTE_YOUR_CLIENT_ID_HERE';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'PASTE_YOUR_CLIENT_SECRET_HERE';
const REDIRECT = 'http://localhost:3999/callback';

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events',
  ],
});

console.log('\n──────────────────────────────────────────────');
console.log('  Open this URL in your browser:');
console.log('\n ', authUrl);
console.log('\n──────────────────────────────────────────────\n');

const server = http.createServer(async (req, res) => {
  const { pathname, query } = url.parse(req.url, true);
  if (pathname !== '/callback') return;

  const { code } = query;
  try {
    const { tokens } = await oauth2Client.getToken(code);
    res.end('<h2>✅ Success! Check your terminal for your refresh token.</h2><p>You can close this tab.</p>');
    server.close();

    console.log('\n✅ Your refresh token (save this as GOOGLE_REFRESH_TOKEN in Vercel):\n');
    console.log(tokens.refresh_token);
    console.log('\n──────────────────────────────────────────────\n');
  } catch (e) {
    res.end('<h2>Error: ' + e.message + '</h2>');
    server.close();
  }
});

server.listen(3999, () => {
  console.log('Waiting for Google to redirect… (server on :3999)');
});
