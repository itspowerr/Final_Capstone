const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("\n=== Deploying GigEscrow ===\n");
  console.log("Deployer:", deployer.address);

  const GigEscrow = await hre.ethers.getContractFactory("GigEscrow");
  const escrow = await GigEscrow.deploy();
  await escrow.waitForDeployment();

  const address = await escrow.getAddress();
  console.log("GigEscrow deployed to:", address);

  const backendEnvPath = path.resolve(__dirname, "../../backend/.env");
  try {
    fs.appendFileSync(backendEnvPath, `\nCONTRACT_ADDRESS=${address}\n`);
    console.log("CONTRACT_ADDRESS appended to backend/.env\n");
  } catch (err) {
    console.warn("WARNING: could not write backend/.env from deploy script:", err.message);
  }

  const frontendEnvPath = path.resolve(__dirname, "../../frontend/.env");
  try {
    fs.appendFileSync(frontendEnvPath, `\nREACT_APP_CONTRACT_ADDRESS=${address}\n`);
    console.log("REACT_APP_CONTRACT_ADDRESS appended to frontend/.env\n");
  } catch (err) {
    console.warn("WARNING: could not write frontend/.env from deploy script:", err.message);
  }

  const artifactsPath = path.resolve(__dirname, "../artifacts/contracts/GigEscrow.sol/GigEscrow.json");
  const targetDir = path.resolve(__dirname, "../../backend/app/contracts");
  fs.mkdirSync(targetDir, { recursive: true });
  fs.copyFileSync(artifactsPath, path.join(targetDir, "GigEscrow.json"));
  console.log("ABI copied to backend/app/contracts/\n");

  const infoPath = path.resolve(__dirname, "contract-address.txt");
  const info = [
    `Contract: ${address}`,
    `Deployer: ${deployer.address}`,
    "",
    "=== Hardhat Test Accounts ===",
    "Account #0 (deployer): 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    "Account #1:            0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    "",
    "Import Account #0 private key into MetaMask:",
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  ].join("\n");
  fs.writeFileSync(infoPath, info);
  console.log("Deployment info written to scripts/contract-address.txt");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
