const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Redeploying CardPackFactory with account:", deployer.address);

  // Load existing deployment info
  const network = hre.network.name;
  const deploymentPath = `deployments/${network}.json`;
  
  let deployment = {};
  if (fs.existsSync(deploymentPath)) {
    deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  }

  // Deploy new CardPackFactory
  console.log("\nDeploying new CardPackFactory...");
  const CardPackFactory = await hre.ethers.getContractFactory("CardPackFactory");
  const cardPackFactory = await CardPackFactory.deploy();
  await cardPackFactory.waitForDeployment();
  const cardPackFactoryAddress = await cardPackFactory.getAddress();
  console.log("New CardPackFactory deployed to:", cardPackFactoryAddress);

  // Update deployment file
  if (!deployment.contracts) {
    deployment.contracts = {};
  }
  deployment.contracts.CardPackFactory = cardPackFactoryAddress;
  deployment.timestamp = new Date().toISOString();
  deployment.network = network;
  deployment.chainId = (await hre.ethers.provider.getNetwork()).chainId.toString();
  
  // Ensure deployments directory exists
  const deploymentsDir = "deployments";
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  
  fs.writeFileSync(
    deploymentPath,
    JSON.stringify(deployment, null, 2)
  );

  console.log("\n=== Updated Deployment Summary ===");
  console.log("CardPackFactory:", cardPackFactoryAddress);
  if (deployment.contracts.DynamicFanNFT) {
    console.log("DynamicFanNFT:", deployment.contracts.DynamicFanNFT);
  }
  if (deployment.contracts.PredictionManager) {
    console.log("PredictionManager:", deployment.contracts.PredictionManager);
  }
  console.log("\n✅ Update frontend/src/config.js with the new CardPackFactory address!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


