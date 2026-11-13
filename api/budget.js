
export default async function handler(req, res) {
  if (!["GET", "PUT"].includes(req.method)) {
    return res.status(405).json({ error: "Method not allowed" });
  }

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

  const endpoint = `${url}/rest/v1/wallet_budgets`;

  try {
    if (req.method === "GET") {
      const month = req.query.month;

      if (!validMonth(month)) {
        return res.status(400).json({ error: "Invalid month" });
      }

      const response = await fetch(
        `${endpoint}?month=eq.${month}&select=amount`,
        { headers, cache: "no-store" }
      );

      if (!response.ok) throw new Error("Read failed");

      const data = await response.json();

      return res.status(200).json({
        amount: data.length ? data[0].amount : 40000
      });
    }

    const { month, amount } = req.body || {};

    if (
      !validMonth(month) ||
      !Number.isSafeInteger(amount) ||
      amount < 0 ||
      amount > 10000000
    ) {
      return res.status(400).json({ error: "Invalid input" });
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        ...headers,
        Prefer: "resolution=merge-duplicates,return=representation"
      },
      body: JSON.stringify({ month, amount })
    });

    if (!response.ok) throw new Error("Write failed");

    const data = await response.json();

    return res.status(200).json(data[0]);
  } catch {
    return res.status(500).json({ error: "Database error" });
  }
}

function validMonth(value) {
  return typeof value === "string" &&
    /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}
