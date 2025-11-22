const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const [admin] = await hre.ethers.getSigners();
  console.log("Settling match with account:", admin.address);

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

  // Get match ID from command line args
  const matchId = process.argv[2];
  if (!matchId) {
    console.error("Usage: npx hardhat run scripts/settleMatch.js --network spicy <matchId>");
    console.error("Example: npx hardhat run scripts/settleMatch.js --network spicy 1");
    process.exit(1);
  }

  // Example outcome - modify as needed
  // Struct parameters need to be passed as an array in ethers.js
  const outcome = [
    process.argv[3] === "true" || false, // redCard
    process.argv[4] === "true" || false, // moreThan4Goals
    process.argv[5] === "true" || false, // fightBreaksOut
    process.argv[6] === "true" || false, // moreThan4SlapShots
    process.argv[7] === "true" || false, // touchdownPass40Plus
    process.argv[8] === "true" || false, // hatTrick
    process.argv[9] === "true" || false, // overtime
    process.argv[10] === "true" || false, // penaltyKick
    process.argv[11] || "Team A" // winningTeam
  ];

  console.log("\nSettling match", matchId, "with outcome:");
  console.log("  Red Card:", outcome[0]);
  console.log("  More Than 4 Goals:", outcome[1]);
  console.log("  Fight Breaks Out:", outcome[2]);
  console.log("  More Than 4 Slap Shots:", outcome[3]);
  console.log("  Touchdown Pass 40+:", outcome[4]);
  console.log("  Hat Trick:", outcome[5]);
  console.log("  Overtime:", outcome[6]);
  console.log("  Penalty Kick:", outcome[7]);
  console.log("  Winning Team:", outcome[8]);

  const tx = await predictionManager.settleMatch(matchId, outcome);
  console.log("Transaction hash:", tx.hash);
  await tx.wait();
  console.log("Match settled successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

