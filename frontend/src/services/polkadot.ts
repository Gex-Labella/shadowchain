import { ApiPromise, WsProvider } from '@polkadot/api';
import { toast } from 'react-toastify';
import { useWalletStore } from '../store/wallet';
import { config } from '../config/environment';

let api: ApiPromise | null = null;

// Set to true to run without substrate node
const MOCK_MODE = config.features.mockMode;

export async function setupPolkadotApi(): Promise<ApiPromise> {
  if (api) return api;

  // Mock mode - return a mock API object
  if (MOCK_MODE) {
    console.log('Running in MOCK MODE - no substrate node required');
    toast.info('Running in demo mode - blockchain connection simulated');
    // Return a mock API object that satisfies the interface
    api = {} as ApiPromise;
    return api;
  }

  try {
    const wsProvider = new WsProvider(config.ws.url);

    api = await ApiPromise.create({
      provider: wsProvider,
      types: {
        // Custom types for Shadow pallet
        ShadowItem: {
          id: '[u8; 32]',
          content: 'Vec<u8>',
          timestamp: 'u64',
          source: 'u8',
          metadata: 'Vec<u8>'
        },
        ConsentRecord: {
          granted_at: 'BlockNumber',
          expires_at: 'Option<BlockNumber>',
          message_hash: 'Vec<u8>'
        }
      }
      // Let the API auto-detect signed extensions from chain metadata
    });

    await api.isReady;

    const chain = await api.rpc.system.chain();
    console.log(`Connected to chain: ${chain}`);


    console.log(config.ws.url)
    console.log(wsProvider)

    // Subscribe to connection status
    wsProvider.on('connected', () => {
      console.log('WebSocket connected');
    });

    wsProvider.on('disconnected', () => {
      console.error('WebSocket disconnected');
      //toast.error('Lost connection to blockchain');
      api = null;
    });

    wsProvider.on('error', (error) => {
      console.error('WebSocket error:', error);
      toast.error('Blockchain connection error');
    });

    return api;
  } catch (error) {
    console.error('Failed to connect to Substrate node:', error);
    toast.error('Failed to connect to blockchain. Please ensure the node is running.');
    throw error;
  }
}

export function getApi(): ApiPromise {
  if (MOCK_MODE) {
    return {} as ApiPromise;
  }
  if (!api) {
    throw new Error('API not initialized');
  }
  return api;
}

export async function submitShadowItem(
  cid: string,
  encryptedKey: Uint8Array,
  source: 'GitHub' | 'Twitter',
  metadata: string
): Promise<string> {
  if (MOCK_MODE) {
    console.log('Mock: submitting shadow item', { cid, source });
    toast.success('Mock: Shadow item submitted successfully');
    return Promise.resolve('0x' + Math.random().toString(16).substr(2, 64));
  }

  const api = getApi();
  const { selectedAccount, injector } = useWalletStore.getState();

  if (!selectedAccount || !injector) {
    throw new Error('No account selected');
  }

  return new Promise((resolve, reject) => {
    let unsub: (() => void) | undefined;

    const cidBytes = Array.from(new TextEncoder().encode(cid));
    const metadataBytes = Array.from(new TextEncoder().encode(metadata));
    
    if (!api.tx.shadow) {
      const error = new Error('Shadow pallet not available on this chain');
      toast.error('Shadow pallet not found. Please ensure you are connected to the correct chain.');
      return reject(error);
    }
    
    const timeout = setTimeout(() => {
      if (unsub) unsub();
      reject(new Error('Transaction timeout'));
    }, 60000); // 60 second timeout
    
    api.tx.shadow
      .submitShadowItem(
        cidBytes,
        Array.from(encryptedKey),
        source,
        metadataBytes
      )
      .signAndSend(
        selectedAccount.address,
        { signer: injector.signer },
        (result) => {
          console.log(`Transaction status: ${result.status.type}`);

          if (result.status.isInBlock) {
            console.log(`Transaction included at blockHash ${result.status.asInBlock}`);
            toast.info('Transaction included in block');
          } else if (result.status.isFinalized) {
            console.log(`Transaction finalized at blockHash ${result.status.asFinalized}`);
            clearTimeout(timeout);
            
            // Check for errors
            let hasError = false;
            result.events.forEach(({ phase, event: { data, method, section } }) => {
              if (section === 'system' && method === 'ExtrinsicFailed') {
                const [error] = data as any;
                console.error('Extrinsic failed:', error.toString());
                hasError = true;
                toast.error('Transaction failed on chain');
                reject(new Error('Transaction failed'));
              } else if (section === 'shadow' && method === 'ShadowItemStored') {
                toast.success('Shadow item stored successfully');
              }
            });

            if (!hasError) {
              if (unsub) unsub();
              resolve(result.status.asFinalized.toString());
            }
          } else if (result.isError) {
            clearTimeout(timeout);
            console.error('Transaction error:', result);
            toast.error('Transaction error');
            if (unsub) unsub();
            reject(new Error('Transaction error'));
          }
        }
      )
      .then((unsubscribe) => {
        unsub = unsubscribe;
      })
      .catch((error) => {
        clearTimeout(timeout);
        console.error('Transaction submission failed:', error);
        toast.error(`Failed to submit transaction: ${error.message}`);
        reject(error);
      });
  });
}

