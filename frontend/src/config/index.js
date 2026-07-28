import { runtimeConfig } from './runtime';

const config = {
  get contractAddress() { return runtimeConfig.REACT_APP_CONTRACT_ADDRESS || process.env.REACT_APP_CONTRACT_ADDRESS || ''; },
  get rpcUrl()           { return runtimeConfig.REACT_APP_BLOCKCHAIN_RPC || process.env.REACT_APP_BLOCKCHAIN_RPC || ''; },
  get chainId()          { return parseInt(runtimeConfig.REACT_APP_CHAIN_ID || process.env.REACT_APP_CHAIN_ID) || 31337; },
  get apiUrl()           { return runtimeConfig.REACT_APP_API_URL || process.env.REACT_APP_API_URL || ''; },
  get ipfsGateway()      { return runtimeConfig.REACT_APP_IPFS_GATEWAY || process.env.REACT_APP_IPFS_GATEWAY || ''; },
};

export default config;
