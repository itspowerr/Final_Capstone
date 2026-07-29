/**
 * useAuth.js — Sarun's Wallet Authentication Hook
 *
 * Orchestrates the complete MetaMask wallet authentication flow:
 *   1. Connect to MetaMask (eth_requestAccounts)
 *   2. Check if wallet has existing user (GET /wallet/status)
 *   3. Get nonce from backend (GET /wallet/challenge)
 *   4. Sign nonce with MetaMask (personal_sign)
 *   5. Submit signature to backend (POST /wallet/login)
 *   6. Store JWT tokens in localStorage
 *   7. Update AppContext with user/wallet state
 *
 * Why a custom hook?
 *   - Encapsulates complex multi-step async logic
 *   - Reusable across Login.js, Navbar.js, Profile.js
 *   - Separates auth flow from UI (Login.js stays lean)
 *   - Manages loading/error states cleanly
 *
 * Usage:
 *   const { connectAndCheck, disconnectWallet, loading, error } = useAuth();
 *   await connectAndCheck(); // Full flow
 *   await connectAndCheck('client'); // For new users with role
 */

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import {
  connectWallet as connectWalletService,
  getChallenge,
  signMessage,
  walletLogin,
  checkWalletStatus,
} from '../services/auth';

export default function useAuth() {
  const navigate = useNavigate();
  const { setUser, setLoading, setError, connectWallet, disconnectWallet } = useApp();
  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState(null);

  /**
   * Main wallet connection and authentication flow.
   *
   * Steps:
   *   1. Connect to MetaMask (popup)
   *   2. Check wallet status (exists? or new?)
   *   3. If exists with role → auto-login
   *   4. If new → need to prompt for role
   *   5. Get nonce from backend
   *   6. Sign nonce in MetaMask (popup)
   *   7. Submit signature → get JWT
   *   8. Store in localStorage + AppContext
   *
   * @param {string} [role] — Required for new users
   * @returns {object} { status, needsRole?, user? }
   */
  const connectAndCheck = useCallback(async (role, email, password, username) => {
    setLoading(true);
    setLocalLoading(true);
    setError(null);
    setLocalError(null);

    try {
      // Step 1: Connect MetaMask (popup)
      const { address, provider } = await connectWalletService();
      connectWallet(address);

      // Step 2: Check if wallet has existing account
      const ws = await checkWalletStatus(address);

      // Step 3: If new user and no role provided, tell caller
      if (!ws.exists && !role) {
        setLoading(false);
        setLocalLoading(false);
        return { status: 'needs_role', address, provider };
      }

      // Step 4-5: Get nonce and sign it
      const nonce = await getChallenge(address);
      const signature = await signMessage(provider, nonce);

      // Step 6-7: Submit signature, get JWT
      const loginPayload = { address, signature };
      // For new users with email (sign-up flow), pass all fields
      if (email) loginPayload.email = email;
      if (password) loginPayload.password = password;
      if (username) loginPayload.username = username;
      // For new users without email, pass just the role
      if (role) loginPayload.role = role;

      const result = await walletLogin(loginPayload);

      // Step 8: Store in localStorage
      localStorage.setItem('access_token', result.access_token);
      localStorage.setItem('refresh_token', result.refresh_token);
      localStorage.setItem('user', JSON.stringify(result.user));

      setUser(result.user);
      setLoading(false);
      setLocalLoading(false);

      // Yield to let React commit batched state updates before navigation
      await new Promise(r => setTimeout(r, 0));

      return { status: 'logged_in', user: result.user };
    } catch (err) {
      const msg =
        err.response?.data?.detail?.message ||
        err.response?.data?.detail ||
        err.message ||
        'Wallet connection failed';
      setError(msg);
      setLocalError(msg);
      setLoading(false);
      setLocalLoading(false);
      return { status: 'error', message: msg };
    }
  }, [setLoading, setError, setUser, connectWallet]);

  const logout = useCallback(() => {
    disconnectWallet();
    navigate('/login');
  }, [disconnectWallet, navigate]);

  return {
    connectAndCheck,
    logout,
    loading: localLoading,
    error: localError,
  };
}
