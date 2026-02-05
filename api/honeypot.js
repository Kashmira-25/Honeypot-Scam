export default function handler(req, res) {
  // Read x-api-key from request headers
  const apiKey = req.headers['x-api-key'];

  // Compare with environment variable
  if (apiKey !== process.env.FIREBASE_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Respond if key is valid
  res.status(200).json({
    message: 'Honeypot active',
    timestamp: new Date().toISOString()
  });
}
