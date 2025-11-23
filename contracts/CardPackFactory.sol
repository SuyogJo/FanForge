// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title CardPackFactory
 * @dev ERC-1155 contract for minting player and match event cards
 */
contract CardPackFactory is ERC1155, Ownable {
    using Strings for uint256;

    enum CardType { Player, MatchEvent }
    
    struct Card {
        CardType cardType;
        string name;
        string description;
        uint256 rarity; // 1-5, 5 being rarest
    }

    mapping(uint256 => Card) public cards;
    uint256 public cardCount;
    uint256 public packPrice = 0.01 ether;
    mapping(address => uint256) public userPackNonce; // Nonce per user for better randomness
    
    // Card type probabilities (out of 100)
    uint256 public playerCardProbability = 60; // 60% chance for player card
    uint256 public matchEventProbability = 40; // 40% chance for match event card
    
    // Rarity probabilities (out of 100)
    uint256[5] public rarityProbabilities = [40, 30, 20, 8, 2]; // Common, Uncommon, Rare, Epic, Legendary
    
    // Predefined cards
    string[] public playerNames = [
        "Tom Brady", "Kylian Mbappe", "Lionel Messi", "Cristiano Ronaldo",
        "LeBron James", "Stephen Curry", "Patrick Mahomes", "Aaron Rodgers"
    ];
    
    string[] public matchEventNames = [
        "Red Card", "More Than 4 Goals", "Fight Breaks Out", 
        "More Than 4 Slap Shots", "Touchdown Pass 40+ Yards", 
        "Hat Trick", "Overtime", "Penalty Kick"
    ];

    event PackOpened(address indexed user, uint256 indexed cardId, CardType cardType, string name, uint256 rarity);
    event CardCreated(uint256 indexed cardId, CardType cardType, string name);

    constructor() ERC1155("https://fanforge.com/api/card/{id}.json") Ownable(msg.sender) {
        _initializeCards();
    }

    /**
     * @dev Initialize predefined cards
     */
    function _initializeCards() internal {
        // Initialize player cards
        for (uint256 i = 0; i < playerNames.length; i++) {
            cardCount++;
            cards[cardCount] = Card({
                cardType: CardType.Player,
                name: playerNames[i],
                description: string(abi.encodePacked("Player card: ", playerNames[i])),
                rarity: _determineRarity()
            });
            emit CardCreated(cardCount, CardType.Player, playerNames[i]);
        }
        
        // Initialize match event cards
        for (uint256 i = 0; i < matchEventNames.length; i++) {
            cardCount++;
            cards[cardCount] = Card({
                cardType: CardType.MatchEvent,
                name: matchEventNames[i],
                description: string(abi.encodePacked("Match event: ", matchEventNames[i])),
                rarity: _determineRarity()
            });
            emit CardCreated(cardCount, CardType.MatchEvent, matchEventNames[i]);
        }
    }

    /**
     * @dev Open a card pack - mints a random card
     */
    function openPack() external payable {
        require(msg.value >= packPrice, "Insufficient payment");
        
        // Increment user's pack nonce for better randomness
        userPackNonce[msg.sender]++;
        
        // Pseudo-random selection (for demo - in production use Chainlink VRF)
        // Include nonce to ensure uniqueness even in same block
        uint256 random = uint256(keccak256(abi.encodePacked(
            block.timestamp, 
            block.prevrandao, 
            msg.sender, 
            userPackNonce[msg.sender],
            cardCount,
            block.number
        )));
        
        // Determine card type
        uint256 typeRoll = random % 100;
        CardType selectedType = typeRoll < playerCardProbability ? CardType.Player : CardType.MatchEvent;
        
        // Select a card of the chosen type
        uint256 cardId = _selectRandomCard(selectedType, random);
        
        // Mint the card
        _mint(msg.sender, cardId, 1, "");
        
        Card memory card = cards[cardId];
        emit PackOpened(msg.sender, cardId, card.cardType, card.name, card.rarity);
    }

    /**
     * @dev Select a random card of the specified type
     */
    function _selectRandomCard(CardType cardType, uint256 random) internal view returns (uint256) {
        uint256[] memory matchingCards = new uint256[](cardCount);
        uint256 count = 0;
        
        for (uint256 i = 1; i <= cardCount; i++) {
            if (cards[i].cardType == cardType) {
                matchingCards[count] = i;
                count++;
            }
        }
        
        require(count > 0, "No cards of this type available");
        return matchingCards[random % count];
    }

    /**
     * @dev Determine rarity based on probabilities
     */
    function _determineRarity() internal view returns (uint256) {
        uint256 random = uint256(keccak256(abi.encodePacked(block.timestamp, block.prevrandao, cardCount)));
        uint256 roll = random % 100;
        uint256 cumulative = 0;
        
        for (uint256 i = 0; i < rarityProbabilities.length; i++) {
            cumulative += rarityProbabilities[i];
            if (roll < cumulative) {
                return i + 1; // Rarity 1-5
            }
        }
        return 1; // Default to common
    }

    /**
     * @dev Get card details
     */
    function getCard(uint256 cardId) external view returns (Card memory) {
        require(cardId > 0 && cardId <= cardCount, "Card does not exist");
        return cards[cardId];
    }

    /**
     * @dev Set pack price
     */
    function setPackPrice(uint256 _price) external onlyOwner {
        packPrice = _price;
    }

    /**
     * @dev Withdraw contract balance
     */
    function withdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }

    /**
     * @dev Override URI to return card metadata
     */
    function uri(uint256 tokenId) public view override returns (string memory) {
        require(tokenId > 0 && tokenId <= cardCount, "Card does not exist");
        Card memory card = cards[tokenId];
        
        // Return JSON metadata (simplified - in production use IPFS)
        return string(abi.encodePacked(
            '{"name":"', card.name, '",',
            '"description":"', card.description, '",',
            '"type":"', card.cardType == CardType.Player ? "Player" : "MatchEvent", '",',
            '"rarity":', card.rarity.toString(), '}'
        ));
    }
}

