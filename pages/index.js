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

  async function connectWallet() {
    if (!peraWallet) return;
    const accounts = await peraWallet.connect();
    const addr =
      typeof accounts[0] === 'object' ? accounts[0].address : accounts[0];
    setAccount(addr);
  }

  async function handleToss() {
  if (!peraWallet || !account) {
    alert('Wallet not connected properly');
    return;
  }
  
  setLoading(true);
  
  try {
    console.log('Getting location...');
    
    // Add timeout and better error handling for geolocation
    const gps = await new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }
      
      const timeout = setTimeout(() => {
        reject(new Error('Location request timed out'));
      }, 10000); // 10 second timeout
      
      navigator.geolocation.getCurrentPosition(
        pos => {
          clearTimeout(timeout);
          console.log('Got location:', pos.coords.latitude, pos.coords.longitude);
          resolve({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude
          });
        },
        err => {
          clearTimeout(timeout);
          console.error('Geolocation error:', err);
          reject(new Error(`Location error: ${err.message}`));
        },
        {
          enableHighAccuracy: true,
          timeout: 8000,
          maximumAge: 300000 // 5 minutes
        }
      );
    });

    console.log('Creating transaction...');
    console.log('Account:', account);
    console.log('GPS:', gps);
    
    const txId = await tossAPod({ 
      walletConnector: peraWallet, 
      gps, 
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
    
    if (err.message.includes('Location') || err.message.includes('geolocation')) {
      errorMessage += 'Could not access your location. Please enable location permissions and try again.';
    } else if (err.message.includes('User rejected')) {
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
