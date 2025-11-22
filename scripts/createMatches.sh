#!/bin/bash

# Helper script to create matches easily
# Usage: ./scripts/createMatches.sh "Team A" "Team B"

if [ -z "$1" ] || [ -z "$2" ]; then
  echo "Usage: ./scripts/createMatches.sh \"Team A\" \"Team B\""
  echo "Example: ./scripts/createMatches.sh \"Lakers\" \"Warriors\""
  exit 1
fi

TEAM_A="$1"
TEAM_B="$2"

echo "Creating match: $TEAM_A vs $TEAM_B"

npx hardhat run scripts/createMatch.js --network spicy <<EOF
$TEAM_A
$TEAM_B
EOF

