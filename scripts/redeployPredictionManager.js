const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Redeploying PredictionManager with account:", deployer.address);

  // Load existing deployment info
  const network = hre.network.name;
  const deploymentPath = `deployments/${network}.json`;
  
  if (!fs.existsSync(deploymentPath)) {
    console.error("Deployment file not found. Please deploy all contracts first.");
    process.exit(1);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const cardPackFactoryAddress = deployment.contracts.CardPackFactory;
  const fanNFTAddress = deployment.contracts.DynamicFanNFT;

  console.log("Using existing contracts:");
  console.log("  CardPackFactory:", cardPackFactoryAddress);
  console.log("  DynamicFanNFT:", fanNFTAddress);

  // Deploy new PredictionManager
  console.log("\nDeploying new PredictionManager...");
  const PredictionManager = await hre.ethers.getContractFactory("PredictionManager");
  const predictionManager = await PredictionManager.deploy(cardPackFactoryAddress, fanNFTAddress);
  await predictionManager.waitForDeployment();
  const predictionManagerAddress = await predictionManager.getAddress();
  console.log("New PredictionManager deployed to:", predictionManagerAddress);

  // Set PredictionManager in FanNFT
  console.log("\nSetting PredictionManager in FanNFT...");
  const DynamicFanNFT = await hre.ethers.getContractFactory("DynamicFanNFT");
  const fanNFT = DynamicFanNFT.attach(fanNFTAddress);
  await fanNFT.setPredictionManager(predictionManagerAddress);
  console.log("PredictionManager set in FanNFT");

  // Update deployment file
  deployment.contracts.PredictionManager = predictionManagerAddress;
  deployment.timestamp = new Date().toISOString();
  
  fs.writeFileSync(
    deploymentPath,
    JSON.stringify(deployment, null, 2)
  );

  console.log("\n=== Updated Deployment Summary ===");
  console.log("CardPackFactory:", cardPackFactoryAddress);
  console.log("DynamicFanNFT:", fanNFTAddress);
  console.log("PredictionManager:", predictionManagerAddress);
  console.log("\n✅ Update frontend/src/config.js with the new PredictionManager address!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

