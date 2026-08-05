const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Simple test route — confirms the server is alive
app.get('/', (req, res) => {
  res.json({ status: 'GoldMind backend is running' });
});

// Get current gold price
app.get('/api/price', async (req, res) => {
  try {
    const apiKey = process.env.TWELVEDATA_API_KEY;
    const response = await fetch(`https://api.twelvedata.com/price?symbol=XAU/USD&apikey=${apiKey}`);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch price' });
  }
});

// Get recent price history for the chart
app.get('/api/history', async (req, res) => {
  try {
    const apiKey = process.env.TWELVEDATA_API_KEY;
    const response = await fetch(
      `https://api.twelvedata.com/time_series?symbol=XAU/USD&interval=1h&outputsize=30&apikey=${apiKey}`
    );
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});
// Generate AI analysis (grounded in the live price passed from the app)
app.post('/api/analysis', async (req, res) => {
  try {
    const { livePrice } = req.body;

    if (!livePrice) {
      return res.status(400).json({ error: 'livePrice is required' });
    }

    const apiKey = process.env.GROQ_API_KEY;
    const prompt = `You are a professional gold (XAU/USD) market analyst. The current live XAU/USD price is exactly ${livePrice}. Base your entry, stop loss, and take profit on this real price — entry should be at or very close to ${livePrice}, with stop loss and take profit at realistic distances (roughly 0.5-1.5% away). Respond with ONLY a valid JSON object, no other text, no markdown, in exactly this shape:
{
  "trend": "Bullish or Bearish",
  "direction": "Buy or Sell",
  "confidence": a number between 50 and 95,
  "entry": ${livePrice},
  "stopLoss": a realistic stop loss price based on ${livePrice},
  "takeProfit": a realistic take profit price based on ${livePrice},
  "reasoning": "2-3 sentences of technical/fundamental reasoning",
  "riskWarning": "a short risk disclaimer"
}`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      }),
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return res.status(500).json({ error: 'No response from AI' });
    }

    const parsed = JSON.parse(content);
    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate analysis' });
  }
});
app.listen(PORT, () => {
  console.log(`GoldMind backend running on port ${PORT}`);
});