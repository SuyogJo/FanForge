const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const [admin] = await hre.ethers.getSigners();
  console.log("Creating fresh matches with account:", admin.address);

  // Load deployment info
  const network = hre.network.name;
  const deploymentPath = `deployments/${network}.json`;
  
  if (!fs.existsSync(deploymentPath)) {
    console.error("Deployment file not found. Please deploy contracts first.");
    process.exit(1);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const predictionManagerAddress = deployment.contracts.PredictionManager;

  const PredictionManager = await hre.ethers.getContractFactory("PredictionManager");
  const predictionManager = PredictionManager.attach(predictionManagerAddress);

  // Create 4 fresh matches
  const matches = [
    { teamA: "Lakers", teamB: "Warriors" },
    { teamA: "Barcelona", teamB: "Real Madrid" },
    { teamA: "Patriots", teamB: "Chiefs" },
    { teamA: "PSG", teamB: "Manchester City" }
  ];

  const timestamp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

  console.log("\nCreating fresh matches...\n");

  for (const match of matches) {
    try {
      const tx = await predictionManager.createMatch(match.teamA, match.teamB, timestamp);
      console.log(`Creating: ${match.teamA} vs ${match.teamB}...`);
      const receipt = await tx.wait();
      
      // Find the MatchCreated event
      const event = receipt.logs.find(log => {
        try {
          const parsed = predictionManager.interface.parseLog(log);
          return parsed.name === "MatchCreated";
        } catch (e) {
          return false;
        }
      });

      if (event) {
        const parsed = predictionManager.interface.parseLog(event);
        console.log(`✓ Match created with ID: ${parsed.args.matchId.toString()}`);
      } else {
        console.log(`✓ Match created (check contract for ID)`);
      }
    } catch (error) {
      console.error(`✗ Failed to create ${match.teamA} vs ${match.teamB}:`, error.message);
    }
  }

  console.log("\n✅ Done! Refresh your frontend to see the new matches.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

