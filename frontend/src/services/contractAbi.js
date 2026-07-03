export const GIG_ESCROW_ABI = [
  {
    "inputs": [
      {"internalType": "address", "name": "_freelancer", "type": "address"},
      {"internalType": "string", "name": "_title", "type": "string"},
      {"internalType": "string", "name": "_termsCID", "type": "string"},
      {"internalType": "uint256", "name": "_totalAmount", "type": "uint256"},
      {"internalType": "uint256", "name": "_deadline", "type": "uint256"},
      {"internalType": "string[]", "name": "_milestoneDescriptions", "type": "string[]"},
      {"internalType": "uint256[]", "name": "_milestoneAmounts", "type": "uint256[]"}
    ],
    "name": "createContract",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "uint256", "name": "contractId", "type": "uint256"},
      {"indexed": true, "internalType": "address", "name": "client", "type": "address"},
      {"indexed": true, "internalType": "address", "name": "freelancer", "type": "address"},
      {"indexed": false, "internalType": "uint256", "name": "totalAmount", "type": "uint256"}
    ],
    "name": "ContractCreated",
    "type": "event"
  },
  {
    "inputs": [
      {"internalType": "uint256", "name": "_contractId", "type": "uint256"},
      {"internalType": "address", "name": "_freelancer", "type": "address"}
    ],
    "name": "setFreelancer",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];
