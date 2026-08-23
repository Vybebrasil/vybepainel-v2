export default async function handler(req, res) {
  // Ignora chamadas de pre-flight (CORS)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const mondayResponse = await fetch('https://api.monday.com/v2', {
      method: req.method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': process.env.MONDAY_TOKEN,
        'API-Version': '2024-01'
      },
      body: req.method === 'POST' ? JSON.stringify(req.body) : undefined
    });

    const data = await mondayResponse.json();
    return res.status(mondayResponse.status).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
