const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Redeploying DynamicFanNFT with account:", deployer.address);
  console.log("Account balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString());

  // Load existing deployment info
  const network = hre.network.name;
  const deploymentPath = `deployments/${network}.json`;
  
  if (!fs.existsSync(deploymentPath)) {
    console.error("Deployment file not found. Please deploy all contracts first.");
    process.exit(1);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const predictionManagerAddress = deployment.contracts.PredictionManager;

  console.log("Using existing PredictionManager:", predictionManagerAddress);

  // Deploy new DynamicFanNFT
  console.log("\nDeploying new DynamicFanNFT...");
  const baseURI = "https://fanforge.com/api/nft"; // Update with your actual metadata URL
  const DynamicFanNFT = await hre.ethers.getContractFactory("DynamicFanNFT");
  const fanNFT = await DynamicFanNFT.deploy(baseURI);
  await fanNFT.waitForDeployment();
  const fanNFTAddress = await fanNFT.getAddress();
  console.log("New DynamicFanNFT deployed to:", fanNFTAddress);

  // Set PredictionManager in FanNFT
  console.log("\nSetting PredictionManager in FanNFT...");
  await fanNFT.setPredictionManager(predictionManagerAddress);
  console.log("PredictionManager set in FanNFT");

  // Note: PredictionManager's fanNFT is set in constructor and cannot be changed
  // The new FanNFT will work, but PredictionManager will still reference the old one
  // For a complete update, you'd need to redeploy PredictionManager too
  console.log("\n⚠️  Note: PredictionManager's fanNFT reference is set in constructor");
  console.log("   The new FanNFT will work for demo updates, but PredictionManager");
  console.log("   will continue using the old FanNFT for automatic updates.");
  console.log("   For a complete update, redeploy PredictionManager as well.");

  // Update deployment file
  deployment.contracts.DynamicFanNFT = fanNFTAddress;
  deployment.timestamp = new Date().toISOString();
  
  fs.writeFileSync(
    deploymentPath,
    JSON.stringify(deployment, null, 2)
  );

  console.log("\n=== Updated Deployment Summary ===");
  console.log("CardPackFactory:", deployment.contracts.CardPackFactory);
  console.log("PredictionManager:", predictionManagerAddress);
  console.log("DynamicFanNFT:", fanNFTAddress);
  console.log("\n✅ Update frontend/src/config.js with the new DynamicFanNFT address!");
  console.log("\n⚠️  Important: If you want existing predictions to work with the new NFT,");
  console.log("   you'll need to redeploy PredictionManager as well, or migrate users to the new NFT.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

