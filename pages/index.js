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
        // Pera Wallet may return either a plain address string or an object
        // containing the address. Normalize to a string for downstream use.
        const addr =
          typeof accounts[0] === 'object' ? accounts[0].address : accounts[0];
        setAccount(addr);
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

  // Ensure we always have a connected account before using it.
  async function ensureAccount() {
    if (account) return account;
    if (!peraWallet) throw new Error('Wallet not initialized');

    const accounts = await peraWallet.connect();
    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts returned from wallet');
    }

    const addr = typeof accounts[0] === 'object' ? accounts[0].address : accounts[0];
    if (!addr) {
      throw new Error('No connected account');
    }
    setAccount(addr);
    return addr;
  }

  async function connectWallet() {
    try {
      await ensureAccount();
    } catch (err) {
      console.error('Wallet connection error:', err);
      alert('Failed to connect wallet: ' + err.message);
    }
  }

  async function handleToss() {
    try {
      const addr = await ensureAccount();
      setLoading(true);

      const txId = await tossAPod({
        walletConnector: peraWallet,
        account: addr,
      });

      alert(`Pod tossed! Transaction: ${txId}`);

      // Refresh pods list
      const list = await fetchMyPods({ address: addr });
      setPods(list);

    } catch (err) {
      console.error('Full error:', err);

      // Show user-friendly error messages
      let errorMessage = 'Failed to toss pod: ';

      if (err.message.includes('User rejected')) {
        errorMessage += 'Transaction was cancelled.';
      } else if (err.message.includes('No connected account')) {
        errorMessage += 'Wallet connection lost. Please reconnect.';
      } else {
        errorMessage += err.message || 'Unknown error occurred.';
      }

      alert(errorMessage);

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
