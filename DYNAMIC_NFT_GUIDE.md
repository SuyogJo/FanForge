# Dynamic Fan NFT Guide

## 🎫 What is the Dynamic Fan NFT?

The Dynamic Fan NFT is an ERC-721 token that represents your status as a fan in the FanForge ecosystem. Unlike static NFTs, this NFT **dynamically updates** based on your prediction performance!

## 📍 Where is it Used?

### 1. **Frontend Display**
- **Header Section**: Shows basic stats (Level, Team, Correct/Total Predictions)
- **Dedicated NFT Section**: Full display with:
  - NFT name and description
  - Level progress bar
  - Accuracy percentage
  - Token ID
  - Visual representation (if image available)

### 2. **On-Chain Tracking**
- Stored in the `DynamicFanNFT.sol` contract
- Tracks:
  - `level` (1-5, increases every 3 correct predictions)
  - `correctPredictions` (count of accurate predictions)
  - `totalPredictions` (total predictions made)
  - `teamName` (your supported team)

### 3. **Automatic Updates**
- Updates automatically when predictions are settled
- Called by `PredictionManager` after match settlement
- Metadata URI changes based on level (e.g., `/1.json` → `/2.json`)

## 🔄 How It Works

### Leveling System
```
Level 1: 0-2 correct predictions (Rookie Fan)
Level 2: 3-5 correct predictions (Rising Fan)
Level 3: 6-8 correct predictions (Proven Fan)
Level 4: 9-11 correct predictions (Elite Fan)
Level 5: 12+ correct predictions (Legendary Fan)
```

**Formula**: `level = (correctPredictions / 3) + 1`

### Update Flow
1. User submits prediction with cards
2. Admin settles match with outcome
3. `PredictionManager.settleMatch()` is called
4. For each prediction:
   - Checks if prediction matches outcome
   - Calls `fanNFT.updateFanStats(user, isCorrect)`
5. If correct:
   - `correctPredictions++`
   - `totalPredictions++`
   - If `correctPredictions % 3 == 0`: Level up!
   - Updates `tokenURI` to new level metadata

## 🎯 Current Implementation

### Contract: `DynamicFanNFT.sol`
- **Standard**: ERC-721
- **Location**: `contracts/DynamicFanNFT.sol`
- **Functions**:
  - `mintFanNFT(address, string teamName)` - Admin only
  - `updateFanStats(address, bool isCorrect)` - Called by PredictionManager
  - `getFanStats(address)` - View stats
  - `tokenURI(uint256)` - Returns metadata URI based on level

### Frontend: `App.js`
- **Display Location**: After "Submit Prediction" section
- **Shows**:
  - NFT name and description
  - Current level (1-5)
  - Team name
  - Prediction stats
  - Level progress bar
  - Token ID

### Metadata Files
- **Location**: `public/metadata/`
- **Files**: `1.json`, `2.json`, `3.json`, `4.json`, `5.json`
- **Structure**: Standard NFT metadata format with name, description, image, attributes

## 🚀 How to Use

### 1. Mint Your Fan NFT (Admin)
```bash
npx hardhat run scripts/mintFanNFT.js --network spicy YOUR_ADDRESS "Your Team Name"
```

### 2. View Your NFT
- Connect wallet in frontend
- Your NFT stats appear in the header
- Full NFT display appears in the "Your Dynamic Fan NFT" section

### 3. Level Up
- Make predictions using your cards
- Get predictions correct
- NFT automatically levels up every 3 correct predictions
- Refresh frontend to see updated level

## 📊 Example Flow

1. **Initial State**: Level 1, 0 correct predictions
2. **Make 3 Correct Predictions**: 
   - Prediction 1: Correct → `correctPredictions = 1`
   - Prediction 2: Correct → `correctPredictions = 2`
   - Prediction 3: Correct → `correctPredictions = 3` → **Level Up to 2!**
3. **Metadata Updates**: `tokenURI` changes from `/1.json` to `/2.json`
4. **Frontend Updates**: Shows new level, updated description

## 🎁 Future Rewards (Not Yet Implemented)

Based on level, users could unlock:
- **Level 2**: Digital badge
- **Level 3**: Team merchandise discount
- **Level 4**: Game tickets
- **Level 5**: Meet & greet with players

## 🔍 Technical Details

### Token URI Structure
```
Base URI: https://fanforge.com/api/nft
Level 1: https://fanforge.com/api/nft/1.json
Level 2: https://fanforge.com/api/nft/2.json
...
```

### Events Emitted
- `FanNFTMinted(address fan, uint256 tokenId, string teamName)`
- `NFTLevelUp(uint256 tokenId, uint256 newLevel, address fan)`

### Access Control
- Only `PredictionManager` can call `updateFanStats()`
- Only contract owner can mint new NFTs
- Users can view their own stats via `getFanStats()`

## 🐛 Troubleshooting

**NFT not showing?**
- Make sure you've minted a Fan NFT using the admin script
- Check that you're connected to the correct network
- Verify contract addresses in `frontend/src/config.js`

**Level not updating?**
- Ensure predictions are being settled correctly
- Check that `PredictionManager` is set in `DynamicFanNFT`
- Verify predictions are actually correct

**Metadata not loading?**
- Check `public/metadata/` folder exists
- Verify metadata JSON files are valid
- Check browser console for fetch errors

