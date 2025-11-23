import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import './App.css';
import { CONTRACT_ADDRESSES, NETWORK_CONFIG } from './config';

// Import contract ABIs (these would be generated from compilation)
// For now, we'll use minimal interfaces
const CARD_PACK_FACTORY_ABI = [
  "function openPack() payable",
  "function packPrice() view returns (uint256)",
  "function cardCount() view returns (uint256)",
  "function balanceOf(address, uint256) view returns (uint256)",
  "function uri(uint256) view returns (string)",
  "function getCard(uint256) view returns (tuple(uint8 cardType, string name, string description, uint256 rarity))",
  "function setApprovalForAll(address operator, bool approved)",
  "function isApprovedForAll(address owner, address operator) view returns (bool)",
  "event PackOpened(address indexed user, uint256 indexed cardId, uint8 cardType, string name, uint256 rarity)"
];

const PREDICTION_MANAGER_ABI = [
  "function submitPrediction(uint256 matchId, uint256[] memory cardIds, string memory playerPrompt) returns (uint256)",
  "function matches(uint256) view returns (uint256 matchId, string teamA, string teamB, uint256 timestamp, uint8 status, tuple(bool redCard, bool moreThan4Goals, bool fightBreaksOut, bool moreThan4SlapShots, bool touchdownPass40Plus, bool hatTrick, bool overtime, bool penaltyKick, string winningTeam, string playerOfTheMatch, string mostPointsScored, string mostFouls, string mostMinutesPlayed, string mostAssists, string mostTackles) outcome)",
  "function matchCount() view returns (uint256)",
  "function getUserPredictions(address) view returns (uint256[])",
  "function getMatchPredictions(uint256) view returns (tuple(address user, uint256 matchId, uint256[] cardIds, string playerPrompt, bool settled, bool correct)[])",
  "function predictionIdToMatch(uint256) view returns (uint256)",
  "event PredictionSubmitted(uint256 indexed predictionId, address indexed user, uint256 indexed matchId, uint256[] cardIds, string playerPrompt)"
];

const FAN_NFT_ABI = [
  "function getFanStats(address) view returns (tuple(uint256 level, uint256 correctPredictions, uint256 totalPredictions, string teamName))",
  "function tokenURI(uint256) view returns (string)",
  "function userToTokenId(address) view returns (uint256)",
  "function demoUpdateFanStats(address fan, bool isCorrect)",
  "function owner() view returns (address)"
];

// Pre-loaded player images (defined outside component for better performance)
const playerImages = {
  "Tom Brady": "https://upload.wikimedia.org/wikipedia/commons/b/b0/Tom_Brady_WFT-Buccaneers_NOV2021_%28cropped%29.jpg",
  "Kylian Mbappe": "https://img.olympics.com/images/image/private/t_1-1_300/f_auto/primary/ron2ny1sxmnrrqlxgnak",
  "Lionel Messi": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQhvt0OO_d-npPtCdNF1_0DLYnYT5Y40W41Kw&s",
  "Cristiano Ronaldo": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/Cristiano_Ronaldo_Portugal.jpg/250px-Cristiano_Ronaldo_Portugal.jpg",
  "LeBron James": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSgnIMRGEwMOt9_sgs4lriBD3fvNaWKyVrC4Q&s",
  "Stephen Curry": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/Stephen_Curry_shooting.jpg/250px-Stephen_Curry_shooting.jpg",
  "Patrick Mahomes": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR7vhanTxYBSfJv8c87WdgDsZZYQ-JnRUYMag&s",
  "Aaron Rodgers": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Aaron_Rodgers_Packers_OCT2021_%28cropped%29.jpg/250px-Aaron_Rodgers_Packers_OCT2021_%28cropped%29.jpg"
};

// Pre-loaded match event images (from assets folder)
// Mapping card names from contract to image file names
const matchEventImages = {
  "Red Card": "/assets/red_card.jpeg",
  "More Than 4 Goals": "/assets/more_than_4_points.jpeg", // Note: file is "more_than_4_points" but card is "More Than 4 Goals"
  "Fight Breaks Out": "/assets/fight_breaks_out.jpeg",
  "More Than 4 Slap Shots": "/assets/slap_shots.jpeg", // Note: file is "slap_shots" but card is "More Than 4 Slap Shots"
  "Touchdown Pass 40+ Yards": "/assets/touchdown_pass_40_yards.jpeg",
  "Hat Trick": "/assets/hat_trick.jpeg",
  "Overtime": "/assets/overtime.jpeg",
  "Penalty Kick": "/assets/penalty_kick.jpeg"
};

// Debug: Log all image keys
console.log("Available player images:", Object.keys(playerImages));
console.log("Available match event images:", Object.keys(matchEventImages));

