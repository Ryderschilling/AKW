/* GET /api/slots
   Which site-visit slots are already taken on AKW's Google Calendar.
   { live: true,  taken: { "2026-09-22": ["09:00","11:00"], ... } }
   { live: false, taken: {} }   calendar not connected yet, every slot open
   Never returns event titles or details, only which slots are busy. */

const L = require("./_lib");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return L.send(res, 405, { ok: false });
  }
  const days = L.bookableDays();
  if (!L.calendarConfigured()) return L.send(res, 200, { ok: true, live: false, days: days, taken: {} });

  try {
    const from = L.chicagoToDate(days[0], "00:00");
    const to = L.chicagoToDate(days[days.length - 1], "23:59");
    const busy = await L.busyBetween(from, to);
    const taken = {};
    days.forEach(function (ymd) {
      const t = L.SLOTS.filter(function (hm) { return L.slotTaken(busy, ymd, hm); });
      if (t.length) taken[ymd] = t;
    });
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ ok: true, live: true, days: days, taken: taken });
  } catch (e) {
    /* calendar hiccup: the form still works, the booking still emails */
    console.error("slots: " + e.message);
    return L.send(res, 200, { ok: true, live: false, days: days, taken: {} });
  }
};
