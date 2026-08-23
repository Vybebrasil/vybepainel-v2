export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const token = process.env.MONDAY_TOKEN;
    if (!token) {
      return res.status(500).json({ error: "O MONDAY_TOKEN sumiu das Variaveis de Ambiente do Vercel!" });
    }

    const payload = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

    const mondayResponse = await fetch('https://api.monday.com/v2', {
      method: req.method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token,
        'API-Version': '2024-01'
      },
      body: req.method === 'POST' ? payload : undefined
    });

    const data = await mondayResponse.json();
    
    // Se o Monday recusar, a gente repassa o erro deles pra frente
    if (data.errors) {
      return res.status(400).json({ error: "O Monday recusou: " + JSON.stringify(data.errors) });
    }

    return res.status(mondayResponse.status).json(data);
  } catch (error) {
    return res.status(500).json({ error: "O servidor ponte engasgou: " + error.message });
  }
}
