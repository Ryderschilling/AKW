/* POST /api/contact
   The short "send a note" form. One email to AKW through Resend, reply-to the
   sender when they left an email. Nothing is stored. */

const L = require("./_lib");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return L.send(res, 405, { ok: false, error: "method_not_allowed" });
  }
  if (!L.mailConfigured()) {
    console.error("contact: missing env (RESEND_API_KEY, LEADS_TO, LEADS_FROM)");
    return L.send(res, 500, { ok: false, error: "not_configured" });
  }
  let b;
  try { b = await L.readBody(req); } catch (e) { return L.send(res, 400, { ok: false, error: "bad_body" }); }
  if (L.clean(b.company)) return L.send(res, 200, { ok: true });

  const name = L.oneLine(b.name, 120);
  const phone = L.oneLine(b.phone, 40);
  const message = L.clean(b.message, 3000);
  const page = L.oneLine(b.page, 120);
  if (!name || phone.replace(/\D/g, "").length < 7 || !message) return L.send(res, 400, { ok: false, error: "missing" });

  const telDigits = phone.replace(/[^\d+]/g, "");
  try {
    await L.sendMail({
      to: L.leadRecipients(),
      subject: "Website message from " + name,
      text: "New message from the AKW website\n\nName: " + name + "\nPhone: " + phone + "\n\n" + message + (page ? "\n\nSent from: " + page : ""),
      html: L.emailHtml(
        "Website message",
        '<a href="tel:' + L.escapeHtml(telDigits) + '" style="color:#C1272D">Call ' + L.escapeHtml(name.split(" ")[0]) + " back: " + L.escapeHtml(phone) + "</a>",
        [["Name", name], ["Phone", phone], ["Message", message]].concat(page ? [["Page", page]] : []),
        "Sent from the contact form on the AKW Excavating website."
      ),
    });
  } catch (e) {
    return L.send(res, 502, { ok: false, error: "send_failed" });
  }
  return L.send(res, 200, { ok: true });
};
