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

const config = {
  contractAddress: process.env.REACT_APP_CONTRACT_ADDRESS || '',
  rpcUrl: process.env.REACT_APP_BLOCKCHAIN_RPC || 'http://127.0.0.1:8545',
  chainId: parseInt(process.env.REACT_APP_CHAIN_ID) || 31337,
  apiUrl: process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api',
  ipfsGateway: process.env.REACT_APP_IPFS_GATEWAY || 'http://localhost:8080',
  googleClientId: process.env.REACT_APP_GOOGLE_CLIENT_ID || '',
};

export default config;
