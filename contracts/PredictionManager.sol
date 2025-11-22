// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "./CardPackFactory.sol";
import "./DynamicFanNFT.sol";

/**
 * @title PredictionManager
 * @dev Manages sports match predictions using cards
 */
contract PredictionManager is Ownable, ERC165, IERC1155Receiver {
    CardPackFactory public cardPackFactory;
    DynamicFanNFT public fanNFT;
    
    enum MatchStatus { Pending, Settled }
    
    struct Match {
        uint256 matchId;
        string teamA;
        string teamB;
        uint256 timestamp;
        MatchStatus status;
        MatchOutcome outcome;
    }
    
    struct MatchOutcome {
        bool redCard;
        bool moreThan4Goals;
        bool fightBreaksOut;
        bool moreThan4SlapShots;
        bool touchdownPass40Plus;
        bool hatTrick;
        bool overtime;
        bool penaltyKick;
        string winningTeam;
    }
    
    struct Prediction {
        address user;
        uint256 matchId;
        uint256[] cardIds;
        bool settled;
        bool correct;
    }
    
    mapping(uint256 => Match) public matches;
    mapping(uint256 => Prediction[]) public matchPredictions; // matchId => predictions
    mapping(address => uint256[]) public userPredictions; // user => prediction IDs
    mapping(uint256 => uint256) public predictionIdToMatch; // predictionId => matchId
    
    uint256 public matchCount;
    uint256 public predictionCount;
    
    event MatchCreated(uint256 indexed matchId, string teamA, string teamB);
    event PredictionSubmitted(uint256 indexed predictionId, address indexed user, uint256 indexed matchId, uint256[] cardIds);
    event MatchSettled(uint256 indexed matchId, MatchOutcome outcome);
    event PredictionSettled(uint256 indexed predictionId, address indexed user, bool correct);

    constructor(address _cardPackFactory, address _fanNFT) Ownable(msg.sender) {
        cardPackFactory = CardPackFactory(_cardPackFactory);
        fanNFT = DynamicFanNFT(_fanNFT);
    }

    /**
     * @dev Create a new match
     */
    function createMatch(
        string memory teamA,
        string memory teamB,
        uint256 timestamp
    ) external onlyOwner returns (uint256) {
        matchCount++;
        matches[matchCount] = Match({
            matchId: matchCount,
            teamA: teamA,
            teamB: teamB,
            timestamp: timestamp,
            status: MatchStatus.Pending,
            outcome: MatchOutcome({
                redCard: false,
                moreThan4Goals: false,
                fightBreaksOut: false,
                moreThan4SlapShots: false,
                touchdownPass40Plus: false,
                hatTrick: false,
                overtime: false,
                penaltyKick: false,
                winningTeam: ""
            })
        });
        
        emit MatchCreated(matchCount, teamA, teamB);
        return matchCount;
    }

    /**
     * @dev Submit a prediction using cards
     */
    function submitPrediction(
        uint256 matchId,
        uint256[] memory cardIds
    ) external returns (uint256) {
        require(matches[matchId].matchId != 0, "Match does not exist");
        require(matches[matchId].status == MatchStatus.Pending, "Match already settled");
        require(cardIds.length > 0, "Must submit at least one card");
        
        // Check user owns the cards and burn/lock them
        for (uint256 i = 0; i < cardIds.length; i++) {
            require(
                cardPackFactory.balanceOf(msg.sender, cardIds[i]) > 0,
                "User does not own this card"
            );
            // Lock the card by transferring to this contract
            cardPackFactory.safeTransferFrom(msg.sender, address(this), cardIds[i], 1, "");
        }
        
        predictionCount++;
        uint256 predictionId = predictionCount;
        
        Prediction memory prediction = Prediction({
            user: msg.sender,
            matchId: matchId,
            cardIds: cardIds,
            settled: false,
            correct: false
        });
        
        matchPredictions[matchId].push(prediction);
        userPredictions[msg.sender].push(predictionId);
        predictionIdToMatch[predictionId] = matchId;
        
        emit PredictionSubmitted(predictionId, msg.sender, matchId, cardIds);
        return predictionId;
    }

    /**
     * @dev Settle a match with the outcome
     */
    function settleMatch(uint256 matchId, MatchOutcome memory outcome) external onlyOwner {
        require(matches[matchId].matchId != 0, "Match does not exist");
        require(matches[matchId].status == MatchStatus.Pending, "Match already settled");
        
        matches[matchId].status = MatchStatus.Settled;
        matches[matchId].outcome = outcome;
        
        emit MatchSettled(matchId, outcome);
        
        // Settle all predictions for this match
        Prediction[] storage predictions = matchPredictions[matchId];
        for (uint256 i = 0; i < predictions.length; i++) {
            if (!predictions[i].settled) {
                _settlePrediction(matchId, i, outcome);
            }
        }
    }

    /**
     * @dev Settle an individual prediction
     */
    function _settlePrediction(
        uint256 matchId,
        uint256 predictionIndex,
        MatchOutcome memory outcome
    ) internal {
        Prediction storage prediction = matchPredictions[matchId][predictionIndex];
        require(!prediction.settled, "Prediction already settled");
        
        prediction.settled = true;
        
        // Check if prediction matches outcome
        bool isCorrect = _checkPredictionAccuracy(prediction.cardIds, outcome);
        prediction.correct = isCorrect;
        
        // Update fan NFT stats
        fanNFT.updateFanStats(prediction.user, isCorrect);
        
        uint256 predictionId = _getPredictionId(matchId, predictionIndex);
        emit PredictionSettled(predictionId, prediction.user, isCorrect);
    }

    /**
     * @dev Check if submitted cards match the match outcome
     */
    function _checkPredictionAccuracy(
        uint256[] memory cardIds,
        MatchOutcome memory outcome
    ) internal view returns (bool) {
        // Get card details and check if any match the outcome
        for (uint256 i = 0; i < cardIds.length; i++) {
            CardPackFactory.Card memory card = cardPackFactory.getCard(cardIds[i]);
            
            if (card.cardType == CardPackFactory.CardType.MatchEvent) {
                // Check if the match event occurred
                if (keccak256(bytes(card.name)) == keccak256(bytes("Red Card")) && outcome.redCard) {
                    return true;
                }
                if (keccak256(bytes(card.name)) == keccak256(bytes("More Than 4 Goals")) && outcome.moreThan4Goals) {
                    return true;
                }
                if (keccak256(bytes(card.name)) == keccak256(bytes("Fight Breaks Out")) && outcome.fightBreaksOut) {
                    return true;
                }
                if (keccak256(bytes(card.name)) == keccak256(bytes("More Than 4 Slap Shots")) && outcome.moreThan4SlapShots) {
                    return true;
                }
                if (keccak256(bytes(card.name)) == keccak256(bytes("Touchdown Pass 40+ Yards")) && outcome.touchdownPass40Plus) {
                    return true;
                }
                if (keccak256(bytes(card.name)) == keccak256(bytes("Hat Trick")) && outcome.hatTrick) {
                    return true;
                }
                if (keccak256(bytes(card.name)) == keccak256(bytes("Overtime")) && outcome.overtime) {
                    return true;
                }
                if (keccak256(bytes(card.name)) == keccak256(bytes("Penalty Kick")) && outcome.penaltyKick) {
                    return true;
                }
            }
        }
        
        return false;
    }

    /**
     * @dev Get prediction ID from match and index
     */
    function _getPredictionId(uint256 matchId, uint256 index) internal view returns (uint256) {
        uint256 id = 1;
        for (uint256 i = 1; i < matchId; i++) {
            id += matchPredictions[i].length;
        }
        return id + index;
    }

    /**
     * @dev Get user's predictions
     */
    function getUserPredictions(address user) external view returns (uint256[] memory) {
        return userPredictions[user];
    }

    /**
     * @dev Get match predictions
     */
    function getMatchPredictions(uint256 matchId) external view returns (Prediction[] memory) {
        return matchPredictions[matchId];
    }

    /**
     * @dev ERC1155 Receiver implementation
     */
    function onERC1155Received(
        address,
        address,
        uint256,
        uint256,
        bytes memory
    ) public pure override returns (bytes4) {
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address,
        address,
        uint256[] memory,
        uint256[] memory,
        bytes memory
    ) public pure override returns (bytes4) {
        return this.onERC1155BatchReceived.selector;
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC165, IERC165) returns (bool) {
        return interfaceId == type(IERC1155Receiver).interfaceId || super.supportsInterface(interfaceId);
    }
}