function App() {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState(null);
  const [cards, setCards] = useState([]);
  const [matches, setMatches] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState("");
  const [selectedMatchEventCards, setSelectedMatchEventCards] = useState([]);
  const [selectedPlayerCards, setSelectedPlayerCards] = useState([]);
  const [selectedPlayerPrompt, setSelectedPlayerPrompt] = useState("");
  const [matchCardsLocked, setMatchCardsLocked] = useState(false);
  const [playerCardsLocked, setPlayerCardsLocked] = useState(false);
  const [fanStats, setFanStats] = useState(null);
  const [fanTokenId, setFanTokenId] = useState(null);
  const [fanNFTMetadata, setFanNFTMetadata] = useState(null);
  const [myPredictions, setMyPredictions] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [packOpening, setPackOpening] = useState(false);
  const [submittingPrediction, setSubmittingPrediction] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [openedCard, setOpenedCard] = useState(null);
  const [showCardModal, setShowCardModal] = useState(false);
  const [currentView, setCurrentView] = useState("home"); // "home" or "collection"
  const [collectionFilter, setCollectionFilter] = useState("all"); // "all", "player", "matchevent"
  const [lastPackTime, setLastPackTime] = useState(0);
  const [loadingTipIndex, setLoadingTipIndex] = useState(0);
  
  // Loading screen tips
  const loadingTips = [
    "Collect rare player and match event cards",
    "Use your cards to make predictions on real matches",
    "Earn dynamic NFTs that level up with accurate predictions",
    "Unlock exclusive rewards as your fan level increases"
  ];

  // Hardcoded matches for testing
  const hardcodedMatches = [
    { id: 1, teamA: "Lakers", teamB: "Warriors", status: "Pending" },
    { id: 2, teamA: "Barcelona", teamB: "Real Madrid", status: "Pending" },
    { id: 3, teamA: "Patriots", teamB: "Chiefs", status: "Pending" },
    { id: 4, teamA: "PSG", teamB: "Manchester City", status: "Pending" }
  ];

  // Format card type for display (add space in MatchEvent)
  const formatCardType = (cardType) => {
    if (cardType === "MatchEvent") {
      return "Match Event";
    }
    return cardType;
  };

  // Generate image URL for cards
  const getCardImageUrl = (cardName, cardType) => {
    if (cardType === "Player") {
      // Check for exact match first
      if (playerImages[cardName]) {
        console.log(`Found image for player: ${cardName}`, playerImages[cardName]);
        return playerImages[cardName];
      }
      // Try case-insensitive match
      const lowerCardName = cardName.toLowerCase();
      const matchingKey = Object.keys(playerImages).find(key => key.toLowerCase() === lowerCardName);
      if (matchingKey) {
        console.log(`Found case-insensitive match: ${cardName} -> ${matchingKey}`, playerImages[matchingKey]);
        return playerImages[matchingKey];
      }
      console.warn(`No image found for player: ${cardName}`);
      return "";
    } else if (cardType === "MatchEvent") {
      // Check for exact match first
      if (matchEventImages[cardName]) {
        console.log(`Found image for match event: ${cardName}`, matchEventImages[cardName]);
        return matchEventImages[cardName];
      }
      // Try case-insensitive match
      const lowerCardName = cardName.toLowerCase();
      const matchingKey = Object.keys(matchEventImages).find(key => key.toLowerCase() === lowerCardName);
      if (matchingKey) {
        console.log(`Found case-insensitive match: ${cardName} -> ${matchingKey}`, matchEventImages[matchingKey]);
        return matchEventImages[matchingKey];
      }
      console.warn(`No image found for match event: ${cardName}`);
      return "";
    }
    return "";
  };

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
  const loadUserData = async (signer, address, showInitialLoading = true) => {
    try {
      setLoading(true);
      if (showInitialLoading) {
        setInitialLoading(true);
      }
      
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
              // CardType enum: 0 = Player, 1 = MatchEvent
              // Handle BigInt (0n, 1n) from ethers.js
              let cardTypeValue = card.cardType;
              if (typeof card.cardType === 'bigint') {
                cardTypeValue = card.cardType.toString();
              } else if (card.cardType && typeof card.cardType === 'object' && 'toString' in card.cardType) {
                cardTypeValue = card.cardType.toString();
              } else if (typeof card.cardType === 'number') {
                cardTypeValue = card.cardType.toString();
              }
              
              // Parse cardType - 0 = Player, 1 = MatchEvent
              const cardType = (cardTypeValue === "0" || cardTypeValue === 0 || Number(cardTypeValue) === 0) ? "Player" : "MatchEvent";
              
              console.log(`Card ${i}: ${card.name}, cardType raw:`, card.cardType, `cardTypeValue:`, cardTypeValue, `Parsed as: ${cardType}`);
              
              userCards.push({
                id: i,
                name: card.name,
                type: cardType,
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
      
      // Load user predictions
      try {
        const predictionManager = new ethers.Contract(
          CONTRACT_ADDRESSES.PredictionManager,
          PREDICTION_MANAGER_ABI,
          signer
        );
        
        // Get all matches and check for user predictions
        const matchCount = await predictionManager.matchCount();
        const predictionsList = [];
        let predictionCounter = 1;
        
        // Iterate through all matches to find user's predictions
        for (let matchId = 1; matchId <= matchCount; matchId++) {
          try {
            const matchPredictions = await predictionManager.getMatchPredictions(matchId);
            const match = await predictionManager.matches(matchId);
            
            // Find this user's predictions in this match
            for (let i = 0; i < matchPredictions.length; i++) {
              const pred = matchPredictions[i];
              if (pred.user.toLowerCase() === address.toLowerCase()) {
                // Calculate prediction ID (based on contract logic)
                let calculatedPredId = 1;
                for (let j = 1; j < matchId; j++) {
                  try {
                    const prevMatchPreds = await predictionManager.getMatchPredictions(j);
                    calculatedPredId += prevMatchPreds.length;
                  } catch (e) {
                    // Match doesn't exist, skip
                  }
                }
                calculatedPredId += i;
                
                // Get card details
                const cardDetails = [];
                for (const cardId of pred.cardIds) {
                  try {
                    const card = await cardPackFactory.getCard(cardId);
                    let cardTypeValue = card.cardType;
                    if (typeof card.cardType === 'bigint') {
                      cardTypeValue = card.cardType.toString();
                    } else if (card.cardType && typeof card.cardType === 'object' && 'toString' in card.cardType) {
                      cardTypeValue = card.cardType.toString();
                    }
                    const cardType = (cardTypeValue === "0" || cardTypeValue === 0 || Number(cardTypeValue) === 0) ? "Player" : "MatchEvent";
                    cardDetails.push({
                      id: cardId.toString(),
                      name: card.name,
                      type: cardType,
                      rarity: card.rarity.toString()
                    });
                  } catch (e) {
                    cardDetails.push({
                      id: cardId.toString(),
                      name: `Card #${cardId}`,
                      type: "Unknown",
                      rarity: "?"
                    });
                  }
                }
                
                // Handle match status
                let matchStatus;
                if (Array.isArray(match)) {
                  matchStatus = match[4];
                } else {
                  matchStatus = match.status;
                }
                
                predictionsList.push({
                  predictionId: calculatedPredId.toString(),
                  matchId: matchId.toString(),
                  teamA: Array.isArray(match) ? match[1] : match.teamA,
                  teamB: Array.isArray(match) ? match[2] : match.teamB,
                  cards: cardDetails,
                  playerPrompt: pred.playerPrompt || "",
                  settled: pred.settled,
                  correct: pred.correct,
                  matchStatus: matchStatus
                });
              }
            }
          } catch (e) {
            // Match doesn't exist or error, skip
            console.warn(`Error loading predictions for match ${matchId}:`, e);
          }
        }
        
        // Sort by prediction ID (newest first)
        predictionsList.sort((a, b) => parseInt(b.predictionId) - parseInt(a.predictionId));
        setMyPredictions(predictionsList);
        console.log(`Loaded ${predictionsList.length} predictions:`, predictionsList);
      } catch (e) {
        console.error("Error loading predictions:", e);
        setMyPredictions([]);
      }
      
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
      
      // Check if user is admin (owner of FanNFT contract)
      try {
        const owner = await fanNFT.owner();
        setIsAdmin(owner.toLowerCase() === address.toLowerCase());
      } catch (e) {
        setIsAdmin(false);
      }
      
      try {
        // Check if user has a token ID first
        const tokenId = await fanNFT.userToTokenId(address);
        console.log("User token ID:", tokenId.toString());
        
        if (tokenId.toString() === "0") {
          console.log("User does not have a Fan NFT yet");
          setFanStats(null);
          setFanTokenId(null);
          setFanNFTMetadata(null);
        } else {
          const stats = await fanNFT.getFanStats(address);
          const tokenURI = await fanNFT.tokenURI(tokenId);
          
          console.log("Fan NFT stats loaded:", {
            level: stats.level.toString(),
            correctPredictions: stats.correctPredictions.toString(),
            totalPredictions: stats.totalPredictions.toString(),
            teamName: stats.teamName
          });
          
          setFanStats({
            level: stats.level.toString(),
            correctPredictions: stats.correctPredictions.toString(),
            totalPredictions: stats.totalPredictions.toString(),
            teamName: stats.teamName
          });
          setFanTokenId(tokenId.toString());
          
          // Fetch NFT metadata if tokenURI is available
          if (tokenURI && tokenURI !== "") {
            try {
              // If it's a full URL, fetch it; otherwise it might be a base URI
              if (tokenURI.startsWith("http")) {
                const response = await fetch(tokenURI);
                const metadata = await response.json();
                setFanNFTMetadata(metadata);
              } else if (tokenURI.includes(".json")) {
                // Try to fetch from public metadata folder
                const level = stats.level.toString();
                try {
                  const response = await fetch(`/metadata/${level}.json`);
                  const metadata = await response.json();
                  setFanNFTMetadata(metadata);
                } catch (e) {
                  // Fallback: create metadata from stats
                  setFanNFTMetadata({
                    name: `FanForge Fan NFT - Level ${stats.level}`,
                    description: `A dedicated fan with ${stats.correctPredictions} correct predictions!`,
                    level: stats.level.toString(),
                    teamName: stats.teamName
                  });
                }
              } else {
                // Create metadata from stats if URI doesn't have .json
                const level = stats.level.toString();
                try {
                  const response = await fetch(`/metadata/${level}.json`);
                  const metadata = await response.json();
                  setFanNFTMetadata(metadata);
                } catch (e) {
                  setFanNFTMetadata({
                    name: `FanForge Fan NFT - Level ${stats.level}`,
                    description: `A dedicated fan with ${stats.correctPredictions} correct predictions!`,
                    level: stats.level.toString(),
                    teamName: stats.teamName
                  });
                }
              }
            } catch (metadataErr) {
              console.warn("Could not fetch NFT metadata:", metadataErr);
              // Create basic metadata from stats
              setFanNFTMetadata({
                name: `FanForge Fan NFT - Level ${stats.level}`,
                description: `A dedicated fan with ${stats.correctPredictions} correct predictions!`,
                level: stats.level.toString(),
                teamName: stats.teamName
              });
            }
          } else {
            // No tokenURI, create metadata from stats
            setFanNFTMetadata({
              name: `FanForge Fan NFT - Level ${stats.level}`,
              description: `A dedicated fan with ${stats.correctPredictions} correct predictions!`,
              level: stats.level.toString(),
              teamName: stats.teamName
            });
          }
        }
      } catch (e) {
        console.error("Error loading Fan NFT:", e);
        // User doesn't have NFT yet
        setFanStats(null);
        setFanTokenId(null);
        setFanNFTMetadata(null);
      }
      
      setLoading(false);
      if (showInitialLoading) {
        setInitialLoading(false);
      }
    } catch (err) {
      setError(err.message);
      setLoading(false);
      if (showInitialLoading) {
        setInitialLoading(false);
      }
    }
  };

  // Open a card pack
  const openPack = async () => {
    try {
      setLoading(true);
      setPackOpening(true);
      setError(null);
      
      const cardPackFactory = new ethers.Contract(
        CONTRACT_ADDRESSES.CardPackFactory,
        CARD_PACK_FACTORY_ABI,
        signer
      );
      
      // Get the actual pack price from the contract
      let packPrice;
      try {
        packPrice = await cardPackFactory.packPrice();
        console.log("Pack price from contract:", ethers.formatEther(packPrice), "CHZ");
      } catch (e) {
        console.warn("Could not get pack price from contract, using default:", e);
        // Fallback to default if packPrice() doesn't exist in ABI
        packPrice = ethers.parseEther("0.01");
      }
      
      // Verify contract has cards initialized
      let cardCount = 0n;
      try {
        cardCount = await cardPackFactory.cardCount();
        console.log("Contract card count:", cardCount.toString());
        if (cardCount === 0n) {
          throw new Error("Contract has no cards initialized. Cards must be initialized before opening packs. Please contact the contract owner.");
        }
      } catch (checkErr) {
        if (checkErr.message && checkErr.message.includes("no cards")) {
          throw checkErr;
        }
        console.warn("Could not verify card count:", checkErr);
      }
      
      // Check user balance (including gas)
      const balance = await provider.getBalance(account);
      const estimatedGas = ethers.parseEther("0.001"); // Rough gas estimate
      const totalNeeded = packPrice + estimatedGas;
      console.log("User balance:", ethers.formatEther(balance), "CHZ");
      console.log("Pack price:", ethers.formatEther(packPrice), "CHZ");
      console.log("Estimated gas:", ethers.formatEther(estimatedGas), "CHZ");
      console.log("Total needed:", ethers.formatEther(totalNeeded), "CHZ");
      
      if (balance < totalNeeded) {
        throw new Error(`Insufficient balance. You have ${ethers.formatEther(balance)} CHZ, but need at least ${ethers.formatEther(totalNeeded)} CHZ (${ethers.formatEther(packPrice)} CHZ for pack + gas fees).`);
      }
      
      // Estimate gas first to catch revert reasons with better error messages
      try {
        const gasEstimate = await cardPackFactory.openPack.estimateGas({ value: packPrice });
        console.log("Gas estimate:", gasEstimate.toString());
      } catch (estimateError) {
        console.error("Gas estimation error:", estimateError);
        // Try to extract revert reason
        let errorMessage = "Transaction would revert";
        if (estimateError.reason) {
          errorMessage = estimateError.reason;
        } else if (estimateError.data) {
          // Try to decode the revert reason from error data
          try {
            const decoded = cardPackFactory.interface.parseError(estimateError.data);
            errorMessage = decoded?.name || errorMessage;
          } catch (e) {
            // If we can't decode, try to get message
            errorMessage = estimateError.message || errorMessage;
          }
        } else if (estimateError.message) {
          errorMessage = estimateError.message;
        }
        throw new Error(`Cannot open pack: ${errorMessage}. Make sure you have enough CHZ (need ${ethers.formatEther(packPrice)} CHZ) and the contract is properly initialized (card count: ${cardCount.toString()}).`);
      }
      
      // Add a delay between pack openings to avoid potential race conditions
      // This helps avoid issues with block.timestamp being the same for multiple transactions
      const timeSinceLastPack = Date.now() - lastPackTime;
      if (timeSinceLastPack < 2000) {
        const waitTime = 2000 - timeSinceLastPack;
        console.log(`Waiting ${waitTime}ms to avoid race conditions...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
      setLastPackTime(Date.now());
      
      console.log(`Opening pack with value: ${ethers.formatEther(packPrice)} CHZ`);
      
      // Use a static call first to simulate the transaction and catch revert reasons
      try {
        await cardPackFactory.openPack.staticCall({ value: packPrice });
        console.log("Static call succeeded - transaction should work");
      } catch (staticCallError) {
        console.error("Static call failed (transaction would revert):", staticCallError);
        let revertReason = "Unknown error";
        if (staticCallError.reason) {
          revertReason = staticCallError.reason;
        } else if (staticCallError.data) {
          try {
            // Try to decode the error
            const decoded = cardPackFactory.interface.parseError(staticCallError.data);
            revertReason = decoded?.name || revertReason;
          } catch (e) {
            revertReason = staticCallError.message || revertReason;
          }
        } else if (staticCallError.message) {
          revertReason = staticCallError.message;
        }
        throw new Error(`Transaction would fail: ${revertReason}. Please try again in a moment.`);
      }
      
      const tx = await cardPackFactory.openPack({ value: packPrice });
      console.log("Transaction sent:", tx.hash);
      
      // Wait for transaction with timeout
      let receipt;
      try {
        receipt = await Promise.race([
          tx.wait(),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Transaction timeout")), 60000))
        ]);
      } catch (waitError) {
        console.error("Error waiting for transaction:", waitError);
        
        // Try to get the revert reason from the error
        let revertReason = "Unknown error";
        
        // Check if we have a receipt with status 0 (reverted)
        if (waitError.receipt && waitError.receipt.status === 0) {
          // Try to call the contract to get revert reason
          try {
            // Try to simulate the call again to get the revert reason
            await cardPackFactory.openPack.staticCall({ value: packPrice });
          } catch (simulateError) {
            if (simulateError.reason) {
              revertReason = simulateError.reason;
            } else if (simulateError.data) {
              try {
                const decoded = cardPackFactory.interface.parseError(simulateError.data);
                revertReason = decoded?.name || revertReason;
              } catch (e) {
                revertReason = simulateError.message || revertReason;
              }
            } else if (simulateError.message) {
              revertReason = simulateError.message;
            }
          }
          
          throw new Error(`Transaction reverted: ${revertReason}. This may be due to insufficient balance, contract state issues, or network problems. Please wait a moment and try again.`);
        }
        
        if (waitError.message && waitError.message.includes("timeout")) {
          throw new Error("Transaction timed out. Please check the transaction on the blockchain explorer.");
        }
        
        throw new Error(`Transaction failed: ${waitError.message || "Unknown error"}`);
      }
      
      console.log("Transaction receipt:", receipt);
      
      if (!receipt.status) {
        // Transaction reverted - try to get more info
        console.error("Transaction reverted. Receipt:", receipt);
        
        // Try to simulate again to get revert reason
        let revertReason = "Unknown revert reason";
        try {
          await cardPackFactory.openPack.staticCall({ value: packPrice });
        } catch (simulateError) {
          if (simulateError.reason) {
            revertReason = simulateError.reason;
          } else if (simulateError.data) {
            try {
              const decoded = cardPackFactory.interface.parseError(simulateError.data);
              revertReason = decoded?.name || revertReason;
            } catch (e) {
              revertReason = simulateError.message || revertReason;
            }
          } else if (simulateError.message) {
            revertReason = simulateError.message;
          }
        }
        
        throw new Error(`Transaction reverted: ${revertReason}. Please check your balance (need ${ethers.formatEther(packPrice)} CHZ + gas) and try again in a moment.`);
      }
      
      // Get card details from event in receipt
      let cardData = null;
      if (receipt.logs && receipt.logs.length > 0) {
        try {
          // Find PackOpened event in logs
          for (let log of receipt.logs) {
            try {
              const parsedLog = cardPackFactory.interface.parseLog(log);
              if (parsedLog && parsedLog.name === "PackOpened") {
                cardData = {
                  cardId: parsedLog.args.cardId.toString(),
                  cardType: parsedLog.args.cardType,
                  name: parsedLog.args.name,
                  rarity: parsedLog.args.rarity.toString()
                };
                break;
              }
            } catch (e) {
              // Not the event we're looking for, continue
            }
          }
        } catch (parseErr) {
          console.warn("Could not parse event from receipt:", parseErr);
        }
      }
      
      // If we have card data, show modal
      if (cardData) {
        try {
          const cardDetails = await cardPackFactory.getCard(cardData.cardId);
          let cardTypeValue = cardData.cardType;
          if (typeof cardData.cardType === 'bigint') {
            cardTypeValue = cardData.cardType.toString();
          } else if (cardData.cardType && typeof cardData.cardType === 'object' && 'toString' in cardData.cardType) {
            cardTypeValue = cardData.cardType.toString();
          }
          const cardType = (cardTypeValue === "0" || cardTypeValue === 0 || Number(cardTypeValue) === 0) ? "Player" : "MatchEvent";
          setOpenedCard({
            id: cardData.cardId,
            name: cardData.name,
            type: cardType,
            rarity: cardData.rarity,
            description: cardDetails.description
          });
          setShowCardModal(true);
        } catch (cardErr) {
          // Still show modal with basic info
          let cardTypeValue = cardData.cardType;
          if (typeof cardData.cardType === 'bigint') {
            cardTypeValue = cardData.cardType.toString();
          } else if (cardData.cardType && typeof cardData.cardType === 'object' && 'toString' in cardData.cardType) {
            cardTypeValue = cardData.cardType.toString();
          }
          const cardType = (cardTypeValue === "0" || cardTypeValue === 0 || Number(cardTypeValue) === 0) ? "Player" : "MatchEvent";
          setOpenedCard({
            id: cardData.cardId,
            name: cardData.name,
            type: cardType,
            rarity: cardData.rarity,
            description: ""
          });
          setShowCardModal(true);
          setPackOpening(false); // Hide loading overlay when modal is ready
        }
      }
      
      setSuccess("Pack opened! Check your cards.");
      // Don't show initial loading screen when reloading after pack opening
      await loadUserData(signer, account, false);
      setLoading(false);
    } catch (err) {
      console.error("Open pack error:", err);
      setPackOpening(false);
      let errorMessage = err.message || "Failed to open pack. Please try again.";
      
      // Provide more helpful error messages
      if (err.code === "CALL_EXCEPTION" || err.receipt?.status === 0) {
        errorMessage = "Transaction failed. This could be due to:\n" +
          "1. Insufficient balance (need 0.01 CHZ + gas fees)\n" +
          "2. Contract not properly initialized\n" +
          "3. Network issues\n\n" +
          "Please check your balance and try again.";
      } else if (err.message?.includes("insufficient funds") || err.message?.includes("Insufficient")) {
        errorMessage = `Insufficient funds. You need at least 0.01 CHZ + gas fees to open a pack.`;
      } else if (err.message?.includes("No cards")) {
        errorMessage = "Contract has no cards available. Please contact the contract owner.";
      }
      
      setError(errorMessage);
      setLoading(false);
      setSubmittingPrediction(false);
    }
  };

  // Submit prediction
  const submitPrediction = async () => {
    try {
      if (!selectedMatch || !matchCardsLocked) {
        setError("Please select a match and lock in match event cards");
        return;
      }
      // Player cards are optional - allow submission without them
      if (!playerCardsLocked) {
        setError("Please lock in player cards or skip to continue");
        return;
      }
      
      // Combine match event cards and player cards
      const allSelectedCards = [...selectedMatchEventCards, ...selectedPlayerCards];
      
      if (selectedMatchEventCards.length === 0) {
        setError("Please select at least one match event card");
        return;
      }
      
      // If player cards are selected, prompt is required
      if (selectedPlayerCards.length > 0 && !selectedPlayerPrompt) {
        setError("Please select a player prompt for your player cards");
        return;
      }
      
      setLoading(true);
      setSubmittingPrediction(true);
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
      console.log("Validating card ownership for cards:", allSelectedCards);
      for (const cardId of allSelectedCards) {
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
      
      console.log(`Submitting prediction: Match ${selectedMatch}, Match Event Cards: [${selectedMatchEventCards.join(", ")}], Player Cards: [${selectedPlayerCards.join(", ")}], Prompt: ${selectedPlayerPrompt}`);
      
      // Convert card IDs to numbers if they're strings
      const cardIds = allSelectedCards.map(id => typeof id === 'string' ? parseInt(id) : id);
      
      const tx = await predictionManager.submitPrediction(
        parseInt(selectedMatch),
        cardIds,
        selectedPlayerPrompt || "" // Pass player prompt (empty string if no player cards)
      );
      
      console.log("Transaction sent, waiting for confirmation...");
      const receipt = await tx.wait();
      console.log("Transaction confirmed:", receipt.transactionHash);
      
      setSuccess("Prediction submitted!");
      resetPrediction();
      await loadUserData(signer, account, false);
      setLoading(false);
      setSubmittingPrediction(false);
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
    }
  };

  // Toggle card selection
  const toggleCard = (cardId) => {
    const card = cards.find(c => c.id === cardId);
    if (!card) {
      console.log('Card not found:', cardId, 'Available cards:', cards.map(c => ({ id: c.id, name: c.name })));
      return;
    }
    
    console.log('toggleCard called:', {
      cardId,
      cardName: card.name,
      cardType: card.type,
      cardTypeRaw: typeof card.type,
      cardTypeValue: card.type,
      matchCardsLocked,
      playerCardsLocked,
      balance: card.balance
    });
    
    // If match cards are locked, only allow selecting player cards
    if (matchCardsLocked && card.type !== "Player") {
      console.log('Blocked: match cards locked but card is not Player. Card type:', card.type, 'Type check:', card.type === "Player");
      return;
    }
    
    // If match cards are not locked, only allow selecting match event cards
    if (!matchCardsLocked && card.type !== "MatchEvent") {
      console.log('Blocked: match cards not locked but card is not MatchEvent. Card type:', card.type);
      return;
    }
    
    // Normalize cardId to number for consistent comparison
    const normalizedCardId = typeof cardId === 'string' ? parseInt(cardId) : cardId;
    
    if (card.type === "MatchEvent") {
      const normalizedSelected = selectedMatchEventCards.map(id => typeof id === 'string' ? parseInt(id) : id);
      if (normalizedSelected.includes(normalizedCardId)) {
        setSelectedMatchEventCards(selectedMatchEventCards.filter(id => {
          const normalizedId = typeof id === 'string' ? parseInt(id) : id;
          return normalizedId !== normalizedCardId;
        }));
      } else {
        setSelectedMatchEventCards([...selectedMatchEventCards, normalizedCardId]);
      }
    } else if (card.type === "Player") {
      console.log('Toggling player card:', {
        normalizedCardId,
        cardId,
        cardName: card.name,
        currentSelection: selectedPlayerCards,
        currentSelectionTypes: selectedPlayerCards.map(id => ({ id, type: typeof id }))
      });
      const normalizedSelected = selectedPlayerCards.map(id => typeof id === 'string' ? parseInt(id) : id);
      console.log('Normalized selected:', normalizedSelected, 'Includes?', normalizedSelected.includes(normalizedCardId));
      
      const newSelection = normalizedSelected.includes(normalizedCardId)
        ? selectedPlayerCards.filter(id => {
            const normalizedId = typeof id === 'string' ? parseInt(id) : id;
            const shouldKeep = normalizedId !== normalizedCardId;
            console.log('Filtering:', { id, normalizedId, normalizedCardId, shouldKeep });
            return shouldKeep;
          })
        : [...selectedPlayerCards, normalizedCardId];
      
      console.log('Player card toggled. New selection:', {
        newSelection,
        newSelectionTypes: newSelection.map(id => ({ id, type: typeof id }))
      });
      setSelectedPlayerCards(newSelection);
    } else {
      console.error('Unknown card type:', card.type);
    }
  };

  const lockMatchCards = () => {
    if (selectedMatchEventCards.length === 0) {
      setError("Please select at least one match event card");
      return;
    }
    setMatchCardsLocked(true);
    setSuccess("Match event cards locked!");
  };

  const lockPlayerCards = () => {
    console.log('lockPlayerCards called:', {
      selectedPlayerCards: selectedPlayerCards.length,
      selectedPlayerPrompt,
      matchCardsLocked
    });
    // Player cards are optional - but if selected, both cards and prompt are required
    if (selectedPlayerCards.length > 0 && !selectedPlayerPrompt) {
      setError("Please select a player prompt if you've selected player cards");
      return;
    }
    if (selectedPlayerCards.length > 0 && selectedPlayerPrompt) {
      setPlayerCardsLocked(true);
      setSuccess("Player cards locked!");
      console.log('Player cards locked! State updated.');
    } else {
      setError("Please select at least one player card and a prompt to lock them in");
    }
  };

  const skipPlayerCards = () => {
    // Skip player card selection entirely
    setSelectedPlayerCards([]);
    setSelectedPlayerPrompt("");
    setPlayerCardsLocked(true);
    setSuccess("Continuing without player cards");
    console.log('Skipped player card selection');
  };

  const resetPrediction = () => {
    setSelectedMatchEventCards([]);
    setSelectedPlayerCards([]);
    setSelectedPlayerPrompt("");
    setMatchCardsLocked(false);
    setPlayerCardsLocked(false);
    setSelectedMatch("");
  };

  // Mark card result (demo/admin feature)
  const markCardResult = async (cardId, matchId, isCorrect) => {
    try {
      if (!isAdmin) {
        setError("Only admin can mark card results");
        return;
      }

      setError(null);

      const fanNFT = new ethers.Contract(
        CONTRACT_ADDRESSES.DynamicFanNFT,
        FAN_NFT_ABI,
        signer
      );

      // Update fan stats
      const tx = await fanNFT.demoUpdateFanStats(account, isCorrect);
      await tx.wait();

      setSuccess(`Card marked as ${isCorrect ? "correct" : "incorrect"}! NFT stats updated.`);
      
      // Remove predictions that contain this card from the match
      setMyPredictions(prevPredictions => {
        return prevPredictions.filter(pred => {
          // If this prediction is for a different match, keep it
          if (pred.matchId !== matchId.toString()) {
            return true;
          }
          // If this prediction contains the marked card, remove it
          const hasCard = pred.cards.some(card => card.id === cardId.toString());
          return !hasCard;
        });
      });
      
      // Reload user data to show updated stats (without loading screen)
      await loadUserData(signer, account, false);
    } catch (err) {
      console.error("Error marking card result:", err);
      setError(err.message);
      setLoading(false);
    }
  };

  // Preload player and match event images on component mount
  useEffect(() => {
    const preloadImages = () => {
      // Preload player images
      Object.values(playerImages).forEach((imageUrl) => {
        const img = new Image();
        img.src = imageUrl;
      });
      // Preload match event images
      Object.values(matchEventImages).forEach((imageUrl) => {
        const img = new Image();
        img.src = imageUrl;
      });
    };
    preloadImages();
  }, []);

  useEffect(() => {
    if (account && signer) {
      loadUserData(signer, account);
    }
  }, [account]);

  // Rotate loading tips
  useEffect(() => {
    if (initialLoading) {
      const interval = setInterval(() => {
        setLoadingTipIndex((prev) => (prev + 1) % loadingTips.length);
      }, 3000); // Change tip every 3 seconds
      return () => clearInterval(interval);
    }
  }, [initialLoading, loadingTips.length]);

  return (
    <div className="App">
      {/* Initial Loading Screen - Don't show if pack is opening or submitting prediction */}
      {account && initialLoading && !packOpening && !submittingPrediction && (
        <div className="loading-screen">
          <div className="loading-spinner">
            <div className="spinner-circle"></div>
            <div className="spinner-circle"></div>
            <div className="spinner-circle"></div>
          </div>
          <p className="loading-text">Loading your collection...</p>
          <div className="loading-tips-container">
            <div className="loading-tip" key={loadingTipIndex}>
              {loadingTips[loadingTipIndex]}
            </div>
          </div>
        </div>
      )}

      {/* Pack Opening Loading Overlay */}
      {packOpening && (
        <div className="pack-opening-overlay">
          <div className="pack-opening-spinner">
            <div className="spinner-ring"></div>
          </div>
          <p className="pack-opening-text">Opening pack...</p>
        </div>
      )}

      {/* Prediction Submission Loading Overlay */}
      {submittingPrediction && (
        <div className="pack-opening-overlay">
          <div className="pack-opening-spinner">
            <div className="spinner-ring"></div>
          </div>
          <p className="pack-opening-text">Submitting prediction...</p>
        </div>
      )}
      
      {/* Header Bar */}
      <header className="app-header">
        <div className="header-content">
          <div className="logo">
            <span className="logo-icon">🏆</span>
            <h1 className="logo-text">FanForge</h1>
          </div>
          <div className="header-actions">
            {account && (
              <nav className="header-nav">
                <button 
                  className={`nav-link ${currentView === "home" ? "active" : ""}`}
                  onClick={() => setCurrentView("home")}
                >
                  Home
                </button>
                <button 
                  className={`nav-link ${currentView === "collection" ? "active" : ""}`}
                  onClick={() => setCurrentView("collection")}
                >
                  My Collection
                </button>
              </nav>
            )}
            {!account ? (
              <button className="connect-wallet-btn" onClick={connectWallet}>
                Connect Wallet
              </button>
            ) : (
              <div className="wallet-info">
                <span className="status connected">
                  {account.slice(0, 6)}...{account.slice(-4)}
                </span>
                {fanStats && (
                  <span className="nft-badge">Level {fanStats.level}</span>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="container" style={{ display: account && initialLoading ? 'none' : 'block' }}>
        {/* Hero Section - Only show when not connected */}
        {!account && (
          <div className="hero-section">
            <div className="hero-content">
              <h1 className="hero-title animate-fade-in" style={{ textAlign: "center" }}>
                FanForge
              </h1>
              <p className="hero-subtitle animate-fade-in-delay" style={{ textAlign: "center", maxWidth: "800px", margin: "0 auto" }}>
                Collect. Predict. Win. Trade prediction cards and forecast sport match outcomes in the ultimate fan experience. Participate in a sports card collectible experience like never before. Use your cards to predict your favorite team's matches.
              </p>
              <div className="hero-features animate-fade-in-delay-2">
                <div className="feature-item">
                  <span className="feature-icon">🎴</span>
                  <span>Collect Rare Cards</span>
                </div>
                <div className="feature-item">
                  <span className="feature-icon">⚡</span>
                  <span>Make Predictions</span>
                </div>
                <div className="feature-item">
                  <span className="feature-icon">📈</span>
                  <span>Level Up Your NFT</span>
                </div>
                <div className="feature-item">
                  <span className="feature-icon">🏅</span>
                  <span>Unlock Rewards</span>
                </div>
              </div>
              <button className="hero-cta animate-bounce" onClick={connectWallet}>
                Get Started
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="error animate-slide-down">
            {error}
            <button 
              className="message-close-btn" 
              onClick={() => setError(null)}
              aria-label="Close error message"
            >
              ×
            </button>
          </div>
        )}
        {success && (
          <div className="success animate-slide-down">
            {success}
            <button 
              className="message-close-btn" 
              onClick={() => setSuccess(null)}
              aria-label="Close success message"
            >
              ×
            </button>
          </div>
        )}

        {/* Card Opening Modal */}
        {showCardModal && openedCard && (
          <div className="card-modal-overlay" onClick={() => {
            setShowCardModal(false);
            setPackOpening(false);
          }}>
            <div className="card-modal-content" onClick={(e) => e.stopPropagation()}>
              <button className="card-modal-close" onClick={() => {
                setShowCardModal(false);
                setPackOpening(false);
              }}>×</button>
              <div className="card-modal-confetti">
                {Array.from({ length: 50 }).map((_, i) => (
                  <div key={i} className="confetti-piece" style={{
                    left: `${Math.random() * 100}%`,
                    animationDelay: `${Math.random() * 0.5}s`,
                    backgroundColor: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#f0932b', '#eb4d4b', '#6c5ce7'][Math.floor(Math.random() * 7)]
                  }}></div>
                ))}
              </div>
              <h2 className="card-modal-title">🎉 Pack Opened! 🎉</h2>
              <div className="card-modal-card">
                <div className={`trading-card rarity-${openedCard.rarity}`}>
                  <div className="card-image">
                    {getCardImageUrl(openedCard.name, openedCard.type) ? (
                      <img 
                        src={getCardImageUrl(openedCard.name, openedCard.type)}
                        alt={openedCard.name}
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div style={{ 
                        width: '100%', 
                        height: '100%', 
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '18px',
                        fontWeight: 'bold'
                      }}>
                        {openedCard.name}
                      </div>
                    )}
                    <div className={`card-rarity-badge rarity-${openedCard.rarity}`}>
                      {openedCard.rarity === "1" ? "Common" : 
                       openedCard.rarity === "2" ? "Uncommon" :
                       openedCard.rarity === "3" ? "Rare" :
                       openedCard.rarity === "4" ? "Epic" : "Legendary"}
                    </div>
                  </div>
                  <div className="card-details">
                    <h3 className="card-name">{openedCard.name}</h3>
                                    <p className="card-type">{formatCardType(openedCard.type)}</p>
                  </div>
                </div>
              </div>
              <button className="card-modal-button" onClick={() => {
                setShowCardModal(false);
                setPackOpening(false);
              }}>
                Awesome!
              </button>
            </div>
          </div>
        )}

        {account && currentView === "home" && (
          <>
            {/* My Cards - Full Width at Top */}
            <div style={{ width: "100%", maxWidth: "1200px", margin: "0 auto 24px auto" }}>
              <div className="card">
                <h2>My Cards ({cards.length})</h2>
                <div style={{ position: 'relative', width: '100%' }}>
                  <div className="trading-cards-grid">
                    {cards.length === 0 ? (
                      <p style={{ color: "#666", textAlign: "center", padding: "20px", width: "100%" }}>
                        No cards yet. Open a pack to get started!
                      </p>
                    ) : (
                      cards.map(card => {
                      const balance = parseInt(card.balance);
                      // Determine if card is selected based on type and lock status
                      // Normalize card.id to number for comparison
                      const normalizedCardId = typeof card.id === 'string' ? parseInt(card.id) : card.id;
                      let isSelected = false;
                      if (card.type === "MatchEvent" && !matchCardsLocked) {
                        const normalizedSelected = selectedMatchEventCards.map(id => typeof id === 'string' ? parseInt(id) : id);
                        isSelected = normalizedSelected.includes(normalizedCardId);
                      } else if (card.type === "Player" && matchCardsLocked && !playerCardsLocked) {
                        const normalizedSelected = selectedPlayerCards.map(id => typeof id === 'string' ? parseInt(id) : id);
                        isSelected = normalizedSelected.includes(normalizedCardId);
                        console.log('Checking if card is selected:', {
                          cardId: normalizedCardId,
                          cardName: card.name,
                          selectedPlayerCards,
                          normalizedSelected,
                          isSelected
                        });
                      }
                      
                      // Determine if card should be clickable (but don't grey it out visually)
                      // Match Event cards: not clickable after match cards are locked
                      // Player cards: not clickable before match cards are locked OR after player cards are locked
                      const isClickable = !((matchCardsLocked && card.type === "MatchEvent") || 
                                            (!matchCardsLocked && card.type === "Player") ||
                                            (playerCardsLocked && card.type === "Player")) && selectedMatch !== "";
                      
                      // Debug: Log card info for Player cards when matchCardsLocked is true
                      if (card.type === "Player" && matchCardsLocked && !playerCardsLocked) {
                        console.log('Player card available for selection:', {
                          cardId: card.id,
                          cardIdType: typeof card.id,
                          cardName: card.name,
                          cardType: card.type,
                          balance: card.balance,
                          isClickable,
                          matchCardsLocked,
                          playerCardsLocked,
                          selectedPlayerCards,
                          selectedPlayerCardsTypes: selectedPlayerCards.map(id => ({ id, type: typeof id }))
                        });
                      }
                      
                      return (
                        <div
                          key={card.id}
                          className={`trading-card-container rarity-${card.rarity} ${isSelected ? 'selected' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            console.log('=== CARD CLICKED ===', {
                              cardId: card.id,
                              cardIdType: typeof card.id,
                              cardName: card.name,
                              cardType: card.type,
                              isClickable,
                              matchCardsLocked,
                              playerCardsLocked,
                              selectedMatch,
                              balance: card.balance
                            });
                            if (isClickable) {
                              console.log('✅ Calling toggleCard for card:', card.id);
                              toggleCard(card.id);
                            } else {
                              console.log('❌ Card click blocked:', { 
                                isClickable, 
                                selectedMatch,
                                reason: !selectedMatch ? 'No match selected' : 'Card not clickable in current step'
                              });
                            }
                          }}
                          style={{ 
                            cursor: isClickable ? 'pointer' : 'default',
                            position: "relative",
                            zIndex: isClickable ? 5 : 1,
                            pointerEvents: isClickable ? 'auto' : 'none'
                          }}
                        >
                          <div className={`trading-card rarity-${card.rarity} ${isSelected ? 'selected' : ''}`}>
                            <div className="card-image">
                              {(() => {
                                const imageUrl = getCardImageUrl(card.name, card.type);
                                console.log(`Card: ${card.name}, Type: ${card.type}, Image URL:`, imageUrl);
                                if (imageUrl) {
                                  return (
                                    <img 
                                      src={imageUrl}
                                      alt={card.name}
                                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                      onError={(e) => {
                                        console.error(`Failed to load image for ${card.name}:`, imageUrl, e);
                                        e.target.style.display = 'none';
                                      }}
                                      onLoad={() => {
                                        console.log(`Successfully loaded image for ${card.name}:`, imageUrl);
                                      }}
                                    />
                                  );
                                } else {
                                  return (
                                    <div style={{
                                      width: '100%',
                                      height: '100%',
                                      background: `linear-gradient(135deg, ${
                                        card.rarity === "1" ? "#e0e0e0, #bdbdbd" :
                                        card.rarity === "2" ? "#c8e6c9, #81c784" :
                                        card.rarity === "3" ? "#bbdefb, #64b5f6" :
                                        card.rarity === "4" ? "#ce93d8, #ba68c8" :
                                        "#ffd54f, #ffb300"
                                      })`,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      color: '#333',
                                      fontWeight: 'bold',
                                      fontSize: '14px',
                                      textAlign: 'center',
                                      padding: '8px'
                                    }}>
                                      {card.name}
                                    </div>
                                  );
                                }
                              })()}
                            </div>
                            <div className="card-details">
                              <h3 className="card-name">{card.name}</h3>
                              <p className="card-type">{formatCardType(card.type)}</p>
                              {balance > 1 && (
                                <div className="card-count-badge-bottom">x{balance}</div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                    )}
                    {/* Pack New Card Button - Always on the right */}
                    <div
                      className="trading-card-container pack-new-card"
                      onClick={openPack}
                      style={{ 
                        cursor: loading ? 'not-allowed' : 'pointer',
                        position: "sticky",
                        right: 0,
                        top: 0,
                        zIndex: 10,
                        pointerEvents: loading ? 'none' : 'auto',
                        marginLeft: 'auto',
                        marginRight: 0,
                        flexShrink: 0,
                        alignSelf: 'flex-start'
                      }}
                    >
                      <div className="trading-card pack-new-card-inner">
                        <div className="card-image" style={{ 
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <div style={{
                            textAlign: 'center',
                            color: 'white',
                            fontSize: '18px',
                            fontWeight: '700',
                            padding: '20px'
                          }}>
                            🎴<br />
                            Pack a<br />
                            new card
                          </div>
                        </div>
                        <div className="card-details" style={{ background: 'white' }}>
                          <h3 className="card-name" style={{ color: '#667eea' }}>
                            {loading ? 'Opening...' : 'Click to Open Pack'}
                          </h3>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Fade gradient overlay */}
                  <div className="cards-fade-overlay"></div>
                </div>
              </div>
            </div>

            {/* Main Two Column Layout: 1/3 Left, 2/3 Right */}
            <div className="main-layout">
              {/* Left Column: 1/3 - NFT */}
              <div className="main-column-left">
                {/* Dynamic NFT Card */}
                {fanStats ? (
                  <div className="nft-card">
                    <div className="nft-card-content">
                      <div className="nft-header">
                        <div className="nft-icon">🎫</div>
                        <div className="nft-title-section">
                          <h2 className="nft-title">FanForge Fan NFT</h2>
                          <p className="nft-subtitle">Level {fanStats.level} • {fanStats.teamName}</p>
                        </div>
                        <div className="nft-level-badge">Lv.{fanStats.level}</div>
                      </div>
                      
                      <div className="nft-stats-grid">
                        <div className="nft-stat">
                          <div className="nft-stat-value">{fanStats.correctPredictions}</div>
                          <div className="nft-stat-label">Correct</div>
                        </div>
                        <div className="nft-stat">
                          <div className="nft-stat-value">{fanStats.totalPredictions}</div>
                          <div className="nft-stat-label">Total</div>
                        </div>
                        <div className="nft-stat">
                          <div className="nft-stat-value">
                            {fanStats.totalPredictions !== "0" 
                              ? Math.round((parseInt(fanStats.correctPredictions) / parseInt(fanStats.totalPredictions)) * 100)
                              : 0}%
                          </div>
                          <div className="nft-stat-label">Accuracy</div>
                        </div>
                        <div className="nft-stat">
                          <div className="nft-stat-value">
                            {parseInt(fanStats.level) * 3 - parseInt(fanStats.correctPredictions)}
                          </div>
                          <div className="nft-stat-label">To Next Level</div>
                        </div>
                      </div>

                      <div className="nft-progress">
                        <div className="nft-progress-bar">
                          <div 
                            className="nft-progress-fill"
                            style={{ 
                              width: `${Math.min(100, (parseInt(fanStats.correctPredictions) / (parseInt(fanStats.level) * 3)) * 100)}%`
                            }}
                          ></div>
                        </div>
                        <div className="nft-progress-text">
                          {fanStats.correctPredictions} / {parseInt(fanStats.level) * 3} correct predictions
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="nft-card nft-card-empty">
                    <div className="nft-card-content">
                      <p style={{ textAlign: "center", color: "rgba(255,255,255,0.8)" }}>
                        No Fan NFT found. Mint one to get started!
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: 2/3 - Everything Else */}
              <div className="main-column-right">
                {/* Submit Prediction */}
                <div className="card">
                      <h2>⚡ Submit Prediction</h2>
                      <p style={{ fontSize: "14px", color: "#666", marginBottom: "16px" }}>
                        {!matchCardsLocked 
                          ? "Step 1: Select match event cards for your prediction"
                          : !playerCardsLocked
                          ? "Step 2: Select player cards and a prompt"
                          : "Ready to submit your prediction!"}
                      </p>
                      
                      {/* Step 1: Match Selection - Only show when match cards are NOT locked */}
                      {!matchCardsLocked && (
                        <div style={{ marginBottom: "16px", position: "relative", zIndex: 1 }}>
                          <label style={{ display: "block", marginBottom: "8px", fontWeight: "600" }}>Select Match</label>
                          <select
                            value={selectedMatch}
                            onChange={(e) => {
                              const newMatch = e.target.value;
                              setSelectedMatch(newMatch);
                              if (newMatch !== selectedMatch) {
                                // Only reset if match actually changed
                                setSelectedMatchEventCards([]);
                                setSelectedPlayerCards([]);
                                setSelectedPlayerPrompt("");
                                setMatchCardsLocked(false);
                                setPlayerCardsLocked(false);
                              }
                            }}
                            style={{ 
                              width: "100%", 
                              zIndex: 10,
                              position: "relative"
                            }}
                          >
                            <option value="">Choose a match...</option>
                            {matches
                              .filter(m => {
                                const status = m.statusNum !== undefined ? m.statusNum : (m.status === "Pending" ? 0 : 1);
                                return status === 0 || m.status === "Pending";
                              })
                              .map(match => (
                                <option key={match.id} value={match.id}>
                                  {match.teamA} vs {match.teamB} (Match #{match.id})
                                </option>
                              ))}
                            {matches.filter(m => {
                              const status = m.statusNum !== undefined ? m.statusNum : (m.status === "Pending" ? 0 : 1);
                              return status === 0 || m.status === "Pending";
                            }).length === 0 && hardcodedMatches.map(match => (
                              <option key={match.id} value={match.id}>
                                {match.teamA} vs {match.teamB} (May not exist - create first!)
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                      
                      {/* Show selected match info when locked */}
                      {matchCardsLocked && selectedMatch && (
                        <div style={{ 
                          padding: "12px", 
                          background: "#e3f2fd", 
                          borderRadius: "8px", 
                          marginBottom: "16px",
                          border: "2px solid #2196f3"
                        }}>
                          <p style={{ margin: 0, fontWeight: "600", color: "#1976d2" }}>
                            📋 Match: {(() => {
                              const match = matches.find(m => m.id.toString() === selectedMatch.toString()) || 
                                         hardcodedMatches.find(m => m.id.toString() === selectedMatch.toString());
                              return match ? `${match.teamA} vs ${match.teamB}` : `Match #${selectedMatch}`;
                            })()}
                          </p>
                        </div>
                      )}

                      {/* Step 1: Match Event Cards Selection - Only show when NOT locked */}
                      {selectedMatch && !matchCardsLocked && (
                        <>
                          <div style={{ marginBottom: "16px" }}>
                            <p style={{ fontSize: "13px", color: "#666", marginBottom: "8px" }}>
                              Select Match Event Cards (only match event cards can be selected)
                            </p>
                            {selectedMatchEventCards.length > 0 && (
                              <div style={{ 
                                padding: "12px", 
                                background: "#f0f4ff", 
                                borderRadius: "8px", 
                                marginBottom: "12px" 
                              }}>
                                <p style={{ margin: "0 0 8px 0", fontWeight: "600" }}>
                                  Selected Match Event Cards: {selectedMatchEventCards.length}
                                </p>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                                  {selectedMatchEventCards.map(cardId => {
                                    const card = cards.find(c => c.id === cardId);
                                    return card ? (
                                      <span 
                                        key={cardId}
                                        style={{
                                          padding: "4px 8px",
                                          background: "#667eea",
                                          color: "white",
                                          borderRadius: "4px",
                                          fontSize: "12px"
                                        }}
                                      >
                                        {card.name}
                                      </span>
                                    ) : null;
                                  })}
                                </div>
                              </div>
                            )}
                            <button 
                              onClick={lockMatchCards} 
                              disabled={selectedMatchEventCards.length === 0}
                              style={{ width: "100%", marginBottom: "16px" }}
                            >
                              Lock in Match Cards
                            </button>
                          </div>
                        </>
                      )}

                      {/* Step 2: Player Cards Selection - Replaces Step 1 when match cards are locked */}
                      {matchCardsLocked && !playerCardsLocked && (
                        <>
                          <div style={{ marginBottom: "16px" }}>
                            <p style={{ fontSize: "13px", color: "#666", marginBottom: "12px" }}>
                              <strong>Optional:</strong> Select player cards and a prompt, or skip to submit with just match event cards.
                            </p>
                          </div>

                          <div style={{ marginBottom: "16px", position: "relative", zIndex: 1 }}>
                            <label style={{ display: "block", marginBottom: "8px", fontWeight: "600" }}>
                              Select Player Prompt (Optional)
                            </label>
                            <select
                              value={selectedPlayerPrompt}
                              onChange={(e) => setSelectedPlayerPrompt(e.target.value)}
                              style={{ 
                                width: "100%",
                                zIndex: 10,
                                position: "relative",
                                background: "white",
                                cursor: "pointer"
                              }}
                            >
                              <option value="">Choose a player prompt (optional)...</option>
                              <option value="Player of the Match / MVP">Player of the Match / MVP</option>
                              <option value="Most points scored">Most points scored</option>
                              <option value="Most fouls">Most fouls</option>
                              <option value="Most minutes played">Most minutes played</option>
                              <option value="Most Assists">Most Assists</option>
                              <option value="Most tackles">Most tackles</option>
                            </select>
                          </div>

                          <div style={{ marginBottom: "16px" }}>
                            <p style={{ fontSize: "13px", color: "#666", marginBottom: "8px" }}>
                              Select Player Cards (optional - only player cards can be selected)
                            </p>
                            {selectedPlayerCards.length > 0 && (
                              <div style={{ 
                                padding: "12px", 
                                background: "#f0f4ff", 
                                borderRadius: "8px", 
                                marginBottom: "12px" 
                              }}>
                                <p style={{ margin: "0 0 8px 0", fontWeight: "600" }}>
                                  Selected Player Cards: {selectedPlayerCards.length}
                                </p>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                                  {selectedPlayerCards.map(cardId => {
                                    // Normalize cardId for comparison
                                    const normalizedCardId = typeof cardId === 'string' ? parseInt(cardId) : cardId;
                                    const card = cards.find(c => {
                                      const normalizedCardIdFromCard = typeof c.id === 'string' ? parseInt(c.id) : c.id;
                                      return normalizedCardIdFromCard === normalizedCardId;
                                    });
                                    return card ? (
                                      <span 
                                        key={cardId}
                                        style={{
                                          padding: "4px 8px",
                                          background: "#667eea",
                                          color: "white",
                                          borderRadius: "4px",
                                          fontSize: "12px"
                                        }}
                                      >
                                        {card.name}
                                      </span>
                                    ) : null;
                                  })}
                                </div>
                              </div>
                            )}
                            
                            {/* Action buttons */}
                            <div style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
                              {/* Lock in Player Cards Button - only enabled if both cards and prompt are selected */}
                              <button 
                                onClick={() => {
                                  if (selectedPlayerCards.length > 0 && !selectedPlayerPrompt) {
                                    setError("Please select a player prompt if you've selected player cards");
                                    return;
                                  }
                                  if (selectedPlayerCards.length > 0 && selectedPlayerPrompt) {
                                    lockPlayerCards();
                                  } else {
                                    setError("Please select at least one player card and a prompt to lock them in");
                                  }
                                }}
                                disabled={selectedPlayerCards.length === 0 || !selectedPlayerPrompt}
                                style={{ 
                                  flex: 1,
                                  padding: "12px",
                                  fontSize: "16px",
                                  fontWeight: "600",
                                  backgroundColor: (selectedPlayerCards.length === 0 || !selectedPlayerPrompt) ? "#ccc" : "#667eea",
                                  color: "white",
                                  border: "none",
                                  borderRadius: "6px",
                                  cursor: (selectedPlayerCards.length === 0 || !selectedPlayerPrompt) ? 'not-allowed' : 'pointer',
                                  transition: "all 0.3s ease"
                                }}
                                title={selectedPlayerCards.length === 0 
                                  ? "Select player cards first" 
                                  : !selectedPlayerPrompt 
                                  ? "Select a player prompt first" 
                                  : "Lock in your player cards"}
                              >
                                🔒 Lock in Player Cards
                              </button>
                              
                              {/* Skip Button - always enabled */}
                              <button 
                                onClick={skipPlayerCards}
                                style={{ 
                                  flex: 1,
                                  padding: "12px",
                                  fontSize: "16px",
                                  fontWeight: "600",
                                  backgroundColor: "#6c757d",
                                  color: "white",
                                  border: "none",
                                  borderRadius: "6px",
                                  cursor: "pointer",
                                  transition: "all 0.3s ease"
                                }}
                                title="Skip player card selection and continue to submit"
                              >
                                ⏭️ Skip
                              </button>
                            </div>
                            
                            {selectedPlayerCards.length > 0 && !selectedPlayerPrompt && (
                              <p style={{ fontSize: "12px", color: "#ff6b6b", marginTop: "8px", marginBottom: 0 }}>
                                ⚠️ If you've selected player cards, please also select a prompt, or deselect the cards and skip.
                              </p>
                            )}
                          </div>
                        </>
                      )}

                      {/* Step 3: Submit */}
                      {(() => {
                        const shouldShow = matchCardsLocked && playerCardsLocked;
                        console.log('Should show submit button?', {
                          shouldShow,
                          matchCardsLocked,
                          playerCardsLocked
                        });
                        return shouldShow;
                      })() && matchCardsLocked && playerCardsLocked && (
                        <>
                          <div style={{ 
                            padding: "12px", 
                            background: "#e8f5e9", 
                            borderRadius: "8px", 
                            marginBottom: "16px",
                            border: "2px solid #4caf50"
                          }}>
                            {selectedPlayerCards.length > 0 ? (
                              <>
                                <p style={{ margin: "0 0 8px 0", fontWeight: "600", color: "#2e7d32" }}>
                                  ✓ Player Cards Locked ({selectedPlayerCards.length} cards)
                                </p>
                                <p style={{ margin: "0 0 8px 0", fontSize: "13px", color: "#666" }}>
                                  Prompt: {selectedPlayerPrompt}
                                </p>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                                  {selectedPlayerCards.map(cardId => {
                                    // Normalize cardId for comparison
                                    const normalizedCardId = typeof cardId === 'string' ? parseInt(cardId) : cardId;
                                    const card = cards.find(c => {
                                      const normalizedCardIdFromCard = typeof c.id === 'string' ? parseInt(c.id) : c.id;
                                      return normalizedCardIdFromCard === normalizedCardId;
                                    });
                                    return card ? (
                                      <span 
                                        key={cardId}
                                        style={{
                                          padding: "4px 8px",
                                          background: "#4caf50",
                                          color: "white",
                                          borderRadius: "4px",
                                          fontSize: "12px"
                                        }}
                                      >
                                        {card.name}
                                      </span>
                                    ) : null;
                                  })}
                                </div>
                              </>
                            ) : (
                              <p style={{ margin: 0, fontWeight: "600", color: "#2e7d32" }}>
                                ✓ Ready to submit with match event cards only
                              </p>
                            )}
                          </div>

                          <button 
                            onClick={submitPrediction} 
                            disabled={loading}
                            style={{ width: "100%", marginBottom: "8px" }}
                          >
                            {loading ? "Submitting..." : "Submit Prediction"}
                          </button>
                          <button 
                            onClick={resetPrediction}
                            style={{ width: "100%", background: "#999", fontSize: "14px", padding: "8px" }}
                          >
                            Reset & Start Over
                          </button>
                        </>
                      )}
                </div>
              </div>
            </div>

            {/* My Predictions Section */}
            <div style={{ width: "100%", maxWidth: "1200px", margin: "24px auto 0 auto" }}>
              <div className="card">
              <h2>📊 My Predictions ({myPredictions.length})</h2>
              {myPredictions.length === 0 ? (
                <p>You haven't made any predictions yet. Submit a prediction to see it here!</p>
              ) : (
                <div>
                  {(() => {
                    // Group predictions by matchId
                    const groupedPredictions = {};
                    myPredictions.forEach(prediction => {
                      const matchId = prediction.matchId;
                      if (!groupedPredictions[matchId]) {
                        groupedPredictions[matchId] = [];
                      }
                      groupedPredictions[matchId].push(prediction);
                    });

                    // Convert to array and sort by matchId (newest first)
                    const groupedArray = Object.entries(groupedPredictions).sort((a, b) => parseInt(b[0]) - parseInt(a[0]));

                    return groupedArray.map(([matchId, predictions]) => {
                      const firstPrediction = predictions[0];
                      const matchStatus = typeof firstPrediction.matchStatus === 'object' 
                        ? parseInt(firstPrediction.matchStatus.toString()) 
                        : parseInt(firstPrediction.matchStatus);
                      const isPending = matchStatus === 0;
                      
                      // Collect all unique cards from all predictions for this match
                      const allCards = [];
                      const cardMap = new Map();
                      predictions.forEach(pred => {
                        pred.cards.forEach(card => {
                          if (!cardMap.has(card.id)) {
                            cardMap.set(card.id, card);
                            allCards.push(card);
                          }
                        });
                      });

                      // Count settled predictions and their results
                      const settledCount = predictions.filter(p => p.settled).length;
                      const correctCount = predictions.filter(p => p.settled && p.correct).length;
                      const incorrectCount = predictions.filter(p => p.settled && !p.correct).length;
                      const pendingCount = predictions.filter(p => !p.settled).length;

                      // Determine overall status
                      let overallStatus = "pending";
                      let statusColor = "#ffc107";
                      let statusBg = "#fff3cd";
                      let statusText = "⏳ Pending";
                      
                      if (settledCount > 0) {
                        if (correctCount > 0 && incorrectCount === 0) {
                          overallStatus = "all-correct";
                          statusColor = "#28a745";
                          statusBg = "#d4edda";
                          statusText = `✅ ${correctCount} Correct`;
                        } else if (incorrectCount > 0 && correctCount === 0) {
                          overallStatus = "all-incorrect";
                          statusColor = "#dc3545";
                          statusBg = "#f8d7da";
                          statusText = `❌ ${incorrectCount} Incorrect`;
                        } else {
                          overallStatus = "mixed";
                          statusColor = "#6c757d";
                          statusBg = "#e9ecef";
                          statusText = `📊 ${correctCount} Correct, ${incorrectCount} Incorrect`;
                        }
                      }

                      return (
                        <div 
                          key={matchId} 
                          style={{ 
                            margin: "16px 0", 
                            padding: "16px", 
                            background: statusBg,
                            borderRadius: "8px",
                            border: `2px solid ${statusColor}`
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "12px" }}>
                            <div style={{ flex: 1 }}>
                              <h3 style={{ margin: 0 }}>
                                {firstPrediction.teamA} vs {firstPrediction.teamB}
                              </h3>
                              <p style={{ fontSize: "12px", color: "#666", margin: "4px 0" }}>
                                Match #{matchId} • {predictions.length} prediction{predictions.length > 1 ? 's' : ''}
                              </p>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <span style={{ 
                                padding: "4px 12px", 
                                background: statusColor, 
                                color: statusColor === "#ffc107" ? "#000" : "#fff", 
                                borderRadius: "12px",
                                fontSize: "12px",
                                fontWeight: "600"
                              }}>
                                {statusText}
                              </span>
                              {pendingCount > 0 && settledCount > 0 && (
                                <div style={{ fontSize: "11px", color: "#666", marginTop: "4px" }}>
                                  {pendingCount} pending
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Show individual prediction results if settled */}
                          {settledCount > 0 && (
                            <div style={{ marginBottom: "12px", padding: "8px", background: "rgba(0,0,0,0.05)", borderRadius: "6px" }}>
                              <p style={{ margin: "0 0 8px 0", fontWeight: "600", fontSize: "14px" }}>Results:</p>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                                {predictions.map((pred, idx) => {
                                  if (!pred.settled) return null;
                                  return (
                                    <span
                                      key={idx}
                                      style={{
                                        padding: "4px 8px",
                                        background: pred.correct ? "#28a745" : "#dc3545",
                                        color: "#fff",
                                        borderRadius: "6px",
                                        fontSize: "12px"
                                      }}
                                    >
                                      Prediction #{pred.predictionId}: {pred.correct ? "✅" : "❌"}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Show pending predictions count */}
                          {pendingCount > 0 && (
                            <div style={{ marginBottom: "12px", padding: "8px", background: "rgba(255,193,7,0.2)", borderRadius: "6px" }}>
                              <p style={{ margin: 0, fontSize: "14px" }}>
                                ⏳ {pendingCount} prediction{pendingCount > 1 ? 's' : ''} waiting for match settlement
                              </p>
                            </div>
                          )}
                          
                          <div style={{ marginTop: "12px" }}>
                            <p style={{ margin: "8px 0", fontWeight: "600" }}>
                              All Cards Used ({allCards.length} unique card{allCards.length > 1 ? 's' : ''}):
                              {isAdmin && isPending && (
                                <span style={{ fontSize: "12px", color: "#666", marginLeft: "8px" }}>
                                  (Click ✓ or ✗ to mark as correct/incorrect)
                                </span>
                              )}
                            </p>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                              {allCards.map((card, cardIndex) => {
                                // Check if this card's prediction is already marked
                                const cardPrediction = predictions.find(p => 
                                  p.cards.some(c => c.id === card.id)
                                );
                                const isCardMarked = cardPrediction && cardPrediction.settled;
                                const isCardCorrect = cardPrediction && cardPrediction.correct;
                                
                                // Get player prompt for this card if it's a player card
                                const playerPrompt = card.type === "Player" && cardPrediction && cardPrediction.playerPrompt 
                                  ? cardPrediction.playerPrompt 
                                  : null;
                                
                                return (
                                  <div
                                    key={cardIndex}
                                    className={`card-item rarity-${card.rarity}`}
                                    style={{
                                      padding: "8px 12px",
                                      fontSize: "14px",
                                      minWidth: "auto",
                                      cursor: "default",
                                      position: "relative",
                                      border: isCardMarked ? (isCardCorrect ? "2px solid #28a745" : "2px solid #dc3545") : "2px solid transparent"
                                    }}
                                  >
                                    <strong>{card.name}</strong>
                                    {playerPrompt && (
                                      <div style={{ fontSize: "12px", color: "#667eea", marginTop: "2px", fontWeight: "500" }}>
                                        {playerPrompt}
                                      </div>
                                    )}
                                    {!playerPrompt && (
                                      <div style={{ fontSize: "11px", color: "#666", marginTop: "4px" }}>
                                        {formatCardType(card.type)} • Rarity {card.rarity}
                                      </div>
                                    )}
                                    {isCardMarked && (
                                      <div style={{
                                        position: "absolute",
                                        top: "4px",
                                        right: "4px",
                                        fontSize: "16px"
                                      }}>
                                        {isCardCorrect ? "✅" : "❌"}
                                      </div>
                                    )}
                                    {isAdmin && isPending && !isCardMarked && (
                                      <div style={{
                                        display: "flex",
                                        gap: "4px",
                                        marginTop: "8px",
                                        justifyContent: "center"
                                      }}>
                                        <button
                                          onClick={() => markCardResult(card.id, matchId, true)}
                                          disabled={loading}
                                          style={{
                                            padding: "4px 8px",
                                            background: "#28a745",
                                            color: "white",
                                            border: "none",
                                            borderRadius: "4px",
                                            cursor: "pointer",
                                            fontSize: "12px"
                                          }}
                                          title="Mark as correct"
                                        >
                                          ✓
                                        </button>
                                        <button
                                          onClick={() => markCardResult(card.id, matchId, false)}
                                          disabled={loading}
                                          style={{
                                            padding: "4px 8px",
                                            background: "#dc3545",
                                            color: "white",
                                            border: "none",
                                            borderRadius: "4px",
                                            cursor: "pointer",
                                            fontSize: "12px"
                                          }}
                                          title="Mark as incorrect"
                                        >
                                          ✗
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Show prediction IDs */}
                          <div style={{ marginTop: "12px", fontSize: "12px", color: "#666" }}>
                            Prediction IDs: {predictions.map(p => `#${p.predictionId}`).join(", ")}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
              </div>
            </div>

          </>
        )}

        {/* Collection Page */}
        {account && currentView === "collection" && (
          <div className="collection-page">
            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
                <h1 style={{ margin: 0 }}>My Collection</h1>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    className={`filter-btn ${collectionFilter === "all" ? "active" : ""}`}
                    onClick={() => setCollectionFilter("all")}
                  >
                    All Cards
                  </button>
                  <button
                    className={`filter-btn ${collectionFilter === "player" ? "active" : ""}`}
                    onClick={() => setCollectionFilter("player")}
                  >
                    Player Cards
                  </button>
                  <button
                    className={`filter-btn ${collectionFilter === "matchevent" ? "active" : ""}`}
                    onClick={() => setCollectionFilter("matchevent")}
                  >
                    Match Event Cards
                  </button>
                </div>
              </div>

              {cards.length === 0 ? (
                <p style={{ color: "#666", textAlign: "center", padding: "40px" }}>
                  No cards yet. Open a pack to get started!
                </p>
              ) : (
                <>
                  {(() => {
                    const filteredCards = cards.filter(card => {
                      if (collectionFilter === "all") return true;
                      if (collectionFilter === "player") return card.type === "Player";
                      if (collectionFilter === "matchevent") return card.type === "MatchEvent";
                      return true;
                    });

                    if (filteredCards.length === 0) {
                      return (
                        <p style={{ color: "#666", textAlign: "center", padding: "40px" }}>
                          No {collectionFilter === "player" ? "player" : collectionFilter === "matchevent" ? "match event" : ""} cards in your collection.
                        </p>
                      );
                    }

                    return (
                      <div style={{ marginBottom: "16px", color: "#666" }}>
                        Showing {filteredCards.length} of {cards.length} cards
                      </div>
                    );
                  })()}

                  <div className="trading-cards-grid collection-grid">
                    {cards
                      .filter(card => {
                        if (collectionFilter === "all") return true;
                        if (collectionFilter === "player") return card.type === "Player";
                        if (collectionFilter === "matchevent") return card.type === "MatchEvent";
                        return true;
                      })
                      .map(card => {
                        const balance = parseInt(card.balance);
                        const normalizedCardId = typeof card.id === 'string' ? parseInt(card.id) : card.id;
                        
                        return (
                          <div
                            key={card.id}
                            className={`trading-card-container rarity-${card.rarity}`}
                            style={{ 
                              cursor: "default",
                              position: "relative",
                              zIndex: 1
                            }}
                          >
                            <div className={`trading-card rarity-${card.rarity}`}>
                              <div className="card-image">
                                {(() => {
                                  const imageUrl = getCardImageUrl(card.name, card.type);
                                  if (imageUrl) {
                                    return (
                                      <img 
                                        src={imageUrl}
                                        alt={card.name}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        onError={(e) => {
                                          e.target.style.display = 'none';
                                        }}
                                      />
                                    );
                                  } else {
                                    return (
                                      <div style={{
                                        width: '100%',
                                        height: '100%',
                                        background: `linear-gradient(135deg, ${
                                          card.rarity === "1" ? "#e0e0e0, #bdbdbd" :
                                          card.rarity === "2" ? "#c8e6c9, #81c784" :
                                          card.rarity === "3" ? "#bbdefb, #64b5f6" :
                                          card.rarity === "4" ? "#ce93d8, #ba68c8" :
                                          "#ffd54f, #ffb300"
                                        })`,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#333',
                                        fontWeight: 'bold',
                                        fontSize: '14px',
                                        textAlign: 'center',
                                        padding: '8px'
                                      }}>
                                        {card.name}
                                      </div>
                                    );
                                  }
                                })()}
                                <div className={`card-rarity-badge rarity-${card.rarity}`}>
                                  {card.rarity === "1" ? "Common" : 
                                   card.rarity === "2" ? "Uncommon" :
                                   card.rarity === "3" ? "Rare" :
                                   card.rarity === "4" ? "Epic" : "Legendary"}
                                </div>
                              </div>
                              <div className="card-details">
                                <h3 className="card-name">{card.name}</h3>
                                <p className="card-type">{formatCardType(card.type)}</p>
                                {balance > 1 && (
                                  <div className="card-count-badge-bottom">x{balance}</div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;

