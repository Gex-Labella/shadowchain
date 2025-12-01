/**
 * Transaction service for handling user-signed blockchain transactions
 * This implements the proper Web3 pattern where users sign their own transactions
 */

import axios from 'axios';
import { ApiPromise } from '@polkadot/api';
import { u8aToHex, stringToHex, stringToU8a } from '@polkadot/util';
import { toast } from 'react-toastify';
import { useWalletStore } from '../store/wallet';
import { config } from '../config/environment';
import { getApi } from './polkadot';

interface PendingTransaction {
  id?: number;
  source: 'GitHub' | 'Twitter';
  content: any;
  timestamp: number;
  originalUrl?: string;
  txData: {
    method: string;
    args: any[];
  };
}

interface ShadowItemTransaction {
  method: string;
  args: any[];
}

/**
 * Fetch and prepare transactions for user signing
 */
export async function fetchPendingTransactions(userAddress: string): Promise<PendingTransaction[]> {
  try {
    const apiUrl = config.api.baseUrl;
    const response = await axios.post(`${apiUrl}/transactions/sync-and-prepare/${userAddress}`);

    console.log('API Response:', response.data);
    
    if (response.data.transactions && response.data.transactions.length > 0) {
      toast.info(`${response.data.transactions.length} transactions ready for signing`);
    }
    
    return response.data.transactions || [];
  } catch (error: any) {
    console.error('Failed to fetch pending transactions:', error);
    toast.error('Failed to prepare transactions');
    return [];
  }
}

/**
 * Submit a shadow item with user signing
 * This is the proper Web3 way - user signs their own transaction
 */
