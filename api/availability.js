const { google } = require('googleapis');

function getOAuthClient() {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'http://localhost' // redirect not used for server-side flow
  );
  client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return client;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { year, month } = req.query;
  if (!year || !month) return res.status(400).json({ error: 'year and month required' });

  const timezone = process.env.TIMEZONE || 'Australia/Brisbane';
  // Anchor the freebusy window to Brisbane midnight, not server-local midnight.
  // Brisbane is fixed UTC+10 (no DST).
  const tzOffset = '+10:00';
  const yyyy = parseInt(year);
  const mm = parseInt(month);
  const pad = (n) => String(n).padStart(2, '0');
  const lastDay = new Date(Date.UTC(yyyy, mm + 1, 0)).getUTCDate();
  const timeMin = `${yyyy}-${pad(mm + 1)}-01T00:00:00${tzOffset}`;
  const timeMax = `${yyyy}-${pad(mm + 1)}-${pad(lastDay)}T23:59:59${tzOffset}`;

  try {
    const auth = getOAuthClient();
    const calendar = google.calendar({ version: 'v3', auth });

    const response = await calendar.freebusy.query({
      requestBody: {
        timeMin,
        timeMax,
        timeZone: timezone,
        items: [{ id: 'primary' }],
      },
    });

    const busy = response.data.calendars?.primary?.busy || [];
    res.status(200).json({ busy });
  } catch (err) {
    console.error('availability error:', err.message);
    res.status(500).json({ error: 'Failed to fetch availability', detail: err.message });
  }
};
