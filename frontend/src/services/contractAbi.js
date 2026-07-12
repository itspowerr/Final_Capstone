export const GIG_ESCROW_ABI = [
  {
    "inputs": [
      {"internalType": "address", "name": "_client", "type": "address"},
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
  },
  {
    "inputs": [{"internalType": "uint256", "name": "_contractId", "type": "uint256"}],
    "name": "fundContract",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "uint256", "name": "_contractId", "type": "uint256"},
      {"internalType": "uint256", "name": "_milestoneIndex", "type": "uint256"}
    ],
    "name": "approveMilestone",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "uint256", "name": "_contractId", "type": "uint256"},
      {"internalType": "uint256", "name": "_milestoneIndex", "type": "uint256"},
      {"internalType": "string", "name": "_deliverableCID", "type": "string"}
    ],
    "name": "submitMilestone",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "uint256", "name": "_contractId", "type": "uint256"},
      {"internalType": "uint256", "name": "_milestoneIndex", "type": "uint256"}
    ],
    "name": "rejectMilestone",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "_contractId", "type": "uint256"}],
    "name": "getContractDetails",
    "outputs": [{
      "components": [
        {"internalType": "address", "name": "client", "type": "address"},
        {"internalType": "address", "name": "freelancer", "type": "address"},
        {"internalType": "string", "name": "title", "type": "string"},
        {"internalType": "string", "name": "termsCID", "type": "string"},
        {"internalType": "uint256", "name": "totalAmount", "type": "uint256"},
        {"internalType": "uint256", "name": "deadline", "type": "uint256"},
        {"internalType": "uint8", "name": "status", "type": "uint8"},
        {"internalType": "uint256", "name": "milestoneCount", "type": "uint256"},
        {"internalType": "uint256", "name": "completedMilestones", "type": "uint256"}
      ],
      "internalType": "struct GigEscrow.EscrowContract",
      "name": "",
      "type": "tuple"
    }],
    "stateMutability": "view",
    "type": "function"
  }
];
