/**
 * AppContext.js — Sarun's Global Wallet & User State
 *
 * React Context that provides wallet connection state and user info
 * to all components in the app. Wraps the app in App.js.
 *
 * Why Context instead of just localStorage?
 *   - Components need to REACTIVELY know when wallet connects/disconnects
 *   - localStorage is passive — requires polling or manual checks
 *   - Context triggers re-renders when state changes
 *
 * Provided values:
 *   walletAddress  — Connected wallet address (null if not connected)
 *   user           — User object from JWT (null if not logged in)
 *   isConnected    — Boolean: is MetaMask connected?
 *   connectWallet  — Function to trigger connection flow
 *   disconnectWallet — Function to clear wallet state
 *   loading        — Loading state for async operations
 *   error          — Error message if something fails
 */

import { createContext, useContext, useState, useEffect } from 'react';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [walletAddress, setWalletAddress] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // On mount, check localStorage for existing session
  useEffect(() => {
    try {
      const raw = localStorage.getItem('user');
      if (raw) {
        const u = JSON.parse(raw);
        setUser(u);
        if (u.wallet_address) {
          setWalletAddress(u.wallet_address);
        }
      }
    } catch {
      // Invalid stored data — ignore
    }
  }, []);

  const connectWalletAction = (addr) => {
    setWalletAddress(addr);
    try {
      const raw = localStorage.getItem('user');
      if (raw) {
        const u = JSON.parse(raw);
        u.wallet_address = addr;
        localStorage.setItem('user', JSON.stringify(u));
      }
    } catch {}
  };

  const disconnectWallet = () => {
    setWalletAddress(null);
    try {
      const raw = localStorage.getItem('user');
      if (raw) {
        const u = JSON.parse(raw);
        u.wallet_address = null;
        localStorage.setItem('user', JSON.stringify(u));
      }
    } catch {}
  };

  const setUserAction = (userData) => {
    setUser(userData);
    if (userData?.wallet_address) {
      setWalletAddress(userData.wallet_address);
      try {
        const raw = localStorage.getItem('user');
        if (raw) {
          const u = JSON.parse(raw);
          u.wallet_address = userData.wallet_address;
          localStorage.setItem('user', JSON.stringify(u));
        }
      } catch {}
    }
  };

  const clearError = () => setError(null);

  const value = {
    walletAddress,
    user,
    isConnected: !!walletAddress,
    loading,
    error,
    setUser: setUserAction,
    setLoading,
    setError,
    clearError,
    connectWallet: connectWalletAction,
    disconnectWallet,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

/**
 * Custom hook to access AppContext.
 * Wrap components in <AppProvider> first.
 */
export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return ctx;
}

export default AppContext;