export async function getShadowItems(address: string): Promise<any[]> {
  if (MOCK_MODE) {
    console.log('Mock: getting shadow items for', address);
    // Return some mock data
    return [
      {
        id: '0x' + Math.random().toString(16).substr(2, 64),
        cid: 'QmX4qoKjGHNvWNiyXq8tLsh3kzPvfzCBzLYBEFM1234567',
        encryptedKey: Array.from(new Uint8Array(32).fill(1)),
        timestamp: Date.now() - 3600000,
        source: 'GitHub',
        metadata: Array.from(new TextEncoder().encode('Mock GitHub commit')),
        deleted: false
      },
      {
        id: '0x' + Math.random().toString(16).substr(2, 64),
        cid: 'QmX4qoKjGHNvWNiyXq8tLsh3kzPvfzCBzLYBEFM7654321',
        encryptedKey: Array.from(new Uint8Array(32).fill(2)),
        timestamp: Date.now() - 7200000,
        source: 'Twitter',
        metadata: Array.from(new TextEncoder().encode('Mock Twitter post')),
        deleted: false
      }
    ];
  }
  
  const api = getApi();
  
  // Check if shadow pallet exists (registered as "Shadow" in runtime)
  if (!api.query.shadow) {
    console.warn('Shadow pallet not available on this chain, returning empty array');
    return [];
  }
  
  const items = await api.query.shadow.shadowItems(address);
  return items.toJSON() as any[];
}

export async function getConsentRecord(address: string): Promise<any> {
  if (MOCK_MODE) {
    console.log('Mock: getting consent record for', address);
    // Check localStorage for mock consent
    const mockConsent = localStorage.getItem('shadowchain_mock_consent');
    if (mockConsent) {
      return JSON.parse(mockConsent);
    }
    return null; // No consent initially
  }
  
  const api = getApi();
  
  // Check if shadow pallet exists (registered as "Shadow" in runtime)
  if (!api.query.shadow) {
    console.warn('Shadow pallet not available on this chain, returning null');
    return null;
  }
  
  const consent = await api.query.shadow.consentRecords(address);
  return consent.isEmpty ? null : consent.toJSON();
}

export async function grantConsent(messageHash: string, expiresIn?: number): Promise<string> {
  if (MOCK_MODE) {
    console.log('Mock: granting consent', { messageHash, expiresIn });
    // Store mock consent in localStorage
    const mockConsent = {
      grantedAt: Date.now(),
      expiresAt: expiresIn ? Date.now() + expiresIn * 1000 : null,
      messageHash
    };
    localStorage.setItem('shadowchain_mock_consent', JSON.stringify(mockConsent));
    toast.success('Mock: Consent granted successfully');
    return Promise.resolve('0x' + Math.random().toString(16).substr(2, 64));
  }

  const api = getApi();
  const { selectedAccount, injector } = useWalletStore.getState();

  if (!selectedAccount || !injector) {
    throw new Error('No account selected');
  }

  return new Promise((resolve, reject) => {
    let unsub: (() => void) | undefined;

    // Check if shadow pallet exists (registered as "Shadow" in runtime)
    if (!api.tx.shadow) {
      const error = new Error('Shadow pallet not available on this chain');
      toast.error('Shadow pallet not found. Please ensure you are connected to the correct chain.');
      return reject(error);
    }

    // Create a timeout for the transaction
    const timeout = setTimeout(() => {
      if (unsub) unsub();
      reject(new Error('Transaction timeout'));
    }, 60000); // 60 second timeout

    api.tx.shadow
      .grantConsent(messageHash, expiresIn)
      .signAndSend(
        selectedAccount.address,
        { signer: injector.signer },
        (result) => {
          console.log(`Consent transaction status: ${result.status.type}`);
          
          if (result.status.isInBlock) {
            toast.info('Consent transaction included in block');
          } else if (result.status.isFinalized) {
            clearTimeout(timeout);
            
            // Check for errors
            let hasError = false;
            result.events.forEach(({ phase, event: { data, method, section } }) => {
              if (section === 'system' && method === 'ExtrinsicFailed') {
                const [error] = data as any;
                console.error('Consent failed:', error.toString());
                hasError = true;
                toast.error('Consent transaction failed');
                reject(new Error('Consent transaction failed'));
              } else if (section === 'shadow' && method === 'ConsentGranted') {
                toast.success('Consent granted successfully');
              }
            });

            if (!hasError) {
              if (unsub) unsub();
              resolve(result.status.asFinalized.toString());
            }
          } else if (result.isError) {
            clearTimeout(timeout);
            console.error('Consent transaction error:', result);
            toast.error('Consent transaction error');
            if (unsub) unsub();
            reject(new Error('Consent transaction error'));
          }
        }
      )
      .then((unsubscribe) => {
        unsub = unsubscribe;
      })
      .catch((error) => {
        clearTimeout(timeout);
        console.error('Consent submission failed:', error);
        toast.error(`Failed to grant consent: ${error.message}`);
        reject(error);
      });
  });
}