export async function submitShadowItemWithUserSigning(
  transaction: PendingTransaction
): Promise<string> {
  const { selectedAccount, injector } = useWalletStore.getState();
  
  if (!selectedAccount || !injector) {
    throw new Error('No wallet connected');
  }

  // In mock mode, simulate the transaction
  if (config.features.mockMode) {
    console.log('Mock: User signing shadow item transaction', transaction);
    await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate signing delay
    toast.success('Mock: Shadow item submitted successfully');
    return '0x' + Math.random().toString(16).substr(2, 64);
  }

  const api = getApi();
  
  return new Promise((resolve, reject) => {
    let unsub: (() => void) | undefined;
    
    // Check if shadow pallet exists
    if (!api.tx.shadow) {
      const error = new Error('Shadow pallet not available on this chain');
      toast.error('Shadow pallet not found');
      return reject(error);
    }
    
    // Get the args from the prepared transaction
    const { args } = transaction.txData;
    const [content, source, metadata] = args;
    
    // Create timeout for the transaction
    const timeout = setTimeout(() => {
      if (unsub) unsub();
      reject(new Error('Transaction timeout'));
    }, 60000); // 60 second timeout
    
    try {
      // Detect how many arguments the chain expects
      const expectedArgs = api.tx.shadow.submitShadowItem.meta.args.length;
      console.log(`Chain expects ${expectedArgs} arguments for submitShadowItem`);
      
      // Format content and metadata as hex
      const contentHex = u8aToHex(stringToU8a(JSON.stringify(content)));
      const metadataHex = u8aToHex(stringToU8a(metadata || ''));
      
      let extrinsic: any;
      
      if (expectedArgs === 4) {
        // Old chain version expects 4 arguments: content, encrypted_key, source, metadata
        console.log('Creating extrinsic with 4 arguments (including empty encrypted key for compatibility)');
        
        extrinsic = api.tx.shadow.submitShadowItem(
          contentHex,
          '0x', // Empty encrypted key for compatibility
          source,
          metadataHex
        );
      } else if (expectedArgs === 3) {
        // New chain version expects 3 arguments: content, source, metadata
        console.log('Creating extrinsic with 3 arguments (no encryption)');
        
        extrinsic = api.tx.shadow.submitShadowItem(
          contentHex,
          source,
          metadataHex
        );
      } else {
        throw new Error(`Unexpected number of arguments for submitShadowItem: ${expectedArgs}`);
      }
      
      console.log('Submitting shadow item transaction');
      
      // Sign and send the extrinsic
      extrinsic.signAndSend(
        selectedAccount.address,
        { signer: injector.signer },
        (result: any) => {
          console.log(`Transaction status: ${result.status.type}`);
          
          if (result.status.isInBlock) {
            console.log(`Transaction included at blockHash ${result.status.asInBlock}`);
            toast.info('Transaction included in block');
          } else if (result.status.isFinalized) {
            console.log(`Transaction finalized at blockHash ${result.status.asFinalized}`);
            clearTimeout(timeout);
            
            // Check for errors
            let hasError = false;
            result.events.forEach(({ phase, event: { data, method, section } }: any) => {
              if (section === 'system' && method === 'ExtrinsicFailed') {
                const [error] = data as any;
                console.error('Transaction failed:', error.toString());
                hasError = true;
                toast.error('Transaction failed on chain');
                reject(new Error('Transaction failed'));
              } else if (section === 'shadow' && method === 'ShadowItemStored') {
                console.log('Shadow item stored successfully');
                toast.success('Shadow item stored on blockchain!');
                toast.success('Shadow item stored on blockchain!');
              }
            });
            
            if (!hasError) {
              toast.success('Shadow item submitted successfully!');
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
      .then((unsubscribe: any) => {
        unsub = unsubscribe;
      })
      .catch((error: any) => {
        clearTimeout(timeout);
        console.error('Failed to submit transaction:', error);
        toast.error(`Failed to submit: ${error.message}`);
        reject(error);
      });
    } catch (error: any) {
      clearTimeout(timeout);
      console.error('Failed to create extrinsic:', error);
      toast.error(`Failed to create transaction: ${error.message}`);
      reject(error);
    }
  });
}

/**
 * Process all pending transactions
 * Allows user to sign multiple transactions in sequence
 */
export async function processAllPendingTransactions(
  userAddress: string,
  onProgress?: (current: number, total: number) => void
): Promise<{ successful: number; failed: number }> {
  const transactions = await fetchPendingTransactions(userAddress);
  
  if (transactions.length === 0) {
    toast.info('No new shadow items to submit');
    return { successful: 0, failed: 0 };
  }
  
  let successful = 0;
  let failed = 0;
  
  toast.info(`Processing ${transactions.length} shadow items...`);
  
  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i];
    
    if (onProgress) {
      onProgress(i + 1, transactions.length);
    }
    
    try {
      await submitShadowItemWithUserSigning(tx);
      successful++;
    } catch (error) {
      console.error(`Failed to submit transaction ${i + 1}:`, error);
      failed++;
      
      // Ask user if they want to continue after a failure
      if (i < transactions.length - 1) {
        const shouldContinue = window.confirm(
          `Transaction ${i + 1} failed. Continue with remaining ${transactions.length - i - 1} transactions?`
        );
        if (!shouldContinue) {
          break;
        }
      }
    }
  }
  
  // Show summary
  if (successful > 0 && failed === 0) {
    toast.success(`Successfully submitted all ${successful} shadow items!`);
  } else if (successful > 0 && failed > 0) {
    toast.warning(`Submitted ${successful} items, ${failed} failed`);
  } else if (failed > 0) {
    toast.error(`Failed to submit ${failed} items`);
  }
  
  return { successful, failed };
}

/**
 * Grant consent with user signing
 * User signs the consent transaction themselves
 */
/**
 * Submit a shadow item with raw content 
 * 
 */
export async function submitShadowItemTransaction(
  transaction: ShadowItemTransaction
): Promise<string> {
  const { selectedAccount, injector } = useWalletStore.getState();
  
  if (!selectedAccount || !injector) {
    throw new Error('No wallet connected');
  }

  // In mock mode, simulate the transaction
  if (config.features.mockMode) {
    console.log('Mock: User signing shadow item transaction', transaction);
    await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate signing delay
    toast.success('Mock: Shadow item submitted successfully');
    return '0x' + Math.random().toString(16).substr(2, 64);
  }

  const api = getApi();
  
  return new Promise((resolve, reject) => {
    let unsub: (() => void) | undefined;
    
    // Check if shadow pallet exists
    if (!api.tx.shadow) {
      const error = new Error('Shadow pallet not available on this chain');
      toast.error('Shadow pallet not found');
      return reject(error);
    }
    
    // The transaction contains args that we need to use to construct the extrinsic
    const { args } = transaction;
    const [content, source, metadata] = args;
    
    // Create timeout for the transaction
    const timeout = setTimeout(() => {
      if (unsub) unsub();
      reject(new Error('Transaction timeout'));
    }, 60000); // 60 second timeout
    
    try {
      // Detect how many arguments the chain expects
      const expectedArgs = api.tx.shadow.submitShadowItem.meta.args.length;
      console.log(`Chain expects ${expectedArgs} arguments for submitShadowItem`);
      
      // Ensure content and metadata are properly formatted
      const contentArg = typeof content === 'string'
        ? content.startsWith('0x')
          ? content
          : u8aToHex(stringToU8a(content))
        : content;
        
      const sourceArg = typeof source === 'string'
        ? (source === 'GitHub' || source === 'github' ? 0 : 1)
        : source;
        
      const metadataArg = typeof metadata === 'string'
        ? metadata.startsWith('0x')
          ? metadata
          : u8aToHex(stringToU8a(metadata))
        : metadata;
      
      let extrinsic: any;
      
      if (expectedArgs === 4) {
        // Old chain version expects 4 arguments: content, encrypted_key, source, metadata
        console.log('Creating extrinsic with 4 arguments (including empty encrypted key for compatibility)');
        
        const emptyEncryptedKey = '0x'; // Empty encrypted key for compatibility
        
        console.log('Submitting shadow item with args:', {
          content: contentArg.substring(0, 100) + '...',
          encryptedKey: emptyEncryptedKey,
          source: sourceArg,
          metadata: metadataArg.substring(0, 100) + '...'
        });
        
        extrinsic = api.tx.shadow.submitShadowItem(
          contentArg,
          emptyEncryptedKey,
          sourceArg,
          metadataArg
        );
      } else if (expectedArgs === 3) {
        // New chain version expects 3 arguments: content, source, metadata
        console.log('Creating extrinsic with 3 arguments (no encryption)');
        
        console.log('Submitting shadow item with args:', {
          content: contentArg.substring(0, 100) + '...',
          source: sourceArg,
          metadata: metadataArg.substring(0, 100) + '...'
        });
        
        extrinsic = api.tx.shadow.submitShadowItem(
          contentArg,
          sourceArg,
          metadataArg
        );
      } else {
        throw new Error(`Unexpected number of arguments for submitShadowItem: ${expectedArgs}`);
      }
      
      console.log('Submitting shadow item transaction');
      
      // Sign and send the extrinsic
      extrinsic.signAndSend(
          selectedAccount.address,
          { signer: injector.signer },
          (result: any) => {
            console.log(`Transaction status: ${result.status.type}`);
            
            if (result.status.isInBlock) {
              console.log(`Transaction included at blockHash ${result.status.asInBlock}`);
              toast.info('Transaction included in block');
            } else if (result.status.isFinalized) {
              console.log(`Transaction finalized at blockHash ${result.status.asFinalized}`);
              clearTimeout(timeout);
              
              // Check for errors
              let hasError = false;
              result.events.forEach(({ phase, event: { data, method, section } }: any) => {
                if (section === 'system' && method === 'ExtrinsicFailed') {
                  const [error] = data as any;
                  console.error('Transaction failed:', error.toString());
                  hasError = true;
                  toast.error('Transaction failed on chain');
                  reject(new Error('Transaction failed'));
                } else if (section === 'shadow' && method === 'ShadowItemStored') {
                  console.log('Shadow item stored successfully');
                }
              });
              
              if (!hasError) {
                toast.success('Shadow item submitted successfully!');
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
        .then((unsubscribe: any) => {
          unsub = unsubscribe;
        })
        .catch((error: any) => {
          clearTimeout(timeout);
          console.error('Failed to submit transaction:', error);
          toast.error(`Failed to submit: ${error.message}`);
          reject(error);
        });
    } catch (error: any) {
      clearTimeout(timeout);
      console.error('Failed to create extrinsic:', error);
      toast.error(`Failed to create transaction: ${error.message}`);
      reject(error);
    }
  });
}

export async function grantConsentWithUserSigning(
  messageHash: string,
  duration?: number
): Promise<string> {
  const { selectedAccount, injector } = useWalletStore.getState();
  
  if (!selectedAccount || !injector) {
    throw new Error('No wallet connected');
  }

  // In mock mode, simulate the consent
  if (config.features.mockMode) {
    console.log('Mock: User granting consent', { messageHash, duration });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Store mock consent in localStorage
    const mockConsent = {
      grantedAt: Date.now(),
      expiresAt: duration ? Date.now() + duration * 1000 : null,
      messageHash
    };
    localStorage.setItem('shadowchain_mock_consent', JSON.stringify(mockConsent));
    
    toast.success('Mock: Consent granted successfully');
    return '0x' + Math.random().toString(16).substr(2, 64);
  }

  const api = getApi();
  
  return new Promise((resolve, reject) => {
    let unsub: (() => void) | undefined;
    
    // Check if shadow pallet exists
    if (!api.tx.shadow) {
      const error = new Error('Shadow pallet not available');
      toast.error('Shadow pallet not found');
      return reject(error);
    }
    
    const timeout = setTimeout(() => {
      if (unsub) unsub();
      reject(new Error('Transaction timeout'));
    }, 60000);
    
    api.tx.shadow
      .grantConsent(messageHash, duration)
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
                hasError = true;
                toast.error('Consent transaction failed');
                reject(new Error('Consent transaction failed'));
              } else if (section === 'shadow' && method === 'ConsentGranted') {
                console.log('Consent granted successfully');
              }
            });
            
            if (!hasError) {
              toast.success('Consent granted successfully!');
              if (unsub) unsub();
              resolve(result.status.asFinalized.toString());
            }
          } else if (result.isError) {
            clearTimeout(timeout);
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
        console.error('Failed to grant consent:', error);
        toast.error(`Failed to grant consent: ${error.message}`);
        reject(error);
      });
  });
}