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

  // Add this debug function to your pages/index.js
function debugWalletState() {
  console.log('=== WALLET DEBUG INFO ===');
  console.log('peraWallet:', peraWallet);
  console.log('account state:', account);
  
  if (peraWallet) {
    console.log('peraWallet.connector:', peraWallet.connector);
    console.log('peraWallet.accounts:', peraWallet.accounts);
    console.log('peraWallet.connector?.accounts:', peraWallet.connector?.accounts);
  }
  console.log('========================');
}

// Also update your connectWallet function with better debugging
async function connectWallet() {
  if (!peraWallet) return;
  
  try {
    console.log('Connecting wallet...');
    const accounts = await peraWallet.connect();
    console.log('Raw accounts from connect:', accounts);
    
    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts returned from wallet');
    }
    
    const addr = typeof accounts[0] === 'object' ? accounts[0].address : accounts[0];
    console.log('Extracted address:', addr);
    
    if (!addr || typeof addr !== 'string') {
      throw new Error('Invalid account format received from wallet');
    }
    
    setAccount(addr);
    console.log('Account set successfully:', addr);
    
  } catch (err) {
    console.error('Wallet connection error:', err);
    alert('Failed to connect wallet: ' + err.message);
  }
}

  async function handleToss() {
    if (!peraWallet || !account) {
      alert('Wallet not connected properly');
      return;
    }

    setLoading(true);

    try {
      console.log('Creating transaction without GPS...');

      const txId = await tossAPod({
        walletConnector: peraWallet,
        account
      });

      console.log('Transaction successful:', txId);
      alert(`Pod tossed! Transaction: ${txId}`);

      // Refresh pods list
      const list = await fetchMyPods({ address: account });
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
