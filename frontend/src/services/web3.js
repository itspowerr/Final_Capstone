/**
 * web3.js — Sarun's MetaMask / ethers.js Service
 *
 * Core helpers for interacting with MetaMask and the Ethereum blockchain.
 * Uses ethers.js v6.
 *
 * Security: User's private key NEVER leaves MetaMask. All signing happens
 * in the MetaMask popup. This file only creates providers/signers from
 * window.ethereum (MetaMask's injected provider).
 *
 * Key Functions:
 *   getProvider()        — Creates BrowserProvider from window.ethereum
 *   getSigner()          — Gets the Signer (authenticated user)
 *   getAccount()         — Gets the connected account address
 *   getBalance()         — Gets ETH balance for an address
 *   ensureCorrectNetwork() — Checks chain ID, prompts switch to Hardhat
 *   getContract()        — Creates a Contract instance with signer (Phase 2)
 */

import { BrowserProvider, Contract } from 'ethers';
import config from '../config';

/**
 * Returns a BrowserProvider wrapping MetaMask (window.ethereum).
 * This is the entry point for all blockchain interaction.
 *
 * MetaMask injects window.ethereum which is an EIP-1193 provider.
 * ethers.js v6 BrowserProvider wraps it for the ethers API.
 */
export function getProvider() {
  if (!window.ethereum) {
    throw new Error('MetaMask is not installed. Please install MetaMask browser extension.');
  }
  return new BrowserProvider(window.ethereum);
}

/**
 * Gets the Signer (the authenticated wallet account).
 * This requires an active MetaMask connection.
 * The Signer can sign messages and transactions.
 */
export async function getSigner() {
  const provider = getProvider();
  return provider.getSigner();
}

/**
 * Gets the currently connected account address from MetaMask.
 * Returns the first account in the list (user's selected account).
 */
export async function getAccount() {
  const accounts = await getProvider().listAccounts();
  if (accounts.length === 0) return null;
  return accounts[0];
}

/**
 * Gets ETH balance for a given address.
 * Returns as a formatted string in ETH (not wei).
 *
 * Example: await getBalance('0xf39Fd...') → "9999.99"
 */
export async function getBalance(address) {
  const provider = getProvider();
  const balance = await provider.getBalance(address);
  const { ethers } = await import('ethers');
  return ethers.formatEther(balance);
}

/**
 * Ensures MetaMask is connected to the correct network.
 * If not, prompts user to switch to the Hardhat network (chain ID 31337).
 *
 * This is called before any blockchain transaction to prevent
   "Wrong Network" errors.
 *
 * Reference: MetaMask wallet_switchEthereumChain RPC
 */
export async function ensureCorrectNetwork() {
  if (!window.ethereum) return;

  const chainIdHex = '0x' + config.chainId.toString(16);
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: chainIdHex }],
    });
  } catch (switchError) {
    if (switchError.code === 4902) {
      try {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: chainIdHex,
            chainName: 'Hardhat Local',
            rpcUrls: [config.rpcUrl],
            nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
          }],
        });
      } catch (addError) {
        throw new Error('Could not add Hardhat network to MetaMask.');
      }
    } else {
      throw switchError;
    }
  }
}

/**
 * Creates an ethers.js Contract instance connected to the user's signer.
 * Used in Phase 2 for user-signed transactions (MetaMask popup).
 *
 * @param {string} address — Contract address
 * @param {Array} abi — Contract ABI
 * @returns {Contract} — Contract instance with signer
 */
export async function getContract(address, abi) {
  const signer = await getSigner();
  return new Contract(address, abi, signer);
}
