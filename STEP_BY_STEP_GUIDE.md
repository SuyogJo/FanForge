# FanForge - Complete Step-by-Step Guide

## 📋 Prerequisites

Before starting, make sure you have:
- ✅ Node.js 18+ installed (`node --version`)
- ✅ npm or yarn installed
- ✅ MetaMask browser extension
- ✅ A wallet with some CHZ tokens on Chiliz Spicy Testnet
  - Get testnet CHZ from: https://testnet.chiliscan.com/faucet

---

## Step 1: Install Dependencies

### 1.1 Install Root Dependencies
```bash
cd /Users/suyog/Desktop/FanForge
npm install
```

This installs:
- Hardhat
- OpenZeppelin contracts
- Ethers.js
- Other development dependencies

### 1.2 Install Frontend Dependencies
```bash
cd frontend
npm install
cd ..
```

This installs:
- React
- React Scripts
- Ethers.js for frontend

---

## Step 2: Configure Environment

### 2.1 Create .env File
```bash
# In the root directory
echo "PRIVATE_KEY=your_private_key_here" > .env
```

**Important:** 
- Replace `your_private_key_here` with your actual wallet private key
- Make sure this wallet has CHZ tokens on Chiliz Spicy Testnet
- Never commit this file to git (it's already in .gitignore)

### 2.2 Get Your Private Key
1. Open MetaMask
2. Click the three dots menu → Account Details
3. Click "Export Private Key"
4. Enter your password
5. Copy the private key (starts with `0x`)

---

## Step 3: Compile Smart Contracts

```bash
npm run compile
```

This will:
- Compile all Solidity contracts
- Generate artifacts in the `artifacts/` folder
- Check for compilation errors

**Expected output:** "Compiled X Solidity files successfully"

---

## Step 4: Deploy Contracts to Chiliz Spicy Testnet

### 4.1 Deploy All Contracts
```bash
npm run deploy:spicy
```

**What happens:**
1. Connects to Chiliz Spicy Testnet
2. Deploys CardPackFactory contract
3. Deploys DynamicFanNFT contract
4. Deploys PredictionManager contract
5. Links contracts together
6. Saves deployment info to `deployments/spicy.json`

### 4.2 Save Contract Addresses
**IMPORTANT:** Copy the addresses from the output:
```
CardPackFactory: 0x...
DynamicFanNFT: 0x...
PredictionManager: 0x...
```

You'll need these in the next step!

---

## Step 5: Configure Frontend

### 5.1 Update Contract Addresses
Edit `frontend/src/config.js`:

```javascript
export const CONTRACT_ADDRESSES = {
  CardPackFactory: "0x...", // Paste from deployment output
  PredictionManager: "0x...", // Paste from deployment output
  DynamicFanNFT: "0x..." // Paste from deployment output
};
```

Replace the `0x0000...` placeholders with your actual deployed addresses.

---

## Step 6: Start the Frontend

### 6.1 Start Development Server
```bash
cd frontend
npm start
```

This will:
- Start the React development server
- Open http://localhost:3000 in your browser
- Enable hot-reloading for development

### 6.2 If Browser Doesn't Open Automatically
Manually navigate to: http://localhost:3000

---

## Step 7: Initial Setup (Admin Tasks)

### 7.1 Mint a Fan NFT for Yourself
Open a new terminal (keep frontend running):

```bash
cd /Users/suyog/Desktop/FanForge
npx hardhat run scripts/mintFanNFT.js --network spicy YOUR_WALLET_ADDRESS "Your Team Name"
```

**Example:**
```bash
npx hardhat run scripts/mintFanNFT.js --network spicy 0x1234567890abcdef1234567890abcdef12345678 "Lakers"
```

### 7.2 Create Your First Match
```bash
npx hardhat run scripts/createMatch.js --network spicy "Team A" "Team B"
```

**Example:**
```bash
npx hardhat run scripts/createMatch.js --network spicy "Lakers" "Warriors"
```

This creates match #1. You can create more matches by running it again.

---

## Step 8: Use the Application

### 8.1 Connect Your Wallet
1. Open http://localhost:3000
2. Click "Connect Wallet"
3. MetaMask will prompt you:
   - Approve connection
   - If Chiliz Spicy Testnet isn't added, it will be added automatically
4. Your wallet address should appear

### 8.2 Open a Card Pack
1. Make sure you have at least 0.01 CHZ in your wallet
2. Click "Open Pack" button
3. Confirm the transaction in MetaMask
4. Wait for confirmation
5. Your new card will appear in "My Cards" section

### 8.3 Submit a Prediction
1. Select cards from "My Cards" (click to select/deselect)
2. Choose a match from the dropdown
3. Click "Submit Prediction"
4. Approve card transfer (first time only)
5. Confirm prediction transaction
6. Wait for confirmation

### 8.4 View Your Fan NFT Stats
- Your NFT level, team name, and prediction stats are displayed at the top
- Stats update automatically after predictions are settled

---

## Step 9: Settle a Match (Admin)

After a match ends, settle it with the outcome:

```bash
npx hardhat run scripts/settleMatch.js --network spicy MATCH_ID redCard moreThan4Goals fightBreaksOut moreThan4SlapShots touchdownPass40Plus hatTrick overtime penaltyKick winningTeam
```

**Example - Settle match #1 with "More Than 4 Goals" event:**
```bash
npx hardhat run scripts/settleMatch.js --network spicy 1 false true false false false false false false "Team A"
```

**Arguments explained:**
- `1` = Match ID
- `false` = No red card
- `true` = More than 4 goals occurred
- `false` = No fight
- `false` = No slap shots
- `false` = No touchdown pass
- `false` = No hat trick
- `false` = No overtime
- `false` = No penalty kick
- `"Team A"` = Winning team

**What happens:**
- All predictions for this match are evaluated
- Correct predictions update Fan NFT stats
- NFTs level up automatically (every 3 correct predictions)

---

## Step 10: Verify Everything Works

### Check Your NFT Leveled Up
1. Refresh the frontend page
2. Check your Fan NFT stats at the top
3. If you had 3+ correct predictions, your level should have increased
4. The NFT metadata URI changes based on level

### Check Your Cards
- Cards used in predictions are locked (transferred to PredictionManager)
- You can open more packs to get new cards

---

## 🔧 Troubleshooting

### "Insufficient funds"
- Get CHZ from faucet: https://testnet.chiliscan.com/faucet
- Make sure you're on Chiliz Spicy Testnet

### "Contract not deployed"
- Run `npm run deploy:spicy` again
- Check contract addresses in `frontend/src/config.js`

### "User does not own this card"
- Open a pack first to get cards
- Make sure you're selecting cards you actually own

### "Match does not exist"
- Create a match first using `createMatch.js` script

### "Fan NFT does not exist"
- Mint a Fan NFT first using `mintFanNFT.js` script

### Frontend won't start
- Make sure you're in the `frontend/` directory
- Try deleting `node_modules` and running `npm install` again

### Contracts won't compile
- Check Solidity version compatibility
- Make sure all dependencies are installed

---

## 📝 Quick Reference Commands

```bash
# Install dependencies
npm install && cd frontend && npm install && cd ..

# Compile contracts
npm run compile

# Deploy contracts
npm run deploy:spicy

# Start frontend
cd frontend && npm start

# Create match
npx hardhat run scripts/createMatch.js --network spicy "Team A" "Team B"

# Mint Fan NFT
npx hardhat run scripts/mintFanNFT.js --network spicy ADDRESS "Team Name"

# Settle match
npx hardhat run scripts/settleMatch.js --network spicy 1 false true false false false false false false "Team A"
```

---

## 🎯 Complete Workflow Example

1. **Setup:**
   ```bash
   npm install
   cd frontend && npm install && cd ..
   echo "PRIVATE_KEY=0x..." > .env
   npm run compile
   npm run deploy:spicy
   # Copy addresses to frontend/src/config.js
   ```

2. **Start Frontend:**
   ```bash
   cd frontend && npm start
   ```

3. **Admin Setup (new terminal):**
   ```bash
   npx hardhat run scripts/mintFanNFT.js --network spicy YOUR_ADDRESS "Lakers"
   npx hardhat run scripts/createMatch.js --network spicy "Lakers" "Warriors"
   ```

4. **Use App:**
   - Connect wallet
   - Open pack
   - Submit prediction

5. **Settle Match:**
   ```bash
   npx hardhat run scripts/settleMatch.js --network spicy 1 false true false false false false false false "Lakers"
   ```

6. **Check Results:**
   - Refresh frontend
   - See updated NFT stats

---

## ✅ Success Checklist

- [ ] Dependencies installed
- [ ] .env file created with private key
- [ ] Contracts compiled successfully
- [ ] Contracts deployed to Chiliz Spicy Testnet
- [ ] Contract addresses updated in frontend config
- [ ] Frontend running on http://localhost:3000
- [ ] Wallet connected
- [ ] Fan NFT minted
- [ ] Match created
- [ ] Pack opened
- [ ] Prediction submitted
- [ ] Match settled
- [ ] NFT stats updated

---

You're all set! 🎉 The application should now be running and ready to use.

