# How to Create Matches

## Recommended: Use Environment Variables

Since Hardhat doesn't easily pass custom arguments, use environment variables:

```bash
TEAM_A="Lakers" TEAM_B="Warriors" npx hardhat run scripts/createMatch.js --network spicy
TEAM_A="Barcelona" TEAM_B="Real Madrid" npx hardhat run scripts/createMatch.js --network spicy
TEAM_A="Patriots" TEAM_B="Chiefs" npx hardhat run scripts/createMatch.js --network spicy
TEAM_A="PSG" TEAM_B="Manchester City" npx hardhat run scripts/createMatch.js --network spicy
```

## Quick Helper Script

For easier usage, you can create matches using a simple script (if you have bash):

```bash
chmod +x scripts/createMatches.sh
./scripts/createMatches.sh "Lakers" "Warriors"
```

## Default Behavior

If you don't specify team names, it will create a match with "Team A" vs "Team B":

```bash
npx hardhat run scripts/createMatch.js --network spicy
```

