import algosdk from 'algosdk';

// Default RPC endpoints for Algod and the Indexer. These can be overridden
// by providing NEXT_PUBLIC_ALGOD_RPC or NEXT_PUBLIC_INDEXER_RPC environment
// variables when running the app.
const ALGOD_RPC =
  process.env.NEXT_PUBLIC_ALGOD_RPC || 'https://testnet-api.algonode.cloud';
const INDEXER_RPC =
  process.env.NEXT_PUBLIC_INDEXER_RPC || 'https://testnet-idx.algonode.cloud';

// Prefix "EDEN" encoded as bytes for filtering
const EDEN_PREFIX = new Uint8Array([0x45, 0x44, 0x45, 0x4e]);

// Encode a JavaScript object into a transaction note with EDEN prefix
function encodeNote(data) {
  const json = JSON.stringify(data);
  const encoder = new TextEncoder();
  return new Uint8Array([...EDEN_PREFIX, ...encoder.encode(json)]);
}

// Convert base64 string to Uint8Array
function base64ToUint8Array(b64) {
  if (typeof Buffer !== 'undefined') {
    // Node.js environment
    return Uint8Array.from(Buffer.from(b64, 'base64'));
  }
  // Browser fallback
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

// Decode a base64 encoded note, stripping the EDEN prefix
function decodeNote(b64) {
  try {
    const bytes = base64ToUint8Array(b64);
    const body = bytes.slice(EDEN_PREFIX.length);
    const decoder = new TextDecoder();
    return JSON.parse(decoder.decode(body));
  } catch (e) {
    return {};
  }
}

/**
 * Send a zero-Algo self transaction with encrypted GPS data on chain.
 * Uses the provided walletConnector to sign the transaction.
 * @param {Object} opts
 * @param {Object} opts.walletConnector Wallet connection (Pera Wallet instance)
 * @param {Object} opts.gps An object with `lat` and `lon` numbers
 * @param {string} [opts.account] Optional account address to use for the transaction
 */
export async function tossAPod({ walletConnector, gps, account }) {
  console.log('=== tossAPod DEBUG ===');
  console.log('walletConnector:', walletConnector);
  console.log('account parameter:', account);
  console.log('gps:', gps);
  
  // Use configured Algod endpoint
  const algod = new algosdk.Algodv2('', ALGOD_RPC);
  
  // Debug the account extraction process
  console.log('walletConnector?.connector?.accounts:', walletConnector?.connector?.accounts);
  console.log('walletConnector?.accounts:', walletConnector?.accounts);
  
  const senderRaw =
    account ??
    walletConnector?.connector?.accounts?.[0] ??
    walletConnector?.accounts?.[0];
    
  console.log('senderRaw:', senderRaw);
  
  const sender =
    typeof senderRaw === 'object' ? senderRaw?.address : senderRaw;
    
  console.log('final sender:', sender);
  console.log('sender type:', typeof sender);
  console.log('sender length:', sender?.length);
  
  if (typeof sender !== 'string' || sender.length === 0) {
    console.error('Account extraction failed!');
    console.error('Available wallet properties:', Object.keys(walletConnector || {}));
    throw new Error(`No connected account. Sender: ${sender}, Type: ${typeof sender}`);
  }
  
  console.log('Using sender address:', sender);
  
  const params = await algod.getTransactionParams().do();
  const note = encodeNote({ gps, t: Date.now() });
  
  const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    from: sender,
    to: sender,
    amount: 0,
    note,
    suggestedParams: params,
  });
  
  const [signed] = await walletConnector.signTransaction([txn]);
  const send = await algod.sendRawTransaction(signed.blob || signed).do();
  return send.txId;
}

/**
 * Fetch all "Eden" pods for an account from the Algorand indexer.
 * @param {Object} opts
 * @param {string} opts.address Algorand address
 * @returns {Array} Array of pod objects with dateString and decoded data
 */
export async function fetchMyPods({ address }) {
  // If running in the browser, hit the Next.js API route so we can
  // avoid CORS issues when the public indexer endpoint disallows
  // direct requests from the client. The API route performs the
  // same query from the server side where CORS is not a problem.
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch(
        `/api/pods?address=${encodeURIComponent(address)}`
      );
      if (!res.ok) throw new Error('Request failed');
      return await res.json();
    } catch (err) {
      console.error('Failed to fetch pods', err);
      return [];
    }
  }

  const indexer = new algosdk.Indexer('', INDEXER_RPC);
  try {
    const res = await indexer
      .searchForTransactions()
      .address(address)
      .notePrefix(EDEN_PREFIX)
      .do();
    const txs = res.transactions || [];
    return txs.map((tx) => {
      const decoded = decodeNote(tx.note);
      return {
        dateString: new Date(tx['round-time'] * 1000).toLocaleString(),
        ...decoded,
      };
    });
  } catch (err) {
    // Network errors are common if the RPC endpoint is unreachable.
    // Log and return an empty list instead of throwing so the UI can recover.
    console.error('Failed to fetch pods', err);
    return [];
  }
}
