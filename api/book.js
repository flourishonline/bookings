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

// Render a Brisbane-local date/time pair as a date + time string in any
// IANA timezone (e.g. "America/New_York"). Used for the visitor's
// confirmation email so they see times in their own timezone.
function friendlyDateTimeInTZ(dateStr, time, timezone) {
  // dateStr + time are in Brisbane (UTC+10, no DST).
  const dt = new Date(`${dateStr}T${time}:00+10:00`);
  const dateOut = dt.toLocaleDateString('en-AU', {
    timeZone: timezone,
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  // Build "h:MMam/pm" manually so the format matches friendlyTime().
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric', minute: '2-digit', hour12: false,
  }).formatToParts(dt);
  const h = parseInt(parts.find(p => p.type === 'hour').value, 10);
  const m = parts.find(p => p.type === 'minute').value;
  const timeOut = `${h % 12 || 12}:${m}${h >= 12 ? 'pm' : 'am'}`;
  return { date: dateOut, time: timeOut };
}

function confirmationEmail({ firstName, lastName, serviceName, duration, date, time, meetLink, bookingUrl, clientTimezone, clientTimezoneLabel }) {
  const endTime = addMins(time, duration);
  const hostTzLabel = process.env.TIMEZONE_LABEL || 'AEST';
  const hostTimezone = process.env.TIMEZONE || 'Australia/Brisbane';
  const ownerName = process.env.OWNER_NAME || 'Lis Nagle';
  const ownerEmail = process.env.FROM_EMAIL || '';
  const rescheduleUrl = bookingUrl || process.env.BOOKING_URL || 'https://bookings-mocha-two.vercel.app';

  // Render the date/time in the visitor's timezone when we have one,
  // otherwise fall back to Brisbane time.
  const useVisitorTz = !!clientTimezone && clientTimezone !== hostTimezone;
  const startFmt = useVisitorTz
    ? friendlyDateTimeInTZ(date, time, clientTimezone)
    : { date: friendlyDate(date), time: friendlyTime(time) };
  const endFmt = useVisitorTz
    ? friendlyDateTimeInTZ(date, endTime, clientTimezone)
    : { date: friendlyDate(date), time: friendlyTime(endTime) };
  const tzDisplay = useVisitorTz ? (clientTimezoneLabel || clientTimezone) : hostTzLabel;
  // If the visitor's local date is different from Brisbane (e.g. NYC on Mon
  // when Brisbane is Tue), show both for clarity.
  const hostStartFmt = { date: friendlyDate(date), time: friendlyTime(time) };
  const hostEndFmt = { date: friendlyDate(date), time: friendlyTime(endTime) };
  const showHostLine = useVisitorTz && (startFmt.date !== hostStartFmt.date);

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:40px 20px;background:#F5F0E8;font-family:Arial,sans-serif;color:#193133;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;">
    <tr>
      <td style="background:#193133;padding:36px 40px;text-align:center;">
        <p style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#C1EAD8;margin:0 0 12px;">Booking Confirmed</p>
        <h1 style="font-size:34px;font-weight:700;color:#ffffff;line-height:1.1;margin:0;font-style:italic;">You're all set, ${firstName}!</h1>
      </td>
    </tr>
    <tr>
      <td style="background:#ffffff;padding:36px 40px;">
        <p style="font-size:14px;color:#5a5550;line-height:1.7;margin:0 0 28px;">Your session is confirmed and has been added to your calendar. Here are your details:</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F0E8;border-left:4px solid #C41230;margin-bottom:28px;">
          <tr>
            <td style="padding:18px 22px;border-bottom:1px solid #e0d8ce;">
              <p style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#C41230;margin:0 0 4px;font-weight:700;">Session</p>
              <p style="font-size:18px;font-weight:700;color:#193133;margin:0;text-transform:uppercase;letter-spacing:0.5px;">${serviceName}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 22px;border-bottom:1px solid #e0d8ce;">
              <p style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#C41230;margin:0 0 4px;font-weight:700;">Date & Time</p>
              <p style="font-size:18px;font-weight:700;color:#193133;margin:0 0 2px;">${startFmt.date}</p>
              <p style="font-size:14px;color:#5a5550;margin:0;">${startFmt.time} – ${endFmt.time} ${tzDisplay}</p>
              ${showHostLine ? `<p style="font-size:12px;color:#9a9088;margin:6px 0 0;">(${hostStartFmt.date}, ${hostStartFmt.time} – ${hostEndFmt.time} ${hostTzLabel})</p>` : ''}
            </td>
          </tr>
          ${meetLink ? `
          <tr>
            <td style="padding:18px 22px;">
              <p style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#C41230;margin:0 0 10px;font-weight:700;">Google Meet Link</p>
              <a href="${meetLink}" style="display:inline-block;background:#C41230;color:#ffffff;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;padding:13px 24px;text-decoration:none;">JOIN MEETING →</a>
              <p style="font-size:11px;color:#9a9088;margin:10px 0 0;">${meetLink}</p>
            </td>
          </tr>` : ''}
        </table>
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f8f4;border:1px solid #C1EAD8;margin-bottom:28px;">
          <tr>
            <td style="padding:16px 20px;">
              <p style="font-size:13px;color:#193133;margin:0;line-height:1.6;"><strong>📅 Reminders:</strong> You'll receive a reminder email 24 hours before and again 1 hour before your session.</p>
            </td>
          </tr>
        </table>
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#faf8f4;border:1px solid #e0d8ce;margin-bottom:28px;">
          <tr>
            <td style="padding:18px 22px;">
              <p style="font-size:13px;font-weight:700;color:#193133;margin:0 0 6px;text-transform:uppercase;letter-spacing:0.5px;">Need to reschedule?</p>
              <p style="font-size:13px;color:#5a5550;margin:0 0 12px;line-height:1.6;">No problem — life happens! Use the link below to pick a new time, or reply to this email and Lis will sort it out.</p>
              <a href="${rescheduleUrl}" style="display:inline-block;background:#193133;color:#ffffff;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;padding:11px 20px;text-decoration:none;">RESCHEDULE →</a>
            </td>
          </tr>
        </table>
        <p style="font-size:14px;color:#193133;margin:0;">Can't wait to work with you,<br><span style="font-size:22px;font-style:italic;font-weight:700;">${ownerName}</span></p>
      </td>
    </tr>
    <tr>
      <td style="background:#193133;padding:18px 40px;text-align:center;">
        <p style="font-size:11px;color:#C1EAD8;margin:0;">${ownerEmail ? `<a href="mailto:${ownerEmail}" style="color:#C1EAD8;text-decoration:none;">${ownerEmail}</a> &nbsp;·&nbsp; ` : ''}flourishonline.com.au</p>
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

  const { service, date, time, firstName, lastName, email, notes, clientTimezone, clientTimezoneLabel } = req.body || {};
  if (!service || !date || !time || !firstName || !lastName || !email) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const timezone = process.env.TIMEZONE || 'Australia/Brisbane';
  const endTime = addMins(time, service.duration);
  const bookingUrl = process.env.BOOKING_URL || 'https://bookings-mocha-two.vercel.app';

  try {
    const auth = getOAuthClient();
    const calendar = google.calendar({ version: 'v3', auth });

    const eventResponse = await calendar.events.insert({
      calendarId: 'primary',
      conferenceDataVersion: 1,
      sendUpdates: 'all',
      requestBody: {
        summary: `${service.name} — ${firstName} ${lastName}`,
        description: [
          `Client: ${firstName} ${lastName}`,
          `Email: ${email}`,
          `Duration: ${service.duration} minutes`,
          notes ? `\nNotes from client:\n${notes}` : '',
          `\nReschedule: ${bookingUrl}`,
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
            { method: 'email', minutes: 24 * 60 },
            { method: 'email', minutes: 60 },
            { method: 'popup', minutes: 60 },
          ],
        },
      },
    });

    const event = eventResponse.data;
    const meetLink = event.conferenceData?.entryPoints?.find(
      (e) => e.entryPointType === 'video'
    )?.uri || null;

    if (process.env.RESEND_API_KEY && process.env.FROM_EMAIL) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const ownerName = process.env.OWNER_NAME || 'Lis Nagle';
      const notifyEmail = process.env.NOTIFY_EMAIL || 'ellissa@flourishonline.com.au';
      const tz = process.env.TIMEZONE_LABEL || 'AEST';

      // 1. Confirmation email to client
      await resend.emails.send({
        from: `${ownerName} <${process.env.FROM_EMAIL}>`,
        to: email,
        replyTo: process.env.REPLY_TO_EMAIL || process.env.FROM_EMAIL,
        subject: `Your ${service.name} is confirmed ✨`,
        html: confirmationEmail({ firstName, lastName, serviceName: service.name, duration: service.duration, date, time, meetLink, bookingUrl, clientTimezone, clientTimezoneLabel }),
      });

      // 2. Notification email to Lis
      const endTime = addMins(time, service.duration);
      await resend.emails.send({
        from: `${ownerName} <${process.env.FROM_EMAIL}>`,
        to: notifyEmail,
        subject: `New booking: ${service.name} — ${firstName} ${lastName}`,
        html: `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:40px 20px;background:#F5F0E8;font-family:Arial,sans-serif;color:#193133;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;">
    <tr>
      <td style="background:#C41230;padding:24px 32px;">
        <p style="font-size:10px;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.7);margin:0 0 6px;">New Booking</p>
        <h1 style="font-size:22px;font-weight:700;color:#ffffff;margin:0;">${firstName} ${lastName}</h1>
      </td>
    </tr>
    <tr>
      <td style="background:#ffffff;padding:28px 32px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="border-left:4px solid #C41230;background:#F5F0E8;margin-bottom:20px;">
          <tr><td style="padding:14px 18px;border-bottom:1px solid #e0d8ce;">
            <p style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#C41230;margin:0 0 3px;font-weight:700;">Session</p>
            <p style="font-size:16px;font-weight:700;color:#193133;margin:0;">${service.name}</p>
          </td></tr>
          <tr><td style="padding:14px 18px;border-bottom:1px solid #e0d8ce;">
            <p style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#C41230;margin:0 0 3px;font-weight:700;">Date & Time</p>
            <p style="font-size:16px;font-weight:700;color:#193133;margin:0 0 2px;">${friendlyDate(date)}</p>
            <p style="font-size:13px;color:#5a5550;margin:0;">${friendlyTime(time)} – ${friendlyTime(endTime)} ${tz}</p>
            ${clientTimezone && clientTimezone !== (process.env.TIMEZONE || 'Australia/Brisbane') ? `<p style="font-size:12px;color:#9a9088;margin:6px 0 0;">Client is in ${clientTimezoneLabel || clientTimezone}</p>` : ''}
          </td></tr>
          <tr><td style="padding:14px 18px;border-bottom:1px solid #e0d8ce;">
            <p style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#C41230;margin:0 0 3px;font-weight:700;">Client Email</p>
            <p style="font-size:15px;color:#193133;margin:0;"><a href="mailto:${email}" style="color:#C41230;text-decoration:none;">${email}</a></p>
          </td></tr>
          ${notes ? `<tr><td style="padding:14px 18px;">
            <p style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#C41230;margin:0 0 3px;font-weight:700;">Their Notes</p>
            <p style="font-size:14px;color:#193133;margin:0;line-height:1.6;">${notes}</p>
          </td></tr>` : ''}
        </table>
        ${meetLink ? `<p style="margin:0 0 16px;"><a href="${meetLink}" style="display:inline-block;background:#193133;color:#ffffff;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;padding:11px 20px;text-decoration:none;">JOIN MEET →</a></p>` : ''}
        <p style="font-size:12px;color:#9a9088;margin:0;">This booking was made via flourishonline.com.au</p>
      </td>
    </tr>
    <tr>
      <td style="background:#193133;padding:16px 32px;text-align:center;">
        <p style="font-size:11px;color:#C1EAD8;margin:0;">Flourish Online Booking System</p>
      </td>
    </tr>
  </table>
</body>
</html>`,
      });
    }

    res.status(200).json({ success: true, eventId: event.id, meetLink, htmlLink: event.htmlLink });
  } catch (err) {
    console.error('booking error:', err.message, err.response?.data);
    res.status(500).json({ error: 'Failed to create booking', detail: err.message });
  }
};
