# FanForge Quick Start Guide

## 🚀 Quick Setup (5 minutes)

### 1. Install Dependencies
```bash
npm install
cd frontend && npm install && cd ..
```

### 2. Configure Environment
```bash
# Create .env file
echo "PRIVATE_KEY=your_private_key_here" > .env
```

### 3. Compile Contracts
```bash
npm run compile
```

### 4. Deploy to Chiliz Spicy Testnet
```bash
npm run deploy:spicy
```

**Save the contract addresses from the output!**

### 5. Update Frontend Config
Edit `frontend/src/config.js` and update the contract addresses:
```javascript
export const CONTRACT_ADDRESSES = {
  CardPackFactory: "0x...", // From deployment output
  PredictionManager: "0x...", // From deployment output
  DynamicFanNFT: "0x..." // From deployment output
};
```

### 6. Start Frontend
```bash
cd frontend
npm start
```

Visit http://localhost:3000

## 🎮 First Steps

### As Admin:

1. **Mint a Fan NFT for yourself:**
```bash
npx hardhat run scripts/mintFanNFT.js --network spicy YOUR_ADDRESS "Your Team"
```

2. **Create a match:**
```bash
npx hardhat run scripts/createMatch.js --network spicy "Lakers" "Warriors"
```

### As User:

1. Connect your wallet (MetaMask)
2. Open a card pack (costs 0.01 CHZ)
3. View your cards
4. Submit a prediction using your cards
5. Wait for admin to settle the match
6. Watch your NFT level up!

## 📝 Common Commands

### Create Match
```bash
npx hardhat run scripts/createMatch.js --network spicy "Team A" "Team B"
```

### Settle Match
```bash
# Format: matchId redCard moreThan4Goals fightBreaksOut moreThan4SlapShots touchdownPass40Plus hatTrick overtime penaltyKick winningTeam
npx hardhat run scripts/settleMatch.js --network spicy 1 true false false false false false false false "Team A"
```

### Mint Fan NFT
```bash
npx hardhat run scripts/mintFanNFT.js --network spicy USER_ADDRESS "Team Name"
```

## 🔧 Troubleshooting

### "Insufficient funds"
- Get CHZ from [Chiliz Spicy Faucet](https://testnet.chiliscan.com/faucet)

### "Contract not deployed"
- Make sure you've run `npm run deploy:spicy`
- Check contract addresses in `frontend/src/config.js`

### "Network not found"
- Add Chiliz Spicy Testnet to MetaMask:
  - Chain ID: 88882
  - RPC: https://spicy-rpc.chiliz.com
  - Explorer: https://testnet.chiliscan.com

### "User does not own this card"
- Make sure you've opened at least one pack
- Check that you're using the correct card IDs

## 📚 Next Steps

- Read the full [README.md](README.md) for detailed documentation
- Customize NFT metadata in `public/metadata/`
- Add more card types in `CardPackFactory.sol`
- Integrate real sports APIs
- Deploy to mainnet when ready!

