import { fetchMyPods } from '../../lib/eden-sdk';

// Simple proxy endpoint that queries the Algorand indexer on the
// server side so that the front-end can avoid CORS restrictions.
export default async function handler(req, res) {
  const { address } = req.query;
  if (!address) {
    res.status(400).json({ error: 'Missing address' });
    return;
  }

  const pods = await fetchMyPods({ address });
  res.status(200).json(pods);
}

