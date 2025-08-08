import algosdk from 'algosdk';

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
 */
export async function tossAPod({ walletConnector, gps }) {
  const algod = new algosdk.Algodv2('', process.env.NEXT_PUBLIC_ALGOD_RPC);
  // Determine the connected account
  let account;
  if (walletConnector.getAccounts) {
    const accounts = await walletConnector.getAccounts();
    account = accounts[0];
  } else if (walletConnector.connect) {
    const accounts = await walletConnector.connect();
    account = accounts[0];
  }
  const params = await algod.getTransactionParams().do();
  const note = encodeNote({ gps, t: Date.now() });
  const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    from: account,
    to: account,
    amount: 0,
    note,
    suggestedParams: params,
  });
  const signed = await walletConnector.signTransaction([txn]);
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
  const indexer = new algosdk.Indexer('', process.env.NEXT_PUBLIC_INDEXER_RPC);
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
}
