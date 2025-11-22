const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const [admin] = await hre.ethers.getSigners();
  console.log("Minting Fan NFT with account:", admin.address);

  // Load deployment info
  const network = hre.network.name;
  const deploymentPath = `deployments/${network}.json`;
  
  if (!fs.existsSync(deploymentPath)) {
    console.error("Deployment file not found. Please deploy contracts first.");
    process.exit(1);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const fanNFTAddress = deployment.contracts.DynamicFanNFT;

  const DynamicFanNFT = await hre.ethers.getContractFactory("DynamicFanNFT");
  const fanNFT = DynamicFanNFT.attach(fanNFTAddress);

  // Get user address and team name from command line
  const userAddress = process.argv[2];
  const teamName = process.argv[3] || "My Team";

  if (!userAddress) {
    console.error("Usage: npx hardhat run scripts/mintFanNFT.js --network spicy <userAddress> [teamName]");
    console.error("Example: npx hardhat run scripts/mintFanNFT.js --network spicy 0x123... \"Lakers\"");
    process.exit(1);
  }

  console.log(`\nMinting Fan NFT for ${userAddress} with team: ${teamName}`);

  const tx = await fanNFT.mintFanNFT(userAddress, teamName);
  console.log("Transaction hash:", tx.hash);
  const receipt = await tx.wait();
  
  // Find the FanNFTMinted event
  const event = receipt.logs.find(log => {
    try {
      const parsed = fanNFT.interface.parseLog(log);
      return parsed.name === "FanNFTMinted";
    } catch (e) {
      return false;
    }
  });

  if (event) {
    const parsed = fanNFT.interface.parseLog(event);
    console.log("Fan NFT minted with token ID:", parsed.args.tokenId.toString());
  } else {
    console.log("Fan NFT minted! Check the contract for the token ID.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

