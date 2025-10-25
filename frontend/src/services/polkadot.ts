import { ApiPromise, WsProvider } from '@polkadot/api';
import { toast } from 'react-toastify';
import { useWalletStore } from '../store/wallet';

let api: ApiPromise | null = null;

export async function setupPolkadotApi(): Promise<ApiPromise> {
  if (api) return api;

  try {
    const wsProvider = new WsProvider(
      process.env.REACT_APP_WS_URL || 'ws://localhost:9944'
    );

    api = await ApiPromise.create({ 
      provider: wsProvider,
      types: {
        ContentSource: {
          _enum: ['GitHub', 'Twitter']
        },
        ShadowItem: {
          id: 'H256',
          cid: 'Vec<u8>',
          encryptedKey: 'Vec<u8>',
          timestamp: 'u64',
          source: 'ContentSource',
          metadata: 'Vec<u8>',
          deleted: 'bool'
        },
        ConsentRecord: {
          grantedAt: 'u64',
          expiresAt: 'Option<u64>',
          messageHash: 'H256'
        }
      }
    });

    await api.isReady;

    const chain = await api.rpc.system.chain();
    console.log(`Connected to chain: ${chain}`);

    return api;
  } catch (error) {
    console.error('Failed to connect to Substrate node:', error);
    toast.error('Failed to connect to blockchain');
    throw error;
  }
}

export function getApi(): ApiPromise {
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
  const api = getApi();
  const { selectedAccount, injector } = useWalletStore.getState();

  if (!selectedAccount || !injector) {
    throw new Error('No account selected');
  }

  return new Promise((resolve, reject) => {
    let unsub: (() => void) | undefined;

    api.tx.shadowPallet
      .submitShadowItem(
        Array.from(Buffer.from(cid)),
        Array.from(encryptedKey),
        source,
        Array.from(Buffer.from(metadata))
      )
      .signAndSend(
        selectedAccount.address,
        { signer: injector.signer },
        (result) => {
          console.log(`Transaction status: ${result.status.type}`);

          if (result.status.isInBlock) {
            console.log(`Transaction included at blockHash ${result.status.asInBlock}`);
          } else if (result.status.isFinalized) {
            console.log(`Transaction finalized at blockHash ${result.status.asFinalized}`);
            
            // Check for errors
            result.events.forEach(({ phase, event: { data, method, section } }) => {
              if (section === 'system' && method === 'ExtrinsicFailed') {
                const [error] = data as any;
                console.error('Extrinsic failed:', error.toString());
                reject(new Error('Transaction failed'));
              }
            });

            if (unsub) unsub();
            resolve(result.status.asFinalized.toString());
          }
        }
      )
      .then((unsubscribe) => {
        unsub = unsubscribe;
      })
      .catch((error) => {
        console.error('Transaction submission failed:', error);
        reject(error);
      });
  });
}

export async function getShadowItems(address: string): Promise<any[]> {
  const api = getApi();
  const items = await api.query.shadowPallet.shadowItems(address);
  return items.toJSON() as any[];
}

export async function getConsentRecord(address: string): Promise<any> {
  const api = getApi();
  const consent = await api.query.shadowPallet.consentRecords(address);
  return consent.isEmpty ? null : consent.toJSON();
}

export async function grantConsent(messageHash: string, expiresIn?: number): Promise<string> {
  const api = getApi();
  const { selectedAccount, injector } = useWalletStore.getState();

  if (!selectedAccount || !injector) {
    throw new Error('No account selected');
  }

  return new Promise((resolve, reject) => {
    let unsub: (() => void) | undefined;

    api.tx.shadowPallet
      .grantConsent(messageHash, expiresIn)
      .signAndSend(
        selectedAccount.address,
        { signer: injector.signer },
        (result) => {
          if (result.status.isFinalized) {
            if (unsub) unsub();
            resolve(result.status.asFinalized.toString());
          }
        }
      )
      .then((unsubscribe) => {
        unsub = unsubscribe;
      })
      .catch(reject);
  });
}