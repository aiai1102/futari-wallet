
export default async function handler(req, res) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return res.status(500).json({ error: "Server not configured" });
  }

  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json"
  };

  const endpoint = `${url}/rest/v1/wallet_transactions`;
  const allowed = ["GET", "POST", "PATCH", "DELETE"];

  if (!allowed.includes(req.method)) {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (req.method === "GET") {
      const response = await fetch(
        `${endpoint}?select=id,name,price,type,spent_on,created_at&order=spent_on.desc,created_at.desc`,
        { headers, cache: "no-store" }
      );

      if (!response.ok) throw new Error("Read failed");

      return res.status(200).json(await response.json());
    }

    if (req.method === "DELETE") {
      const { id } = req.body || {};

      if (!isUuid(id)) {
        return res.status(400).json({ error: "Invalid ID" });
      }

      const response = await fetch(
        `${endpoint}?id=eq.${id}`,
        { method: "DELETE", headers }
      );

      if (!response.ok) throw new Error("Delete failed");

      return res.status(200).json({ success: true });
    }

    const { id, name, price, type, spent_on } = req.body || {};

    if (
      (req.method === "PATCH" && !isUuid(id)) ||
      typeof name !== "string" ||
      !name.trim() ||
      name.length > 100 ||
      !Number.isSafeInteger(price) ||
      price <= 0 ||
      price > 10000000 ||
      !["expense", "income"].includes(type) ||
      !validDate(spent_on)
    ) {
      return res.status(400).json({ error: "Invalid input" });
    }

    const payload = {
      name: name.trim(),
      price,
      type,
      spent_on
    };

    const response = await fetch(
      req.method === "PATCH"
        ? `${endpoint}?id=eq.${id}`
        : endpoint,
      {
        method: req.method,
        headers: {
          ...headers,
          Prefer: "return=representation"
        },
        body: JSON.stringify(payload)
      }
    );

    if (!response.ok) throw new Error("Write failed");

    const data = await response.json();
    return res.status(200).json(data[0]);
  } catch {
    return res.status(500).json({ error: "Database error" });
  }
}

function isUuid(value) {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function validDate(value) {
  if (typeof value !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value;
}
