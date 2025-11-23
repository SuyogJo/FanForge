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

  console.log("\nCardPackFactory address:", cardPackFactoryAddress);

  const CardPackFactory = await hre.ethers.getContractFactory("CardPackFactory");
  const cardPackFactory = CardPackFactory.attach(cardPackFactoryAddress);

  // Check pack price
  const packPrice = await cardPackFactory.packPrice();
  console.log("Pack price:", hre.ethers.formatEther(packPrice), "CHZ");

  // Check card count
  const cardCount = await cardPackFactory.cardCount();
  console.log("Card count:", cardCount.toString());

  if (cardCount === 0n) {
    console.log("\n❌ ERROR: No cards initialized! This is the problem.");
    console.log("Cards should be initialized in the constructor, but they're not.");
    return;
  }

  // Check a few cards
  console.log("\nChecking cards:");
  for (let i = 1; i <= Math.min(Number(cardCount), 5); i++) {
    try {
      const card = await cardPackFactory.getCard(i);
      // Handle BigNumber or number for cardType
      const cardTypeValue = typeof card.cardType === 'bigint' ? Number(card.cardType) : card.cardType;
      const cardTypeStr = cardTypeValue === 0 ? "Player" : "MatchEvent";
      console.log(`  Card ${i}: ${card.name} (Type: ${cardTypeStr}, Raw: ${cardTypeValue}, Rarity: ${card.rarity})`);
    } catch (e) {
      console.log(`  Card ${i}: Error - ${e.message}`);
    }
  }

  // Check player and match event card counts
  let playerCount = 0;
  let matchEventCount = 0;
  for (let i = 1; i <= Number(cardCount); i++) {
    try {
      const card = await cardPackFactory.getCard(i);
      // Handle BigNumber or number for cardType
      const cardTypeValue = typeof card.cardType === 'bigint' ? Number(card.cardType) : card.cardType;
      if (cardTypeValue === 0) {
        playerCount++;
      } else {
        matchEventCount++;
      }
    } catch (e) {
      // Skip errors
    }
  }
  console.log(`\nPlayer cards: ${playerCount}`);
  console.log(`Match event cards: ${matchEventCount}`);

  if (playerCount === 0 || matchEventCount === 0) {
    console.log("\n⚠️  WARNING: Missing card types! This could cause pack opening to fail.");
  } else {
    console.log("\n✅ Cards are properly initialized!");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
