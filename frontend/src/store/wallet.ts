import { create } from 'zustand';
import { web3Accounts, web3Enable, web3FromAddress } from '@polkadot/extension-dapp';
import { InjectedAccountWithMeta } from '@polkadot/extension-inject/types';
import { toast } from 'react-toastify';

interface WalletState {
  isInitialized: boolean;
  isConnected: boolean;
  availableAccounts: InjectedAccountWithMeta[]; // All accounts from extension
  connectedAccounts: InjectedAccountWithMeta[]; // Accounts user chose to connect
  selectedAccount: InjectedAccountWithMeta | null; // Currently active account
  injector: any;
  isAccountSelectionOpen: boolean;
  
  initializeWallet: () => Promise<void>;
  openAccountSelection: () => Promise<void>;
  closeAccountSelection: () => void;
  connectAccounts: (accounts: InjectedAccountWithMeta[]) => Promise<void>;
  disconnect: () => void;
  selectAccount: (account: InjectedAccountWithMeta) => Promise<void>;
  switchAccount: (account: InjectedAccountWithMeta) => Promise<void>;
}

export const useWalletStore = create<WalletState>((set, get) => ({
  isInitialized: false,
  isConnected: false,
  availableAccounts: [],
  connectedAccounts: [],
  selectedAccount: null,
  injector: null,
  isAccountSelectionOpen: false,

  initializeWallet: async () => {
    try {
      // Check if extension is installed
      const extensions = await web3Enable('Shadow Chain');
      
      if (extensions.length === 0) {
        toast.error('Please install Polkadot.js extension');
        set({ isInitialized: true });
        return;
      }

      // Don't auto-connect, just mark as initialized
      set({ isInitialized: true });
    } catch (error) {
      console.error('Failed to initialize wallet:', error);
      toast.error('Failed to initialize wallet');
      set({ isInitialized: true });
    }
  },

  openAccountSelection: async () => {
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

      set({
        availableAccounts: allAccounts,
        isAccountSelectionOpen: true
      });
    } catch (error) {
      console.error('Failed to get accounts:', error);
      toast.error('Failed to get accounts');
    }
  },

  closeAccountSelection: () => {
    set({ isAccountSelectionOpen: false });
  },

  connectAccounts: async (accounts: InjectedAccountWithMeta[]) => {
    if (accounts.length === 0) {
      toast.error('Please select at least one account');
      return;
    }

    try {
      // Get injector for the first account
      const injector = await web3FromAddress(accounts[0].address);
      
      set({
        isConnected: true,
        connectedAccounts: accounts,
        selectedAccount: accounts[0],
        injector,
        isAccountSelectionOpen: false
      });
      
      toast.success(`Connected ${accounts.length} account${accounts.length > 1 ? 's' : ''}`);
    } catch (error) {
      console.error('Failed to connect accounts:', error);
      toast.error('Failed to connect accounts');
    }
  },

  disconnect: () => {
    // Clear any saved state
    localStorage.removeItem('shadowchain_account');
    set({
      isConnected: false,
      selectedAccount: null,
      connectedAccounts: [],
      availableAccounts: [],
      injector: null,
    });
    toast.info('Wallet disconnected');
  },

  selectAccount: async (account: InjectedAccountWithMeta) => {
    try {
      const injector = await web3FromAddress(account.address);
      
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

  switchAccount: async (account: InjectedAccountWithMeta) => {
    // Make sure the account is in connected accounts
    const { connectedAccounts } = get();
    if (!connectedAccounts.find(acc => acc.address === account.address)) {
      toast.error('Account not connected');
      return;
    }

    try {
      const injector = await web3FromAddress(account.address);
      
      set({
        selectedAccount: account,
        injector,
      });
      
      toast.info(`Switched to ${account.meta.name || account.address}`);
    } catch (error) {
      console.error('Failed to switch account:', error);
      toast.error('Failed to switch account');
    }
  },
}));