import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import './App.css';
import { CONTRACT_ADDRESSES, NETWORK_CONFIG } from './config';

// Import contract ABIs (these would be generated from compilation)
// For now, we'll use minimal interfaces
const CARD_PACK_FACTORY_ABI = [
  "function openPack() payable",
  "function balanceOf(address, uint256) view returns (uint256)",
  "function uri(uint256) view returns (string)",
  "function getCard(uint256) view returns (tuple(uint8 cardType, string name, string description, uint256 rarity))",
  "function setApprovalForAll(address operator, bool approved)",
  "function isApprovedForAll(address owner, address operator) view returns (bool)",
  "event PackOpened(address indexed user, uint256 indexed cardId, uint8 cardType, string name, uint256 rarity)"
];

const PREDICTION_MANAGER_ABI = [
  "function submitPrediction(uint256 matchId, uint256[] memory cardIds) returns (uint256)",
  "function matches(uint256) view returns (uint256 matchId, string teamA, string teamB, uint256 timestamp, uint8 status, tuple(bool redCard, bool moreThan4Goals, bool fightBreaksOut, bool moreThan4SlapShots, bool touchdownPass40Plus, bool hatTrick, bool overtime, bool penaltyKick, string winningTeam) outcome)",
  "function matchCount() view returns (uint256)",
  "function getUserPredictions(address) view returns (uint256[])",
  "event PredictionSubmitted(uint256 indexed predictionId, address indexed user, uint256 indexed matchId, uint256[] cardIds)"
];

const FAN_NFT_ABI = [
  "function getFanStats(address) view returns (tuple(uint256 level, uint256 correctPredictions, uint256 totalPredictions, string teamName))",
  "function tokenURI(uint256) view returns (string)",
  "function userToTokenId(address) view returns (uint256)"
];

