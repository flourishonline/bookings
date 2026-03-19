const { google } = require('googleapis');
const { Resend } = require('resend');

function getOAuthClient() {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'http://localhost'
  );
  client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return client;
}

function addMins(time, mins) {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + mins;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function friendlyDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

function friendlyTime(time) {
  const [h, m] = time.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')}${h >= 12 ? 'pm' : 'am'}`;
}

function confirmationEmail({ firstName, lastName, serviceName, duration, date, time, meetLink }) {
  const endTime = addMins(time, duration);
  const tz = process.env.TIMEZONE_LABEL || 'AEST';
  const ownerName = process.env.OWNER_NAME || 'Lis Nagle';
  const ownerEmail = process.env.FROM_EMAIL || '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,400&family=Jost:wght@300;400;500&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #f5f2ee; font-family: 'Jost', Arial, sans-serif; color: #1a1612; }
</style>
</head>
<body style="padding:40px 20px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;">
    <tr>
      <td style="background:#0d0d0d;border-radius:16px 16px 0 0;padding:36px 40px;text-align:center;">
        <p style="font-family:'Jost',Arial,sans-serif;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#c9a96e;margin-bottom:10px;">Booking Confirmed</p>
        <h1 style="font-family:'Cormorant Garamond',Georgia,serif;font-size:36px;font-weight:300;color:#f0ece4;line-height:1.1;">
          You're <em style="font-style:italic;color:#e8cc9a;">all set</em>, ${firstName}.
        </h1>
      </td>
    </tr>
    <tr>
      <td style="background:#ffffff;padding:36px 40px;">

        <p style="font-size:14px;font-weight:300;color:#5a5550;line-height:1.6;margin-bottom:28px;">
          Your session has been confirmed and added to your calendar. Here are your details:
        </p>

        <!-- Details block -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#faf8f4;border:1px solid #e0d8ce;border-radius:10px;padding:0;margin-bottom:28px;">
          <tr>
            <td style="padding:20px 24px;border-bottom:1px solid #e0d8ce;">
              <p style="font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#c9a96e;margin-bottom:4px;">Session</p>
              <p style="font-family:'Cormorant Garamond',Georgia,serif;font-size:20px;font-weight:400;color:#1a1612;">${serviceName}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 24px;border-bottom:1px solid #e0d8ce;">
              <p style="font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#c9a96e;margin-bottom:4px;">Date & Time</p>
              <p style="font-family:'Cormorant Garamond',Georgia,serif;font-size:20px;font-weight:400;color:#1a1612;">${friendlyDate(date)}</p>
              <p style="font-size:14px;font-weight:300;color:#5a5550;margin-top:2px;">${friendlyTime(time)} – ${friendlyTime(endTime)} ${tz}</p>
            </td>
          </tr>
          ${meetLink ? `
          <tr>
            <td style="padding:20px 24px;">
              <p style="font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#c9a96e;margin-bottom:8px;">Google Meet Link</p>
              <a href="${meetLink}" style="display:inline-block;background:#0d0d0d;color:#c9a96e;font-family:'Jost',Arial,sans-serif;font-size:13px;font-weight:500;letter-spacing:0.5px;padding:11px 22px;border-radius:8px;text-decoration:none;">
                Join Meeting →
              </a>
              <p style="font-size:12px;color:#9a9088;margin-top:8px;font-weight:300;">${meetLink}</p>
            </td>
          </tr>` : ''}
        </table>

        <p style="font-size:13px;font-weight:300;color:#7a7568;line-height:1.6;margin-bottom:28px;">
          A calendar invite has been sent to this email address. If you need to reschedule or have any questions, just reply to this email.
        </p>

        <p style="font-size:14px;font-weight:400;color:#1a1612;">
          Looking forward to it,<br>
          <span style="font-family:'Cormorant Garamond',Georgia,serif;font-size:20px;font-style:italic;">${ownerName}</span>
        </p>
      </td>
    </tr>
    <tr>
      <td style="background:#f0ece4;border-radius:0 0 16px 16px;padding:20px 40px;text-align:center;">
        <p style="font-size:11px;color:#9a9088;font-weight:300;">
          ${ownerEmail ? `<a href="mailto:${ownerEmail}" style="color:#9a9088;">${ownerEmail}</a> · ` : ''}flourishonline.com.au
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { service, date, time, firstName, lastName, email, notes } = req.body || {};
  if (!service || !date || !time || !firstName || !lastName || !email) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const timezone = process.env.TIMEZONE || 'Australia/Brisbane';
  const endTime = addMins(time, service.duration);

  try {
    // ── 1. Create Google Calendar event with Meet ──────────────────────
    const auth = getOAuthClient();
    const calendar = google.calendar({ version: 'v3', auth });

    const eventResponse = await calendar.events.insert({
      calendarId: 'primary',
      conferenceDataVersion: 1,
      sendUpdates: 'all', // Google sends calendar invite email to attendees
      requestBody: {
        summary: `${service.name} — ${firstName} ${lastName}`,
        description: [
          `Client: ${firstName} ${lastName}`,
          `Email: ${email}`,
          `Duration: ${service.duration} minutes`,
          notes ? `\nNotes from client:\n${notes}` : '',
          `\nBooked via flourishonline.com.au`,
        ].filter(Boolean).join('\n'),
        start: { dateTime: `${date}T${time}:00`, timeZone: timezone },
        end: { dateTime: `${date}T${endTime}:00`, timeZone: timezone },
        attendees: [{ email, displayName: `${firstName} ${lastName}` }],
        conferenceData: {
          createRequest: {
            requestId: `flourish-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 }, // 1 day before
            { method: 'popup', minutes: 15 },
          ],
        },
      },
    });

    const event = eventResponse.data;
    const meetLink = event.conferenceData?.entryPoints?.find(
      (e) => e.entryPointType === 'video'
    )?.uri || null;

    // ── 2. Send branded confirmation email via Resend ──────────────────
    if (process.env.RESEND_API_KEY && process.env.FROM_EMAIL) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const ownerName = process.env.OWNER_NAME || 'Lis Nagle';

      await resend.emails.send({
        from: `${ownerName} <${process.env.FROM_EMAIL}>`,
        to: email,
        replyTo: process.env.REPLY_TO_EMAIL || process.env.FROM_EMAIL,
        subject: `Your ${service.name} is confirmed ✨`,
        html: confirmationEmail({
          firstName, lastName, serviceName: service.name,
          duration: service.duration, date, time, meetLink,
        }),
      });
    }

    res.status(200).json({
      success: true,
      eventId: event.id,
      meetLink,
      htmlLink: event.htmlLink,
    });
  } catch (err) {
    console.error('booking error:', err.message, err.response?.data);
    res.status(500).json({ error: 'Failed to create booking', detail: err.message });
  }
};
