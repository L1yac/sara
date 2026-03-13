const https = require("https");

function makeRequest(options, payload) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
        catch (e) { resolve({ status: res.statusCode, data: body }); }
      });
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  const { name, email, phone, startTime } = req.body;
  const apiKey = process.env.GHL_API_KEY;
  const calendarId = process.env.GHL_CALENDAR_ID;
  const locationId = process.env.GHL_LOCATION_ID;

  try {
    const nameParts = name.trim().split(" ");
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(" ") || "";

    const contactPayload = JSON.stringify({ firstName, lastName, email, phone, locationId });

    const contactResult = await makeRequest({
      hostname: "services.leadconnectorhq.com",
      path: "/contacts/",
      method: "POST",
      headers: {
        "Authorization": "Bearer " + apiKey,
        "Version": "2021-04-15",
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(contactPayload),
      },
    }, contactPayload);

    const contactId = contactResult.data?.contact?.id;
    if (!contactId) {
      return res.status(500).json({ error: "No se pudo crear el contacto", detail: contactResult.data });
    }

    const start = new Date(startTime);
    const endTime = new Date(start.getTime() + 30 * 60 * 1000).toISOString();

    const apptPayload = JSON.stringify({
      calendarId,
      locationId,
      contactId,
      startTime,
      endTime,
      appointmentStatus: "confirmed",
      selectedTimezone: "Europe/Madrid",
      title: "Demo Dentraia - " + name,
    });

    const apptResult = await makeRequest({
      hostname: "services.leadconnectorhq.com",
      path: "/calendars/events/appointments",
      method: "POST",
      headers: {
        "Authorization": "Bearer " + apiKey,
        "Version": "2021-04-15",
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(apptPayload),
      },
    }, apptPayload);

    if (apptResult.status !== 200 && apptResult.status !== 201) {
      return res.status(500).json({ error: "No se pudo crear la cita", detail: apptResult.data });
    }

    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
