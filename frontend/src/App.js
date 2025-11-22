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
  "function submitPrediction(uint256 matchId, uint256[] memory cardIds) returns (uint256)",
  "function matches(uint256) view returns (uint256 matchId, string teamA, string teamB, uint256 timestamp, uint8 status, tuple(bool redCard, bool moreThan4Goals, bool fightBreaksOut, bool moreThan4SlapShots, bool touchdownPass40Plus, bool hatTrick, bool overtime, bool penaltyKick, string winningTeam) outcome)",
  "function matchCount() view returns (uint256)",
  "function getUserPredictions(address) view returns (uint256[])",
  "function getMatchPredictions(uint256) view returns (tuple(address user, uint256 matchId, uint256[] cardIds, bool settled, bool correct)[])",
  "function predictionIdToMatch(uint256) view returns (uint256)",
  "event PredictionSubmitted(uint256 indexed predictionId, address indexed user, uint256 indexed matchId, uint256[] cardIds)"
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
  const [selectedCards, setSelectedCards] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState("");
  const [fanStats, setFanStats] = useState(null);
  const [fanTokenId, setFanTokenId] = useState(null);
  const [fanNFTMetadata, setFanNFTMetadata] = useState(null);
  const [myPredictions, setMyPredictions] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [openedCard, setOpenedCard] = useState(null);
  const [showCardModal, setShowCardModal] = useState(false);

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
      
      // Get the actual pack price from the contract
      let packPrice;
      try {
        packPrice = await cardPackFactory.packPrice();
      } catch (e) {
        // Fallback to default if packPrice() doesn't exist in ABI
        packPrice = ethers.parseEther("0.01");
      }
      
      // Check user balance
      const balance = await provider.getBalance(account);
      if (balance < packPrice) {
        throw new Error(`Insufficient balance. Need ${ethers.formatEther(packPrice)} CHZ, but you have ${ethers.formatEther(balance)} CHZ`);
      }
      
      // Estimate gas first to catch revert reasons
      try {
        await cardPackFactory.openPack.estimateGas({ value: packPrice });
      } catch (estimateError) {
        // Try to extract revert reason
        const errorMessage = estimateError.reason || estimateError.message || "Transaction would revert";
        throw new Error(`Cannot open pack: ${errorMessage}. Make sure you have enough CHZ and the contract is properly initialized.`);
      }
      
      const tx = await cardPackFactory.openPack({ value: packPrice });
      const receipt = await tx.wait();
      
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
        }
      }
      
      setSuccess("Pack opened! Check your cards.");
      await loadUserData(signer, account);
      setLoading(false);
    } catch (err) {
      console.error("Open pack error:", err);
      setError(err.message || "Failed to open pack. Please try again.");
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

  // Mark card result (demo/admin feature)
  const markCardResult = async (cardId, matchId, isCorrect) => {
    try {
      if (!isAdmin) {
        setError("Only admin can mark card results");
        return;
      }

      setLoading(true);
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
      
      // Reload user data to show updated stats
      await loadUserData(signer, account);
      setLoading(false);
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

  return (
    <div className="App">
      {/* Header Bar */}
      <header className="app-header">
        <div className="header-content">
          <div className="logo">
            <span className="logo-icon">🏆</span>
            <h1 className="logo-text">FanForge</h1>
          </div>
          <div className="header-actions">
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

      <div className="container">
        {/* Hero Section - Only show when not connected */}
        {!account && (
          <div className="hero-section">
            <div className="hero-content">
              <h1 className="hero-title animate-fade-in">
                Prove Your Loyalty
              </h1>
              <p className="hero-subtitle animate-fade-in-delay">
                Participate in a sports card collectible experience like never before.
                Use your cards to predict your favorite team's matches and earn dynamic NFTs that level up with your accuracy.
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

        {error && <div className="error animate-slide-down">{error}</div>}
        {success && <div className="success animate-slide-down">{success}</div>}

        {/* Card Opening Modal */}
        {showCardModal && openedCard && (
          <div className="card-modal-overlay" onClick={() => setShowCardModal(false)}>
            <div className="card-modal-content" onClick={(e) => e.stopPropagation()}>
              <button className="card-modal-close" onClick={() => setShowCardModal(false)}>×</button>
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
              <button className="card-modal-button" onClick={() => setShowCardModal(false)}>
                Awesome!
              </button>
            </div>
          </div>
        )}

        {account && (
          <>
            {/* Main Two Column Layout: 1/3 Left, 2/3 Right */}
            <div className="main-layout">
              {/* Left Column: 1/3 - NFT & Welcome */}
              <div className="main-column-left">
                {/* Welcome Back */}
                <div className="card welcome-card">
                  <h2>Welcome Back!</h2>
                  <p style={{ color: "#666", marginTop: "8px" }}>
                    Ready to make some predictions?
                  </p>
                </div>

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
                {/* Open Pack Section */}
                <div className="card">
                  <h2>🎴 Open Card Pack</h2>
                  <p style={{ color: "#666", marginBottom: "16px" }}>Cost: 0.01 CHZ</p>
                  <button onClick={openPack} disabled={loading} style={{ width: "100%" }}>
                    {loading ? "Opening..." : "Open Pack"}
                  </button>
                </div>

                {/* Two Column Layout: My Cards & Submit Prediction */}
                <div className="two-column-layout">
                  {/* Left: My Cards */}
                  <div className="column-left">
                    <div className="card">
                      <h2>My Cards ({cards.length})</h2>
                      {cards.length === 0 ? (
                        <p style={{ color: "#666", textAlign: "center", padding: "20px" }}>
                          No cards yet. Open a pack to get started!
                        </p>
                      ) : (
                        <div className="trading-cards-grid">
                          {cards.map(card => {
                            const balance = parseInt(card.balance);
                            const isSelected = selectedCards.includes(card.id);
                            
                            return (
                              <div
                                key={card.id}
                                className={`trading-card-container rarity-${card.rarity} ${isSelected ? 'selected' : ''}`}
                                onClick={() => toggleCard(card.id)}
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
                                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: 'white',
                                            fontSize: '18px',
                                            fontWeight: 'bold'
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
                      )}
                    </div>
                  </div>

                  {/* Right: Submit Prediction */}
                  <div className="column-right">
                    <div className="card">
                      <h2>⚡ Submit Prediction</h2>
                      <p style={{ fontSize: "14px", color: "#666", marginBottom: "16px" }}>
                        Select a match and use your cards to make a prediction
                      </p>
                      
                      <div style={{ marginBottom: "16px" }}>
                        <label style={{ display: "block", marginBottom: "8px", fontWeight: "600" }}>Select Match</label>
                        <select
                          value={selectedMatch}
                          onChange={(e) => setSelectedMatch(e.target.value)}
                          style={{ width: "100%" }}
                        >
                          <option value="">Choose a match...</option>
                          {matches
                            .filter(m => m.status === "Pending" || m.statusNum === 0)
                            .map(match => (
                              <option key={match.id} value={match.id}>
                                {match.teamA} vs {match.teamB} (Match #{match.id})
                              </option>
                            ))}
                          {matches.filter(m => m.status === "Pending").length === 0 && hardcodedMatches.map(match => (
                            <option key={match.id} value={match.id}>
                              {match.teamA} vs {match.teamB} (May not exist - create first!)
                            </option>
                          ))}
                        </select>
                      </div>

                      {selectedCards.length > 0 && (
                        <div style={{ 
                          padding: "12px", 
                          background: "#f0f4ff", 
                          borderRadius: "8px", 
                          marginBottom: "16px" 
                        }}>
                          <p style={{ margin: "0 0 8px 0", fontWeight: "600" }}>
                            Selected Cards: {selectedCards.length}
                          </p>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                            {selectedCards.map(cardId => {
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
                        onClick={submitPrediction} 
                        disabled={loading || !selectedMatch || selectedCards.length === 0}
                        style={{ width: "100%" }}
                      >
                        {loading ? "Submitting..." : "Submit Prediction"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* My Predictions Section */}
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
                            <div>
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
                                    <div style={{ fontSize: "11px", color: "#666", marginTop: "4px" }}>
                                      {formatCardType(card.type)} • Rarity {card.rarity}
                                    </div>
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

          </>
        )}
      </div>
    </div>
  );
}

export default App;

