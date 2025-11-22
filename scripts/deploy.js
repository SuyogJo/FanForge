const hre = require("hardhat");

async function main() {
  // Check if private key is configured
  if (!process.env.PRIVATE_KEY) {
    throw new Error("PRIVATE_KEY not found in .env file. Please add your private key to .env file.");
  }

  const [deployer] = await hre.ethers.getSigners();
  
  if (!deployer) {
    throw new Error("No deployer account found. Check your PRIVATE_KEY in .env file.");
  }
  
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString());

  // Deploy CardPackFactory
  console.log("\nDeploying CardPackFactory...");
  const CardPackFactory = await hre.ethers.getContractFactory("CardPackFactory");
  const cardPackFactory = await CardPackFactory.deploy();
  await cardPackFactory.waitForDeployment();
  const cardPackFactoryAddress = await cardPackFactory.getAddress();
  console.log("CardPackFactory deployed to:", cardPackFactoryAddress);

  // Deploy DynamicFanNFT
  console.log("\nDeploying DynamicFanNFT...");
  const baseURI = "https://fanforge.com/api/nft"; // Update with your actual metadata URL
  const DynamicFanNFT = await hre.ethers.getContractFactory("DynamicFanNFT");
  const fanNFT = await DynamicFanNFT.deploy(baseURI);
  await fanNFT.waitForDeployment();
  const fanNFTAddress = await fanNFT.getAddress();
  console.log("DynamicFanNFT deployed to:", fanNFTAddress);

  // Deploy PredictionManager
  console.log("\nDeploying PredictionManager...");
  const PredictionManager = await hre.ethers.getContractFactory("PredictionManager");
  const predictionManager = await PredictionManager.deploy(cardPackFactoryAddress, fanNFTAddress);
  await predictionManager.waitForDeployment();
  const predictionManagerAddress = await predictionManager.getAddress();
  console.log("PredictionManager deployed to:", predictionManagerAddress);

  // Set PredictionManager in FanNFT
  console.log("\nSetting PredictionManager in FanNFT...");
  await fanNFT.setPredictionManager(predictionManagerAddress);
  console.log("PredictionManager set in FanNFT");

  console.log("\n=== Deployment Summary ===");
  console.log("CardPackFactory:", cardPackFactoryAddress);
  console.log("DynamicFanNFT:", fanNFTAddress);
  console.log("PredictionManager:", predictionManagerAddress);
  console.log("\nSave these addresses for your frontend!");

  // Create a deployment info file
  const fs = require("fs");
  const deploymentInfo = {
    network: hre.network.name,
    chainId: (await hre.ethers.provider.getNetwork()).chainId,
    deployer: deployer.address,
    contracts: {
      CardPackFactory: cardPackFactoryAddress,
      DynamicFanNFT: fanNFTAddress,
      PredictionManager: predictionManagerAddress,
    },
    timestamp: new Date().toISOString(),
  };

  // Ensure deployments directory exists
  const deploymentsDir = "deployments";
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  
  const deploymentFilePath = `${deploymentsDir}/${hre.network.name}.json`;
  fs.writeFileSync(
    deploymentFilePath,
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("\nDeployment info saved to " + deploymentFilePath);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

