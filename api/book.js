/* POST /api/book
   A site-visit request from the booking form.
   1. Validates the day and time against the same slot list the page shows.
   2. If AKW's Google Calendar is connected: re-checks the slot is still free
      (409 if someone just took it) and puts the visit on the calendar.
   3. Emails AKW every detail through Resend, with an .ics attached so it can
      be added to any calendar in one tap when the calendar is not connected.
   4. If the customer left an email, sends them a confirmation with the same .ics.
   The lead email is the one step that must succeed. The calendar and the
   customer confirmation are best effort and never block it. */

const L = require("./_lib");

const TYPES = [
  "Farm drainage or field tile",
  "Waterway",
  "Pond, new or cleanout",
  "Site prep, basement or grading",
  "Clearing or tree mulching",
  "Something else",
];

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return L.send(res, 405, { ok: false, error: "method_not_allowed" });
  }
  if (!L.mailConfigured()) {
    console.error("book: missing env (RESEND_API_KEY, LEADS_TO, LEADS_FROM)");
    return L.send(res, 500, { ok: false, error: "not_configured" });
  }

  let b;
  try { b = await L.readBody(req); } catch (e) { return L.send(res, 400, { ok: false, error: "bad_body" }); }

  /* honeypot: a real person never fills a field they cannot see */
  if (L.clean(b.company)) return L.send(res, 200, { ok: true, calendar: false });

  const day = L.oneLine(b.day, 10);
  const time = L.oneLine(b.time, 5);
  const name = L.oneLine(b.name, 120);
  const phone = L.oneLine(b.phone, 40);
  const email = L.oneLine(b.email, 160);
  const place = L.oneLine(b.place, 200);
  const type = TYPES.indexOf(b.type) >= 0 ? b.type : "";
  const notes = L.clean(b.notes, 1500);

  const days = L.bookableDays();
  if (days.indexOf(day) < 0 || L.SLOTS.indexOf(time) < 0) return L.send(res, 400, { ok: false, error: "bad_slot" });
  if (!name || phone.replace(/\D/g, "").length < 7 || !place || !type) return L.send(res, 400, { ok: false, error: "missing" });
  if (email && !L.isEmail(email)) return L.send(res, 400, { ok: false, error: "bad_email" });

  const start = L.chicagoToDate(day, time);
  const end = new Date(start.getTime() + L.EVENT_MINUTES * 60000);
  const when = L.prettyDay(day) + " at " + L.prettyTime(time);
  const summary = "Site visit: " + name + " (" + type + ")";
  const details = [
    "Name: " + name,
    "Phone: " + phone,
    email ? "Email: " + email : "",
    "Property: " + place,
    "Work: " + type,
    notes ? "Notes: " + notes : "",
    "",
    "Booked on the AKW website. Call to confirm.",
  ].filter(function (x, i, a) { return x !== "" || i === a.length - 2; }).join("\n");

  /* ---- calendar (best effort) ---- */
  let onCalendar = false;
  if (L.calendarConfigured()) {
    try {
      const busy = await L.busyBetween(start, new Date(start.getTime() + L.SLOT_MINUTES * 60000));
      if (L.slotTaken(busy, day, time)) return L.send(res, 409, { ok: false, error: "taken" });
      await L.insertEvent({
        summary: summary,
        location: place,
        description: details,
        start: { dateTime: start.toISOString(), timeZone: L.TZ },
        end: { dateTime: end.toISOString(), timeZone: L.TZ },
        colorId: "11",
        reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 60 }, { method: "popup", minutes: 1440 }] },
      });
      onCalendar = true;
    } catch (e) {
      console.error("book: calendar " + e.message);
    }
  }

  const uid = "akw-" + day + "-" + time.replace(":", "") + "-" + Date.now().toString(36) + "@akwexcavatinginc.com";
  const ics = Buffer.from(L.buildIcs({ uid: uid, start: start, end: end, summary: summary, description: details, location: place })).toString("base64");
  const telDigits = phone.replace(/[^\d+]/g, "");

  /* ---- lead email to AKW (must succeed) ---- */
  const rows = [
    ["When", when],
    ["Name", name],
    ["Phone", phone],
    ["Email", email || "not given"],
    ["Property", place],
    ["Work", type],
  ];
  if (notes) rows.push(["Notes", notes]);
  try {
    await L.sendMail({
      to: L.leadRecipients(),
      reply_to: email || undefined,
      subject: "Site visit request: " + name + ", " + when,
      text: "New site visit request\n\nWhen: " + when + "\n" + details +
        (onCalendar ? "\n\nIt is already on the AKW calendar." : "\n\nTap the attached invite to put it on your calendar."),
      html: L.emailHtml(
        "New site visit request",
        L.escapeHtml(when) + '<br><a href="tel:' + L.escapeHtml(telDigits) + '" style="color:#C1272D">Call ' + L.escapeHtml(name.split(" ")[0]) + " now: " + L.escapeHtml(phone) + "</a>",
        rows,
        onCalendar ? "Already on the AKW calendar. Call to confirm the time." : "Open the attached invite to add it to your calendar. Call to confirm the time."
      ),
      attachments: onCalendar ? undefined : [{ filename: "site-visit.ics", content: ics, content_type: "text/calendar" }],
    });
  } catch (e) {
    return L.send(res, 502, { ok: false, error: "send_failed" });
  }

  /* ---- confirmation to the customer (best effort) ---- */
  if (email) {
    try {
      await L.sendMail({
        to: [email],
        reply_to: L.leadRecipients()[0],
        subject: "Your AKW Excavating site visit request, " + when,
        text: "Hi " + name.split(" ")[0] + ",\n\nThanks for booking with AKW Excavating. You asked for a site visit on " + when +
          " at " + place + ".\n\nKevin or Cooper will call you at " + phone + " to confirm the time. Need us sooner? Call Kevin at (309) 303-1854.\n\nAKW Excavating Inc\nBrimfield, Illinois",
        html: L.emailHtml(
          "Site visit requested",
          "Thanks, " + L.escapeHtml(name.split(" ")[0]) + ". Kevin or Cooper will call to confirm your visit.",
          [["When", when], ["Where", place], ["Work", type], ["We will call", phone]],
          'Need us sooner? Call Kevin at <a href="tel:+13093031854" style="color:#C1272D">(309) 303-1854</a>.<br>AKW Excavating Inc, Brimfield, Illinois'
        ),
        attachments: [{ filename: "akw-site-visit.ics", content: ics, content_type: "text/calendar" }],
      });
    } catch (e) { /* the lead already reached AKW */ }
  }

  return L.send(res, 200, { ok: true, calendar: onCalendar, when: when });
};
