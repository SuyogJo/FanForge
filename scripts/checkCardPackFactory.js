const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Checking CardPackFactory with account:", deployer.address);

  // Load deployment info
  const network = hre.network.name;
  const deploymentPath = `deployments/${network}.json`;
  
  if (!fs.existsSync(deploymentPath)) {
    console.error("Deployment file not found.");
    process.exit(1);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const cardPackFactoryAddress = deployment.contracts.CardPackFactory;

  const CardPackFactory = await hre.ethers.getContractFactory("CardPackFactory");
  const cardPackFactory = CardPackFactory.attach(cardPackFactoryAddress);

  console.log("\n=== CardPackFactory State ===");
  console.log("Address:", cardPackFactoryAddress);
  
  const cardCount = await cardPackFactory.cardCount();
  console.log("Card Count:", cardCount.toString());
  
  const packPrice = await cardPackFactory.packPrice();
  console.log("Pack Price:", hre.ethers.formatEther(packPrice), "CHZ");
  
  // Check each card
  console.log("\n=== Cards ===");
  for (let i = 1; i <= cardCount; i++) {
    try {
      const card = await cardPackFactory.getCard(i);
      // Handle BigInt cardType
      let cardTypeValue = card.cardType;
      if (typeof card.cardType === 'bigint') {
        cardTypeValue = card.cardType.toString();
      } else if (card.cardType && typeof card.cardType === 'object' && 'toString' in card.cardType) {
        cardTypeValue = card.cardType.toString();
      }
      const cardType = (cardTypeValue === "0" || cardTypeValue === 0 || Number(cardTypeValue) === 0) ? "Player" : "MatchEvent";
      console.log(`Card ${i}: ${card.name} (Type: ${cardType}, Rarity: ${card.rarity})`);
    } catch (e) {
      console.log(`Card ${i}: Error - ${e.message}`);
    }
  }
  
  // Check user's nonce
  const userAddress = process.env.USER_ADDRESS || deployer.address;
  const userNonce = await cardPackFactory.userPackNonce(userAddress);
  console.log(`\nUser ${userAddress} pack nonce: ${userNonce.toString()}`);
  
  // Try to simulate opening a pack
  console.log("\n=== Testing Pack Opening ===");
  try {
    await cardPackFactory.openPack.staticCall({ value: packPrice });
    console.log("✓ Static call succeeded - pack opening should work");
  } catch (e) {
    console.log("✗ Static call failed:", e.message || e.reason || "Unknown error");
    if (e.data) {
      try {
        const decoded = cardPackFactory.interface.parseError(e.data);
        console.log("  Decoded error:", decoded?.name || "Unknown");
      } catch (decodeErr) {
        console.log("  Could not decode error data");
      }
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

