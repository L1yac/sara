const https = require("https");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const apiKey = process.env.GHL_API_KEY;
  const calendarId = process.env.GHL_CALENDAR_ID;

  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() + 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);

  const qs = "startDate=" + start.getTime() + "&endDate=" + end.getTime() + "&timezone=Europe%2FMadrid";

  return new Promise((resolve) => {
    const options = {
      hostname: "services.leadconnectorhq.com",
      path: "/calendars/" + calendarId + "/free-slots?" + qs,
      method: "GET",
      headers: {
        "Authorization": "Bearer " + apiKey,
        "Version": "2021-04-15",
        "Content-Type": "application/json",
      },
    };

    const req2 = https.request(options, (response) => {
      let body = "";
      response.on("data", (chunk) => { body += chunk; });
      response.on("end", () => {
        try {
          const data = JSON.parse(body);
          const slots = [];
          const dates = data._dates_ || data;
          for (const date of Object.keys(dates).sort()) {
            const dayData = dates[date];
            const daySlots = Array.isArray(dayData) ? dayData : (dayData.slots || []);
            for (const slot of daySlots) {
              if (slots.length < 2) slots.push(slot);
            }
            if (slots.length >= 2) break;
          }
          res.status(200).json({ slots });
        } catch (e) {
          res.status(500).json({ error: "Error fetching slots", detail: body });
        }
        resolve();
      });
    });

    req2.on("error", (err) => {
      res.status(500).json({ error: err.message });
      resolve();
    });

    req2.end();
  });
};
