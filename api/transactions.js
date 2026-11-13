
export default async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return res.status(500).json({ error: "Server not configured" });
  }

  const endpoint = `${url}/rest/v1/wallet_transactions`;

  try {
    if (req.method === "GET") {
      const response = await fetch(
        `${endpoint}?select=id,name,price,spent_on,created_at&order=created_at.desc`,
        {
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`
          }
        }
      );

      if (!response.ok) throw new Error("Database read failed");

      const data = await response.json();
      return res.status(200).json(data);
    }

    const { name, price } = req.body || {};

    if (
      typeof name !== "string" ||
      !name.trim() ||
      name.length > 100 ||
      !Number.isSafeInteger(price) ||
      price <= 0 ||
      price > 10000000
    ) {
      return res.status(400).json({ error: "Invalid input" });
    }

    const today = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date());

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "return=representation"
      },
      body: JSON.stringify({
        name: name.trim(),
        price,
        spent_on: today
      })
    });

    if (!response.ok) throw new Error("Database write failed");

    const data = await response.json();
    return res.status(201).json(data[0]);
  } catch {
    return res.status(500).json({ error: "Database error" });
  }
}
