/**
 * auth.js — Sarun's Wallet Authentication Service
 *
 * Handles the MetaMask wallet auth flow:
 *   1. connectWallet()     — Requests MetaMask connection, returns address + provider
 *   2. getChallenge()      — Calls backend for a nonce to sign
 *   3. signMessage()       — Prompts user to sign the nonce in MetaMask
 *   4. walletLogin()       - Sends signature to backend for verification + JWT
 *   5. checkWalletStatus() — Checks if wallet has existing user account
 *
 * Flow (SIWE - Sign-In with Ethereum):
 *   connect → challenge → sign → login → JWT
 *
 * Security:
 *   - Nonce prevents replay attacks
 *   - ECDSA signature proves wallet ownership
 *   - Private key never leaves MetaMask
 */

import api from './api';
import { getProvider } from './web3';

/**
 * Connects to MetaMask wallet.
 * Calls eth_requestAccounts which shows MetaMask popup.
 *
 * @returns {{ address: string, provider: BrowserProvider }}
 */
export async function connectWallet() {
  if (!window.ethereum) {
    throw new Error('MetaMask is not installed. Please install MetaMask browser extension.');
  }

  const provider = getProvider();

  // Request account access — shows MetaMask popup
  // This is the first interaction — user must approve
  await provider.send('eth_requestAccounts', []);

  const signer = await provider.getSigner();
  const address = await signer.getAddress();

  return { address: address.toLowerCase(), provider };
}

/**
 * Gets a nonce from the backend for wallet authentication.
 * Nonce is a random string stored in Redis with 5-min TTL.
 *
 * @param {string} address — Ethereum wallet address
 * @returns {Promise<string>} — The nonce to sign
 */
export async function getChallenge(address) {
  const { data } = await api.get('/auth/wallet/challenge', {
    params: { address },
  });
  return data.nonce;
}

/**
 * Prompts user to sign a message with MetaMask.
 * This calls personal_sign which shows a "Sign" popup in MetaMask.
 *
 * @param {BrowserProvider} provider — ethers provider
 * @param {string} message — The nonce string to sign
 * @returns {Promise<string>} — The signature (0x-prefixed hex)
 */
export async function signMessage(provider, message) {
  const signer = await provider.getSigner();
  return signer.signMessage(message);
}

/**
 * Sends the signed nonce to the backend for verification.
 * If successful, returns JWT tokens and user info.
 *
 * Accepts all fields the backend needs for different flows:
 *   - Pure MetaMask login: { address, signature }
 *   - New wallet user: { address, signature, role }
 *   - Sign-up with email: { address, signature, email, password, username, role }
 *
 * @param {object} payload — { address, signature, role?, email?, password?, username? }
 * @returns {Promise<object>} — { access_token, refresh_token, user }
 */
export async function walletLogin(payload) {
  const { data } = await api.post('/auth/wallet/login', payload);
  return data;
}

/**
 * Checks if a wallet address has an existing user account.
 * Used to determine: show role selector (new) or direct login (existing).
 *
 * @param {string} address — Wallet address
 * @returns {Promise<object>} — { exists, user_id?, role? }
 */
export async function checkWalletStatus(address) {
  const { data } = await api.get('/auth/wallet/status', {
    params: { address },
  });
  return data;
}
