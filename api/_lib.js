/* AKW Excavating, shared helpers for the /api functions.
   Zero dependencies on purpose: Resend and Google Calendar are both called
   over plain REST with fetch, and the Google service-account JWT is signed
   with Node's own crypto. No package.json, no build step.
   Files starting with "_" are never exposed as routes by Vercel. */

const crypto = require("crypto");

const TZ = "America/Chicago";
/* Site-visit slots. Keep in sync with the buttons the page draws (script.js). */
const SLOTS = ["07:00", "09:00", "11:00", "13:00", "15:00", "17:00"];
const SLOT_MINUTES = 120;   // a slot counts as taken if anything overlaps this window
const EVENT_MINUTES = 60;   // what actually lands on the calendar
const DAYS_AHEAD = 14;

const MAX_FIELD = 2000;

function clean(v, max) {
  return String(v == null ? "" : v).slice(0, max || MAX_FIELD).replace(/\r\n?/g, "\n").trim();
}
function oneLine(v, max) {
  return clean(v, max || 200).replace(/[\r\n]+/g, " ");
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}
function isEmail(s) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(s);
}

async function readBody(req) {
  let body = req.body;
  if (typeof body === "string") {
    if (body.length > 20000) throw new Error("too_large");
    body = JSON.parse(body);
  }
  if (!body || typeof body !== "object") throw new Error("bad_body");
  return body;
}

/* ---------- time: wall-clock Chicago <-> UTC ---------- */

/* "GMT-05:00" -> -300 for the given instant in Chicago */
function tzOffsetMinutes(date) {
  const part = new Intl.DateTimeFormat("en-US", { timeZone: TZ, timeZoneName: "longOffset" })
    .formatToParts(date).find(function (p) { return p.type === "timeZoneName"; });
  const m = /GMT([+-])(\d{2}):?(\d{2})?/.exec(part ? part.value : "");
  if (!m) return 0;
  const mins = parseInt(m[2], 10) * 60 + parseInt(m[3] || "0", 10);
  return m[1] === "-" ? -mins : mins;
}

/* "2026-09-22","09:00" (Chicago wall time) -> Date (UTC instant) */
function chicagoToDate(ymd, hm) {
  const guess = new Date(ymd + "T" + hm + ":00Z");
  const off = tzOffsetMinutes(guess);
  const d = new Date(guess.getTime() - off * 60000);
  /* re-check across a DST edge */
  const off2 = tzOffsetMinutes(d);
  return off2 === off ? d : new Date(guess.getTime() - off2 * 60000);
}

function chicagoYmd(date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/* the bookable days: tomorrow onward, no Sundays (matches the page) */
function bookableDays(now) {
  const out = [];
  const start = chicagoYmd(now || new Date());
  let t = new Date(start + "T12:00:00Z").getTime();
  while (out.length < DAYS_AHEAD) {
    t += 86400000;
    const d = new Date(t);
    if (d.getUTCDay() === 0) continue;
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function prettyDay(ymd) {
  const d = new Date(ymd + "T12:00:00Z");
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
}
function prettyTime(hm) {
  let h = parseInt(hm.slice(0, 2), 10);
  const m = hm.slice(3);
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return h + ":" + m + " " + ap;
}

/* ---------- Google Calendar via a service account ---------- */

function calendarConfigured() {
  return !!(process.env.GOOGLE_SA_EMAIL && process.env.GOOGLE_SA_KEY && process.env.GOOGLE_CALENDAR_ID);
}

let cachedToken = null;
async function googleToken() {
  if (cachedToken && cachedToken.exp > Date.now() + 60000) return cachedToken.value;
  const now = Math.floor(Date.now() / 1000);
  const b64 = function (o) { return Buffer.from(JSON.stringify(o)).toString("base64url"); };
  const unsigned = b64({ alg: "RS256", typ: "JWT" }) + "." + b64({
    iss: process.env.GOOGLE_SA_EMAIL,
    scope: "https://www.googleapis.com/auth/calendar",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  });
  const key = process.env.GOOGLE_SA_KEY.replace(/\\n/g, "\n");
  const sig = crypto.createSign("RSA-SHA256").update(unsigned).sign(key).toString("base64url");
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=" + unsigned + "." + sig,
  });
  if (!r.ok) throw new Error("google_token_" + r.status);
  const j = await r.json();
  cachedToken = { value: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return cachedToken.value;
}

/* busy intervals [{start,end}] as Date pairs */
async function busyBetween(from, to) {
  const tok = await googleToken();
  const r = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: { Authorization: "Bearer " + tok, "Content-Type": "application/json" },
    body: JSON.stringify({ timeMin: from.toISOString(), timeMax: to.toISOString(), timeZone: TZ, items: [{ id: process.env.GOOGLE_CALENDAR_ID }] }),
  });
  if (!r.ok) throw new Error("google_freebusy_" + r.status);
  const j = await r.json();
  const cal = j.calendars && j.calendars[process.env.GOOGLE_CALENDAR_ID];
  if (!cal || (cal.errors && cal.errors.length)) throw new Error("google_freebusy_calendar");
  return (cal.busy || []).map(function (b) { return { start: new Date(b.start), end: new Date(b.end) }; });
}

