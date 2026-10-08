import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const network = await ethers.provider.getNetwork();
  console.log("Deploying CredentialRegistry to network:", network.name);

  const [deployer] = await ethers.getSigners();
  console.log("Deployer address:", deployer.address);

  const CredentialRegistry = await ethers.getContractFactory("CredentialRegistry");
  const registry = await CredentialRegistry.deploy();
  await registry.waitForDeployment();

  const registryAddress = await registry.getAddress();
  console.log("CredentialRegistry deployed at:", registryAddress);

  const artifactPath = path.join(__dirname, "../artifacts/contracts/CredentialRegistry.sol/CredentialRegistry.json");
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  const exportData = {
    address: registryAddress,
    abi: artifact.abi,
    network: network.name,
    chainId: network.chainId.toString(),
  };

  const targetDirs = [
    path.join(__dirname, "../../frontend/src/contracts"),
    path.join(__dirname, "../../backend/src/contracts"),
  ];

  for (const dir of targetDirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(
      path.join(dir, "CredentialRegistry.json"),
      JSON.stringify(exportData, null, 2),
      "utf8"
    );
    console.log("Exported contract address and ABI to:", dir);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
