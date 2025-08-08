import { useEffect, useState } from 'react';
import { tossAPod, fetchMyPods } from '../lib/eden-sdk';

export default function Home() {
  const [peraWallet, setPeraWallet] = useState(null);
  const [account, setAccount] = useState(null);
  const [pods, setPods] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadWallet() {
      const { PeraWalletConnect } = await import('@perawallet/connect');
      const wallet = new PeraWalletConnect();
      const accounts = await wallet.reconnectSession();
      if (accounts && accounts.length) {
        setAccount(accounts[0]);
      }
      setPeraWallet(wallet);
    }
    loadWallet();
  }, []);

  useEffect(() => {
    async function loadPods() {
      if (!account) return;
      const list = await fetchMyPods({ address: account });
      setPods(list);
    }
    loadPods();
  }, [account]);

  async function connectWallet() {
    if (!peraWallet) return;
    const accounts = await peraWallet.connect();
    setAccount(accounts[0]);
  }

  async function handleToss() {
    if (!peraWallet || !account) return;
    setLoading(true);
    try {
      const gps = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          pos => {
            resolve({
              lat: pos.coords.latitude,
              lon: pos.coords.longitude
            });
          },
          err => reject(err)
        );
      });
      await tossAPod({ walletConnector: peraWallet, gps, account });
      const list = await fetchMyPods({ address: account });
      setPods(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen p-4">
      {!account ? (
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded"
          onClick={connectWallet}
        >
          Connect Pera Wallet
        </button>
      ) : (
        <>
          <button
            className="px-4 py-2 bg-green-600 text-white rounded mb-4"
            onClick={handleToss}
            disabled={loading}
          >
            {loading ? 'Tossing...' : '📍 I tossed a pod'}
          </button>
          <h2 className="text-xl mb-2">Your Pods:</h2>
          <ul className="space-y-1">
            {pods.map((pod, idx) => (
              <li key={idx} className="p-2 border rounded">
                {pod.dateString || 'Pod'}
              </li>
            ))}
            {pods.length === 0 && <li>No pods yet.</li>}
          </ul>
        </>
      )}
    </div>
  );
}
