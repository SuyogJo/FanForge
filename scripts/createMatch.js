const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const [admin] = await hre.ethers.getSigners();
  console.log("Creating match with account:", admin.address);

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

  // Get match details from environment variables (recommended) or use defaults
  // Since Hardhat doesn't easily pass custom args, use env vars:
  // TEAM_A="Lakers" TEAM_B="Warriors" npx hardhat run scripts/createMatch.js --network spicy
  const teamA = process.env.TEAM_A || "Team A";
  const teamB = process.env.TEAM_B || "Team B";
  const timestamp = process.env.MATCH_TIME ? parseInt(process.env.MATCH_TIME) : Math.floor(Date.now() / 1000) + 3600;
  
  console.log("Note: Using environment variables for team names.");
  console.log("To specify teams, use: TEAM_A=\"Team A\" TEAM_B=\"Team B\" npx hardhat run scripts/createMatch.js --network spicy");

  console.log(`\nCreating match: ${teamA} vs ${teamB}`);

  const tx = await predictionManager.createMatch(teamA, teamB, timestamp);
  console.log("Transaction hash:", tx.hash);
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
    console.log("Match created with ID:", parsed.args.matchId.toString());
  } else {
    console.log("Match created! Check the contract for the match ID.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

