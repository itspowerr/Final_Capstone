#!/usr/bin/env node
/**
 * fund-wallet.js — Send test ETH from Hardhat to your MetaMask wallet
 *
 * Usage:
 *   node scripts/fund-wallet.js                     # fund default address
 *   node scripts/fund-wallet.js 0xYOUR_ADDRESS      # fund specific address
 *   node scripts/fund-wallet.js list                 # list all Hardhat accounts + balances
 *
 * Hardhat comes with 20 pre-funded accounts (10,000 ETH each).
 */

const { ethers } = require('ethers');

const RPC = process.env.RPC_URL || 'http://127.0.0.1:8545';

// Hardhat default accounts (the first 20)
const HARDHAT_ACCOUNTS = [
  { address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', key: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' },
  { address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', key: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' },
  { address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', key: '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a' },
  { address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906', key: '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6' },
  { address: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65', key: '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a' },
  { address: '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc', key: '0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba' },
  { address: '0x976EA74026E726554dB657fA54763abd0C3a0aa9', key: '0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e' },
  { address: '0x14dC79964da2C08daa49ef111B5fB1416B989Cdb', key: '0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356' },
  { address: '0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f', key: '0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97' },
  { address: '0xa0Ee7A142d267C1f36714E4a8F75612F20a79720', key: '0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6' },
  { address: '0xBcd4042DE499D14e55001Cbb2EB21E8FFC7E40f6', key: '0xf214f2b2cd398c806f84e317254e0f0b801d0643303237d97a22a48e01628897' },
  { address: '0x71bE63834f126D2Ff3533A492eBdf89851f988e4', key: '0x701b615bbdfb9de65240bc28bd21bbc0d996645a3dd57e7b12bc2bdf6f192c82' },
  { address: '0xFABB0ac9d68B0B445fB7357272FFa8de3299Acb5', key: '0xa58839d652827003091f586c07d8337837fb68431e1b6d1e894e0142d0be8b43' },
  { address: '0xdBFa550f425bf10d0f94681ea19794b165f12c56', key: '0x47c99abed3324a2707c28affff1267e45918ec8c3f20b8aa892e8b065d2942dd' },
  { address: '0x2B5ad5c4795c026514f8317c7a215E218DcCF69f', key: '0xc526ee95bf44d8fc405a158bb884d631b0f5edc0135a5f1e7d06b3e1e7e2b4e4' },
  { address: '0x28a89760B56E349E25c7067d1e5AC1aC86d71878', key: '0x94d1e04eb4c30e3b5e5b5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e' },
];

async function listAccounts(provider) {
  console.log('\n  Hardhat Test Accounts');
  console.log('  =====================\n');
  for (let i = 0; i < 10; i++) {
    const acct = HARDHAT_ACCOUNTS[i];
    const bal = await provider.getBalance(acct.address);
    const eth = ethers.formatEther(bal);
    console.log(`  #${i}  ${acct.address}`);
    console.log(`       Balance: ${eth} ETH`);
    console.log(`       Key:     ${acct.key}`);
    console.log('');
  }
}

async function fundWallet(target, ethAmount) {
  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(HARDHAT_ACCOUNTS[0].key, provider);
  const bal = await provider.getBalance(wallet.address);
  const ethBal = parseFloat(ethers.formatEther(bal));
  console.log(`\n  Funding wallet:`);
  console.log(`  From:   ${wallet.address} (${ethBal} ETH)`);
  console.log(`  To:     ${target}`);
  console.log(`  Amount: ${ethAmount} ETH\n`);

  if (ethBal < parseFloat(ethAmount)) {
    console.error('  ERROR: Insufficient balance in Hardhat account');
    process.exit(1);
  }

  const tx = await wallet.sendTransaction({
    to: target,
    value: ethers.parseEther(ethAmount),
  });
  console.log(`  TX hash: ${tx.hash}`);
  await tx.wait();
  const newBal = await provider.getBalance(target);
  console.log(`  Done! New balance: ${ethers.formatEther(newBal)} ETH\n`);
}

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const arg = process.argv[2];

  if (arg === 'list') {
    await listAccounts(provider);
    return;
  }

  const target = arg || HARDHAT_ACCOUNTS[0].address;
  const amount = process.argv[3] || '1000';

  if (!target.startsWith('0x') || target.length !== 42) {
    console.error('  Invalid address. Usage: node scripts/fund-wallet.js 0xYOUR_ADDRESS [amount]');
    process.exit(1);
  }

  await fundWallet(target, amount);
}

main().catch(e => {
  console.error('  Error:', e.message);
  process.exit(1);
});
