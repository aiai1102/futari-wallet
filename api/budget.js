
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

  const budgets = `${url}/rest/v1/wallet_budgets`;
  const settings = `${url}/rest/v1/wallet_settings`;

  try {
    // デフォルト予算の取得
    if (req.method === "GET" && req.query.mode === "default") {
      const response = await fetch(
        `${settings}?id=eq.1&select=default_budget`,
        { headers, cache: "no-store" }
      );

      if (!response.ok) throw new Error("Settings read failed");

      const data = await response.json();

      return res.status(200).json({
        amount: data[0]?.default_budget ?? 40000
      });
    }

    // 月別予算の取得
    if (req.method === "GET") {
      const month = req.query.month;

      if (!validMonth(month)) {
        return res.status(400).json({ error: "Invalid month" });
      }

      const [budgetResponse, settingsResponse] =
        await Promise.all([
          fetch(
            `${budgets}?month=eq.${month}&select=amount`,
            { headers, cache: "no-store" }
          ),
          fetch(
            `${settings}?id=eq.1&select=default_budget`,
            { headers, cache: "no-store" }
          )
        ]);

      if (!budgetResponse.ok || !settingsResponse.ok) {
        throw new Error("Read failed");
      }

      const monthly = await budgetResponse.json();
      const defaults = await settingsResponse.json();

      return res.status(200).json({
        amount: monthly[0]?.amount ??
          defaults[0]?.default_budget ?? 40000
      });
    }

    // デフォルト予算の変更
    if (req.method === "PUT" && req.body?.mode === "default") {
      const amount = req.body.amount;

      if (!validAmount(amount)) {
        return res.status(400).json({ error: "Invalid amount" });
      }

      const response = await fetch(settings, {
        method: "POST",
        headers: {
          ...headers,
          Prefer: "resolution=merge-duplicates,return=representation"
        },
        body: JSON.stringify({
          id: 1,
          default_budget: amount,
          updated_at: new Date().toISOString()
        })
      });

      if (!response.ok) throw new Error("Settings write failed");

      return res.status(200).json({
        amount
      });
    }

    // 月別予算の変更
    if (req.method === "PUT") {
      const { month, amount } = req.body || {};

      if (!validMonth(month) || !validAmount(amount)) {
        return res.status(400).json({ error: "Invalid input" });
      }

      const response = await fetch(budgets, {
        method: "POST",
        headers: {
          ...headers,
          Prefer: "resolution=merge-duplicates,return=representation"
        },
        body: JSON.stringify({ month, amount })
      });

      if (!response.ok) throw new Error("Budget write failed");

      return res.status(200).json({ month, amount });
    }
  } catch {
    return res.status(500).json({ error: "Database error" });
  }
}

function validMonth(value) {
  return typeof value === "string" &&
    /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

function validAmount(value) {
  return Number.isSafeInteger(value) &&
    value >= 0 && value <= 10000000;
}
