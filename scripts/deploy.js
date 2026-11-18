// Deploy AgentPulse to BNB Smart Chain (mainnet, chainId 56).
// Deployer: the user's airdrop wallet (key read from its locked wallet file,
// never printed). The contract has no owner/admin, so the deployer address
// holds no power over it after deployment.
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const AGENT_ID = "0x60b9262456de011f7d15a54cdd8c48baaa8b022f"; // SPACE ID Agent ID, BSC
const RPC = process.env.BSC_RPC || "https://bsc-dataseed.binance.org";

(async () => {
  const walletFile = JSON.parse(fs.readFileSync(path.join(process.env.HOME, "workspace/airdrop-wallet/wallet.json"), "utf8"));
  const provider = new ethers.JsonRpcProvider(RPC, 56);
  const wallet = new ethers.Wallet(walletFile.private_key, provider);
  console.log("deployer:", wallet.address);
  const bal = await provider.getBalance(wallet.address);
  console.log("balance BNB:", ethers.formatEther(bal));
  if (bal < ethers.parseEther("0.00008")) {
    console.error("INSUFFICIENT: need at least ~0.00008 BNB for deployment gas");
    process.exit(2);
  }
  const art = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "build", "AgentPulse.json"), "utf8"));
  const factory = new ethers.ContractFactory(art.abi, art.bytecode, wallet);
  const fee = await provider.getFeeData();
  const gasPrice = fee.gasPrice || ethers.parseUnits("0.05", "gwei");
  console.log("gasPrice gwei:", ethers.formatUnits(gasPrice, "gwei"));
  const contract = await factory.deploy(AGENT_ID, { gasPrice });
  console.log("deploy tx:", contract.deploymentTransaction().hash);
  await contract.waitForDeployment();
  const addr = await contract.getAddress();
  const receipt = await provider.getTransactionReceipt(contract.deploymentTransaction().hash);
  console.log("AgentPulse deployed:", addr, "block", receipt.blockNumber, "gasUsed", receipt.gasUsed.toString());
  const onchainAgent = await contract.agentId();
  console.log("agentId() on-chain:", onchainAgent);
  const out = {
    project: "AgentPulse",
    chain: "BNB Smart Chain",
    chainId: 56,
    contract: addr,
    agentIdContract: onchainAgent,
    deployer: wallet.address,
    deployTx: receipt.hash,
    block: receipt.blockNumber,
    gasUsed: receipt.gasUsed.toString(),
    deployedAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(__dirname, "..", "deployment.json"), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
})().catch((e) => { console.error(e.message || e); process.exit(1); });