function App() {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState(null);
  const [cards, setCards] = useState([]);
  const [matches, setMatches] = useState([]);
  const [selectedCards, setSelectedCards] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState("");
  const [fanStats, setFanStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Hardcoded matches for testing
  const hardcodedMatches = [
    { id: 1, teamA: "Lakers", teamB: "Warriors", status: "Pending" },
    { id: 2, teamA: "Barcelona", teamB: "Real Madrid", status: "Pending" },
    { id: 3, teamA: "Patriots", teamB: "Chiefs", status: "Pending" },
    { id: 4, teamA: "PSG", teamB: "Manchester City", status: "Pending" }
  ];

  // Connect wallet
  const connectWallet = async () => {
    try {
      if (window.ethereum) {
        const chainId = NETWORK_CONFIG.chainId;
        
        // First, request account access
        const provider = new ethers.BrowserProvider(window.ethereum);
        await provider.send("eth_requestAccounts", []);
        
        // Check current chain
        const currentChainId = await window.ethereum.request({
          method: 'eth_chainId'
        });
        
        // If already on the correct chain, proceed
        if (currentChainId.toLowerCase() === chainId.toLowerCase()) {
          const signer = await provider.getSigner();
          const address = await signer.getAddress();
          
          setProvider(provider);
          setSigner(signer);
          setAccount(address);
          
          // Load user data
          loadUserData(signer, address);
          return;
        }
        
        // Try to switch to Chiliz Spicy Testnet
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: chainId }],
          });
          
          // After switching, get signer and connect
          const signer = await provider.getSigner();
          const address = await signer.getAddress();
          
          setProvider(provider);
          setSigner(signer);
          setAccount(address);
          
          // Load user data
          loadUserData(signer, address);
        } catch (switchError) {
          // This error code indicates that the chain has not been added to MetaMask
          if (switchError.code === 4902 || switchError.code === -32603) {
            try {
              // Add the chain with proper format
              await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                  chainId: chainId,
                  chainName: NETWORK_CONFIG.chainName,
                  nativeCurrency: NETWORK_CONFIG.nativeCurrency,
                  rpcUrls: NETWORK_CONFIG.rpcUrls,
                  blockExplorerUrls: NETWORK_CONFIG.blockExplorerUrls
                }],
              });
              
              // After adding, get signer and connect
              const signer = await provider.getSigner();
              const address = await signer.getAddress();
              
              setProvider(provider);
              setSigner(signer);
              setAccount(address);
              
              // Load user data
              loadUserData(signer, address);
            } catch (addError) {
              console.error("Add chain error:", addError);
              setError(
                `Failed to add network automatically. Please add Chiliz Spicy Testnet manually:\n\n` +
                `1. Open MetaMask → Network dropdown → Add Network\n` +
                `2. Enter:\n` +
                `   - Network Name: Chiliz Spicy Testnet\n` +
                `   - RPC URL: https://spicy-rpc.chiliz.com\n` +
                `   - Chain ID: 88882\n` +
                `   - Currency: CHZ\n` +
                `   - Explorer: https://testnet.chiliscan.com\n` +
                `3. Save and try connecting again.\n\n` +
                `Error: ${addError.message}`
              );
              return;
            }
          } else {
            console.error("Switch chain error:", switchError);
            setError(
              `Network switch failed. Please manually switch to Chiliz Spicy Testnet in MetaMask.\n\n` +
              `If the network isn't added, add it with:\n` +
              `- Network Name: Chiliz Spicy Testnet\n` +
              `- RPC URL: https://spicy-rpc.chiliz.com\n` +
              `- Chain ID: 88882\n\n` +
              `Error: ${switchError.message}`
            );
            return;
          }
        }
      } else {
        setError("Please install MetaMask or a compatible wallet");
      }
    } catch (err) {
      console.error("Connection error:", err);
      setError(err.message);
    }
  };

  // Load user's cards and stats
  const loadUserData = async (signer, address) => {
    try {
      setLoading(true);
      
      // Load cards
      const cardPackFactory = new ethers.Contract(
        CONTRACT_ADDRESSES.CardPackFactory,
        CARD_PACK_FACTORY_ABI,
        signer
      );
      
      // Get all cards user owns - check up to 30 card IDs to be safe
      const userCards = [];
      for (let i = 1; i <= 30; i++) {
        try {
          const balance = await cardPackFactory.balanceOf(address, i);
          if (balance > 0) {
            try {
              const card = await cardPackFactory.getCard(i);
              userCards.push({
                id: i,
                name: card.name,
                type: card.cardType === 0 ? "Player" : "MatchEvent",
                rarity: card.rarity.toString(),
                balance: balance.toString()
              });
            } catch (cardErr) {
              console.warn(`Card ${i} exists but getCard() failed:`, cardErr);
              // Still add it with basic info
              userCards.push({
                id: i,
                name: `Card #${i}`,
                type: "Unknown",
                rarity: "1",
                balance: balance.toString()
              });
            }
          }
        } catch (e) {
          // Card doesn't exist, skip
        }
      }
      console.log(`Loaded ${userCards.length} cards for user`);
      setCards(userCards);
      
      // Load matches
      const predictionManager = new ethers.Contract(
        CONTRACT_ADDRESSES.PredictionManager,
        PREDICTION_MANAGER_ABI,
        signer
      );
      
      const matchCount = await predictionManager.matchCount();
      const matchList = [];
      for (let i = 1; i <= matchCount; i++) {
        try {
          const match = await predictionManager.matches(i);
          // Status is returned as uint8 (0 = Pending, 1 = Settled)
          // The match struct returns: [matchId, teamA, teamB, timestamp, status, outcome]
          // Status is at index 4
          let statusNum;
          if (Array.isArray(match)) {
            // If returned as array, status is at index 4
            statusNum = match[4];
          } else {
            // If returned as object, access .status
            statusNum = match.status;
          }
          
          // Convert to number if it's a BigNumber or other format
          if (typeof statusNum === 'object' && statusNum.toString) {
            statusNum = parseInt(statusNum.toString());
          } else {
            statusNum = parseInt(statusNum);
          }
          
          console.log(`Match ${i}: ${match.teamA} vs ${match.teamB}, Status: ${statusNum} (${statusNum === 0 ? 'Pending' : 'Settled'})`);
          
          matchList.push({
            id: i,
            teamA: match.teamA,
            teamB: match.teamB,
            timestamp: match.timestamp?.toString() || (Array.isArray(match) ? match[3].toString() : "0"),
            status: statusNum === 0 ? "Pending" : "Settled",
            statusNum: statusNum
          });
        } catch (e) {
          console.error(`Error loading match ${i}:`, e);
          // Match doesn't exist
        }
      }
      console.log("Loaded matches:", matchList);
      setMatches(matchList);
      
      // Load fan stats
      const fanNFT = new ethers.Contract(
        CONTRACT_ADDRESSES.DynamicFanNFT,
        FAN_NFT_ABI,
        signer
      );
      
      try {
        const stats = await fanNFT.getFanStats(address);
        setFanStats({
          level: stats.level.toString(),
          correctPredictions: stats.correctPredictions.toString(),
          totalPredictions: stats.totalPredictions.toString(),
          teamName: stats.teamName
        });
      } catch (e) {
        // User doesn't have NFT yet
        setFanStats(null);
      }
      
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  // Open a card pack
  const openPack = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const cardPackFactory = new ethers.Contract(
        CONTRACT_ADDRESSES.CardPackFactory,
        CARD_PACK_FACTORY_ABI,
        signer
      );
      
      const packPrice = ethers.parseEther("0.01");
      const tx = await cardPackFactory.openPack({ value: packPrice });
      await tx.wait();
      
      setSuccess("Pack opened! Check your cards.");
      await loadUserData(signer, account);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  // Submit prediction
  const submitPrediction = async () => {
    try {
      if (!selectedMatch || selectedCards.length === 0) {
        setError("Please select a match and at least one card");
        return;
      }
      
      setLoading(true);
      setError(null);
      
      // Check and set approval if needed
      const cardPackFactory = new ethers.Contract(
        CONTRACT_ADDRESSES.CardPackFactory,
        CARD_PACK_FACTORY_ABI,
        signer
      );
      
      const predictionManager = new ethers.Contract(
        CONTRACT_ADDRESSES.PredictionManager,
        PREDICTION_MANAGER_ABI,
        signer
      );
      
      // Validate match exists
      try {
        const match = await predictionManager.matches(selectedMatch);
        
        // Handle match struct - could be array or object
        let matchId, statusNum;
        if (Array.isArray(match)) {
          matchId = match[0];
          statusNum = match[4];
        } else {
          matchId = match.matchId;
          statusNum = match.status;
        }
        
        if (matchId.toString() === "0") {
          setError(`Match ${selectedMatch} does not exist on-chain. Please create the match first using the admin script.`);
          setLoading(false);
          return;
        }
        
        // Convert status to number
        if (typeof statusNum === 'object' && statusNum.toString) {
          statusNum = parseInt(statusNum.toString());
        } else {
          statusNum = parseInt(statusNum);
        }
        
        console.log(`Validating match ${selectedMatch}: status = ${statusNum}`);
        
        if (statusNum !== 0) {
          setError("This match has already been settled. Please select a pending match.");
          setLoading(false);
          return;
        }
      } catch (matchErr) {
        console.error("Match validation error:", matchErr);
        setError(`Match ${selectedMatch} does not exist. Please create the match first.`);
        setLoading(false);
        return;
      }
      
      // Validate user owns all selected cards
      console.log("Validating card ownership for cards:", selectedCards);
      for (const cardId of selectedCards) {
        try {
          // Check if card exists by trying to get card info
          let cardExists = false;
          try {
            const card = await cardPackFactory.getCard(cardId);
            cardExists = true;
            console.log(`Card ${cardId} exists: ${card.name}`);
          } catch (e) {
            console.error(`Card ${cardId} does not exist:`, e);
            setError(`Card ID ${cardId} does not exist. Please select valid cards from your collection.`);
            setLoading(false);
            return;
          }
          
          if (!cardExists) {
            setError(`Card ID ${cardId} does not exist. Please select valid cards.`);
            setLoading(false);
            return;
          }
          
          // Check balance
          const balance = await cardPackFactory.balanceOf(account, cardId);
          console.log(`Card ${cardId} balance: ${balance.toString()}`);
          
          if (balance.toString() === "0" || balance.toString() === "0x0") {
            setError(`You don't own card ID ${cardId}. Please select cards you own from your collection.`);
            setLoading(false);
            return;
          }
        } catch (cardErr) {
          console.error(`Error checking card ${cardId}:`, cardErr);
          setError(`Error validating card ID ${cardId}: ${cardErr.message}. Please refresh and try again.`);
          setLoading(false);
          return;
        }
      }
      
      console.log("All cards validated successfully");
      
      // Check and set approval
      const predictionManagerAddress = CONTRACT_ADDRESSES.PredictionManager;
      console.log("Checking approval for:", predictionManagerAddress);
      
      const isApproved = await cardPackFactory.isApprovedForAll(
        account,
        predictionManagerAddress
      );
      
      console.log("Is approved:", isApproved);
      
      if (!isApproved) {
        setSuccess("Approving cards for prediction...");
        console.log("Requesting approval...");
        const approveTx = await cardPackFactory.setApprovalForAll(
          predictionManagerAddress,
          true
        );
        console.log("Approval transaction sent:", approveTx.hash);
        const approveReceipt = await approveTx.wait();
        console.log("Approval confirmed:", approveReceipt.transactionHash);
        
        // Double-check approval was set
        const isApprovedNow = await cardPackFactory.isApprovedForAll(
          account,
          predictionManagerAddress
        );
        console.log("Approval confirmed, isApproved:", isApprovedNow);
        
        if (!isApprovedNow) {
          setError("Approval failed. Please try again.");
          setLoading(false);
          return;
        }
      }
      
      console.log(`Submitting prediction: Match ${selectedMatch}, Cards: [${selectedCards.join(", ")}]`);
      
      // Convert card IDs to numbers if they're strings
      const cardIds = selectedCards.map(id => typeof id === 'string' ? parseInt(id) : id);
      
      const tx = await predictionManager.submitPrediction(
        parseInt(selectedMatch),
        cardIds
      );
      
      console.log("Transaction sent, waiting for confirmation...");
      const receipt = await tx.wait();
      console.log("Transaction confirmed:", receipt.transactionHash);
      
      setSuccess("Prediction submitted!");
      setSelectedCards([]);
      setSelectedMatch("");
      await loadUserData(signer, account);
      setLoading(false);
    } catch (err) {
      console.error("Prediction error:", err);
      let errorMsg = err.message;
      
      // Try to decode common errors
      if (err.data) {
        if (err.data.includes("0x57f447ce") || err.reason?.includes("execution reverted")) {
          errorMsg = "Transaction failed. Possible reasons:\n" +
            "1. Match doesn't exist on-chain (create it first)\n" +
            "2. You don't own the selected cards\n" +
            "3. Cards are already locked in another prediction\n" +
            "4. Match is already settled";
        }
      }
      
      if (err.reason) {
        errorMsg = err.reason;
      }
      
      setError(errorMsg);
      setLoading(false);
    }
  };

  // Toggle card selection
  const toggleCard = (cardId) => {
    if (selectedCards.includes(cardId)) {
      setSelectedCards(selectedCards.filter(id => id !== cardId));
    } else {
      setSelectedCards([...selectedCards, cardId]);
    }
  };

  useEffect(() => {
    if (account && signer) {
      loadUserData(signer, account);
    }
  }, [account]);

  return (
    <div className="App">
      <div className="container">
        <header className="card">
          <h1>🏆 FanForge</h1>
          <p>Strategic Sports Prediction Game</p>
          
          {!account ? (
            <button onClick={connectWallet}>Connect Wallet</button>
          ) : (
            <div>
              <span className="status connected">Connected: {account.slice(0, 6)}...{account.slice(-4)}</span>
              {fanStats && (
                <div style={{ marginTop: "16px" }}>
                  <h3>Your Fan NFT</h3>
                  <p>Level: {fanStats.level} | Team: {fanStats.teamName}</p>
                  <p>Correct Predictions: {fanStats.correctPredictions} / {fanStats.totalPredictions}</p>
                </div>
              )}
            </div>
          )}
        </header>

        {error && <div className="error">{error}</div>}
        {success && <div className="success">{success}</div>}

        {account && (
          <>
            {/* Open Pack Section */}
            <div className="card">
              <h2>Open Card Pack</h2>
              <p>Cost: 0.01 CHZ</p>
              <button onClick={openPack} disabled={loading}>
                {loading ? "Opening..." : "Open Pack"}
              </button>
            </div>

            {/* My Cards Section */}
            <div className="card">
              <h2>My Cards ({cards.length})</h2>
              {cards.length === 0 ? (
                <p>No cards yet. Open a pack to get started!</p>
              ) : (
                <div className="grid">
                  {cards.map(card => (
                    <div
                      key={card.id}
                      className={`card-item rarity-${card.rarity} ${selectedCards.includes(card.id) ? 'selected' : ''}`}
                      onClick={() => toggleCard(card.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <h3>{card.name}</h3>
                      <p>{card.type}</p>
                      <p>Rarity: {card.rarity}</p>
                      <p>Owned: {card.balance}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Submit Prediction Section */}
            <div className="card">
              <h2>Submit Prediction</h2>
              <p style={{ fontSize: "14px", color: "#666", marginBottom: "12px" }}>
                <strong>Note:</strong> Hardcoded matches (1-4) are for UI only. You must create matches on-chain first using the admin script.
              </p>
              <select
                value={selectedMatch}
                onChange={(e) => setSelectedMatch(e.target.value)}
              >
                <option value="">Select a match</option>
                {/* Show loaded matches first (these exist on-chain) */}
                {matches
                  .filter(m => m.status === "Pending" || m.statusNum === 0)
                  .map(match => (
                    <option key={match.id} value={match.id}>
                      {match.teamA} vs {match.teamB} (Match #{match.id})
                    </option>
                  ))}
                {/* Show hardcoded matches as fallback (may not exist on-chain) */}
                {matches.filter(m => m.status === "Pending").length === 0 && hardcodedMatches.map(match => (
                  <option key={match.id} value={match.id}>
                    {match.teamA} vs {match.teamB} (May not exist - create first!)
                  </option>
                ))}
              </select>
              
              {selectedCards.length > 0 && (
                <div>
                  <p>Selected Cards: {selectedCards.length}</p>
                  <button onClick={submitPrediction} disabled={loading || !selectedMatch}>
                    {loading ? "Submitting..." : "Submit Prediction"}
                  </button>
                </div>
              )}
            </div>

            {/* Matches Section */}
            <div className="card">
              <h2>Matches</h2>
              {matches.length === 0 ? (
                <p>No matches available yet.</p>
              ) : (
                <div>
                  {matches.map(match => (
                    <div key={match.id} style={{ margin: "16px 0", padding: "16px", background: "#f8f9fa", borderRadius: "8px" }}>
                      <h3>{match.teamA} vs {match.teamB}</h3>
                      <p>Status: {match.status}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default App;

