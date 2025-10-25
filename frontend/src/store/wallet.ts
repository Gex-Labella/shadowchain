import { create } from 'zustand';
import { web3Accounts, web3Enable, web3FromAddress } from '@polkadot/extension-dapp';
import { InjectedAccountWithMeta } from '@polkadot/extension-inject/types';
import { toast } from 'react-toastify';

interface WalletState {
  isInitialized: boolean;
  isConnected: boolean;
  accounts: InjectedAccountWithMeta[];
  selectedAccount: InjectedAccountWithMeta | null;
  injector: any;
  
  initializeWallet: () => Promise<void>;
  connect: () => Promise<void>;
  disconnect: () => void;
  selectAccount: (account: InjectedAccountWithMeta) => Promise<void>;
}

export const useWalletStore = create<WalletState>((set, get) => ({
  isInitialized: false,
  isConnected: false,
  accounts: [],
  selectedAccount: null,
  injector: null,

  initializeWallet: async () => {
    try {
      // Check if extension is installed
      const extensions = await web3Enable('Shadow Chain');
      
      if (extensions.length === 0) {
        toast.error('Please install Polkadot.js extension');
        set({ isInitialized: true });
        return;
      }

      // Get saved account from localStorage
      const savedAddress = localStorage.getItem('shadowchain_account');
      
      if (savedAddress) {
        const allAccounts = await web3Accounts();
        const savedAccount = allAccounts.find(acc => acc.address === savedAddress);
        
        if (savedAccount) {
          const injector = await web3FromAddress(savedAccount.address);
          set({
            isInitialized: true,
            isConnected: true,
            accounts: allAccounts,
            selectedAccount: savedAccount,
            injector,
          });
          return;
        }
      }

      set({ isInitialized: true });
    } catch (error) {
      console.error('Failed to initialize wallet:', error);
      toast.error('Failed to initialize wallet');
      set({ isInitialized: true });
    }
  },

  connect: async () => {
    try {
      const extensions = await web3Enable('Shadow Chain');
      
      if (extensions.length === 0) {
        toast.error('Please install Polkadot.js extension');
        return;
      }

      const allAccounts = await web3Accounts();
      
      if (allAccounts.length === 0) {
        toast.error('No accounts found. Please create an account in Polkadot.js extension');
        return;
      }

      set({ accounts: allAccounts });
      
      // Auto-select first account if only one
      if (allAccounts.length === 1) {
        await get().selectAccount(allAccounts[0]);
      }
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      toast.error('Failed to connect wallet');
    }
  },

  disconnect: () => {
    localStorage.removeItem('shadowchain_account');
    set({
      isConnected: false,
      selectedAccount: null,
      accounts: [],
      injector: null,
    });
    toast.info('Wallet disconnected');
  },

  selectAccount: async (account: InjectedAccountWithMeta) => {
    try {
      const injector = await web3FromAddress(account.address);
      
      localStorage.setItem('shadowchain_account', account.address);
      
      set({
        isConnected: true,
        selectedAccount: account,
        injector,
      });
      
      toast.success(`Connected to ${account.meta.name || account.address}`);
    } catch (error) {
      console.error('Failed to select account:', error);
      toast.error('Failed to select account');
    }
  },
}));