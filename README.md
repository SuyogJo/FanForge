# FanForge 🏆

A strategic sports prediction game built on Chiliz Spicy Testnet where users collect player and match event cards, make predictions, and earn dynamic NFTs that level up based on prediction accuracy.

## Features

- **Card Packs**: Open packs to get random player cards (Tom Brady, Mbappé, etc.) or match event cards (Red Card, More Than 4 Goals, etc.)
- **Predictions**: Use your cards to predict real sports match outcomes
- **Dynamic NFTs**: Earn Fan NFTs that level up as you make accurate predictions
- **Rewards**: Higher level NFTs unlock real-world rewards (tickets, swag, meet players)

## Architecture

### Smart Contracts

1. **CardPackFactory.sol** (ERC-1155)
   - Mints player and match event cards
   - RNG-based pack opening
   - Rarity system (1-5, Common to Legendary)

2. **PredictionManager.sol**
   - Manages match creation and predictions
   - Validates card ownership
   - Settles predictions and updates fan stats

3. **DynamicFanNFT.sol** (ERC-721)
   - Tracks fan level and prediction stats
   - Updates metadata URI based on level
   - Levels up every 3 correct predictions

## Setup

### Prerequisites

- Node.js 18+
- npm or yarn
- MetaMask or compatible wallet
- CHZ tokens on Chiliz Spicy Testnet (get from [faucet](https://testnet.chiliscan.com/faucet))

### Installation

1. Clone the repository:
```bash
git clone <repo-url>
cd FanForge
```

2. Install dependencies:
```bash
npm install
cd frontend && npm install && cd ..
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env and add your private key
```

4. Compile contracts:
```bash
npm run compile
```

## Deployment

### Deploy to Chiliz Spicy Testnet

1. Make sure you have CHZ in your wallet on Spicy Testnet
2. Update `hardhat.config.js` with your private key in `.env`
3. Deploy contracts:
```bash
npm run deploy:spicy
```

4. Save the deployed contract addresses and update:
   - `frontend/src/config.js` - Update `CONTRACT_ADDRESSES`
   - Contract addresses will also be saved in `deployments/spicy.json`

### Initial Setup After Deployment

1. **Mint Fan NFTs for users**:
```bash
npx hardhat run scripts/mintFanNFT.js --network spicy <userAddress> "Team Name"
```

2. **Create matches**:
```bash
npx hardhat run scripts/createMatch.js --network spicy "Team A" "Team B"
```

3. **Settle matches** (after match ends):
```bash
npx hardhat run scripts/settleMatch.js --network spicy <matchId> true false false false false false false false "Team A"
```

## Frontend

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Update contract addresses in `src/config.js`

3. Start development server:
```bash
npm start
```

4. Open [http://localhost:3000](http://localhost:3000)

### Frontend Features

- Connect wallet (automatically switches to Chiliz Spicy Testnet)
- Open card packs (costs 0.01 CHZ)
- View your card collection
- Submit predictions using your cards
- View your Fan NFT level and stats
- View available matches

## Usage Flow

1. **Connect Wallet**: Click "Connect Wallet" and approve network switch
2. **Get Fan NFT**: Admin mints a Fan NFT for you (or use mint script)
3. **Open Packs**: Purchase and open card packs to collect cards
4. **View Matches**: See available pending matches
5. **Submit Prediction**: Select a match and cards, then submit
6. **Wait for Settlement**: Admin settles the match with results
7. **Level Up**: Your Fan NFT automatically levels up if predictions are correct

## Admin Scripts

### Create Match
```bash
npx hardhat run scripts/createMatch.js --network spicy "Lakers" "Warriors"
```

### Settle Match
```bash
# Arguments: matchId redCard moreThan4Goals fightBreaksOut moreThan4SlapShots touchdownPass40Plus hatTrick overtime penaltyKick winningTeam
npx hardhat run scripts/settleMatch.js --network spicy 1 true false false false false false false false "Lakers"
```

### Mint Fan NFT
```bash
npx hardhat run scripts/mintFanNFT.js --network spicy 0x... "Lakers"
```

## Contract Addresses

After deployment, update these in `frontend/src/config.js`:

- CardPackFactory: `0x...`
- PredictionManager: `0x...`
- DynamicFanNFT: `0x...`

## NFT Metadata

NFT metadata files are stored in `public/metadata/`:
- `1.json` - Level 1 (Rookie Fan)
- `2.json` - Level 2 (Rising Fan)
- `3.json` - Level 3 (Proven Fan)
- `4.json` - Level 4 (Elite Fan)
- `5.json` - Level 5 (Legendary Fan)

Update the `baseURI` in `DynamicFanNFT.sol` to point to your hosted metadata.

## Testing

Run tests (when implemented):
```bash
npm test
```

## Network Configuration

The project is configured for **Chiliz Spicy Testnet**:
- Chain ID: 88882
- RPC URL: https://spicy-rpc.chiliz.com
- Explorer: https://testnet.chiliscan.com
- Currency: CHZ

## Future Enhancements

- [ ] Chainlink VRF for true randomness
- [ ] Real sports API integration
- [ ] Card marketplace
- [ ] Staking rewards
- [ ] Team-based competitions
- [ ] Governance tokens
- [ ] Cross-chain support

## License

MIT

## Support

For issues or questions, please open an issue on GitHub.