function slotTaken(busy, ymd, hm) {
  const s = chicagoToDate(ymd, hm);
  const e = new Date(s.getTime() + SLOT_MINUTES * 60000);
  return busy.some(function (b) { return b.start < e && b.end > s; });
}

async function insertEvent(ev) {
  const tok = await googleToken();
  const r = await fetch("https://www.googleapis.com/calendar/v3/calendars/" + encodeURIComponent(process.env.GOOGLE_CALENDAR_ID) + "/events", {
    method: "POST",
    headers: { Authorization: "Bearer " + tok, "Content-Type": "application/json" },
    body: JSON.stringify(ev),
  });
  if (!r.ok) throw new Error("google_insert_" + r.status);
  return r.json();
}

/* ---------- .ics so the visit drops onto any calendar in one tap ---------- */

function icsStamp(d) {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}
function icsText(s) {
  return String(s).replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}
function buildIcs(o) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AKW Excavating//Site visit//EN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    "UID:" + o.uid,
    "DTSTAMP:" + icsStamp(new Date()),
    "DTSTART:" + icsStamp(o.start),
    "DTEND:" + icsStamp(o.end),
    "SUMMARY:" + icsText(o.summary),
    "DESCRIPTION:" + icsText(o.description),
    "LOCATION:" + icsText(o.location || ""),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n") + "\r\n";
}

/* ---------- Resend ---------- */

function mailConfigured() {
  return !!(process.env.RESEND_API_KEY && process.env.LEADS_TO && process.env.LEADS_FROM);
}
function leadRecipients() {
  return String(process.env.LEADS_TO || "").split(",").map(function (s) { return s.trim(); }).filter(isEmail);
}

async function sendMail(payload) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + process.env.RESEND_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(Object.assign({ from: process.env.LEADS_FROM }, payload)),
  });
  if (!r.ok) {
    /* status only. The body could echo the lead back into the logs. */
    console.error("mail: resend responded " + r.status);
    throw new Error("send_failed");
  }
  return r.json();
}

/* One branded email body, rows of label/value */
function emailHtml(kicker, intro, rows, footer) {
  return (
    '<div style="background:#FAF7F1;padding:28px 0">' +
    '<div style="max-width:560px;margin:0 auto;background:#fff;border-top:6px solid #C1272D;font:15px/1.6 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#181818">' +
    '<div style="padding:26px 30px 8px">' +
    '<p style="margin:0 0 6px;font:700 11px/1 Arial,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:#C1272D">' + escapeHtml(kicker) + "</p>" +
    (intro ? '<p style="margin:10px 0 18px;font-size:17px;font-weight:600">' + intro + "</p>" : "") +
    "</div>" +
    '<table role="presentation" style="width:100%;border-collapse:collapse">' +
    rows.map(function (r) {
      return '<tr><td style="padding:10px 30px;border-top:1px solid #EFE7D8;width:34%;vertical-align:top;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#7B746A">' +
        escapeHtml(r[0]) + '</td><td style="padding:10px 30px 10px 0;border-top:1px solid #EFE7D8;vertical-align:top">' +
        escapeHtml(r[1]).replace(/\n/g, "<br>") + "</td></tr>";
    }).join("") +
    "</table>" +
    '<div style="padding:18px 30px 26px;border-top:1px solid #EFE7D8;color:#7B746A;font-size:13px">' + (footer || "") + "</div>" +
    "</div></div>"
  );
}

function send(res, code, obj) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(code).json(obj);
}

module.exports = {
  TZ, SLOTS, SLOT_MINUTES, EVENT_MINUTES,
  clean, oneLine, escapeHtml, isEmail, readBody,
  chicagoToDate, chicagoYmd, bookableDays, prettyDay, prettyTime,
  calendarConfigured, busyBetween, slotTaken, insertEvent,
  buildIcs, mailConfigured, leadRecipients, sendMail, emailHtml, send,
};
