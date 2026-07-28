/**
 * config/index.js — Sarun's Blockchain Configuration
 *
 * Loads environment variables for blockchain interaction.
 * These are set in frontend/.env (create from .env.example).
 *
 * Variables:
 *   REACT_APP_CONTRACT_ADDRESS — Deployed GigEscrow contract address (Phase 2)
 *   REACT_APP_BLOCKCHAIN_RPC  — Hardhat node URL (default: http://localhost:8545)
 *   REACT_APP_CHAIN_ID        — Chain ID for network detection (default: 31337 = Hardhat local)
 */

const rt = window.__ENV__ || {};

const config = {
  contractAddress: rt.REACT_APP_CONTRACT_ADDRESS || process.env.REACT_APP_CONTRACT_ADDRESS || '',
  rpcUrl: rt.REACT_APP_BLOCKCHAIN_RPC || process.env.REACT_APP_BLOCKCHAIN_RPC || '',
  chainId: parseInt(rt.REACT_APP_CHAIN_ID || process.env.REACT_APP_CHAIN_ID) || 31337,
  apiUrl: rt.REACT_APP_API_URL || process.env.REACT_APP_API_URL || '',
  ipfsGateway: rt.REACT_APP_IPFS_GATEWAY || process.env.REACT_APP_IPFS_GATEWAY || '',
};

export default config;
