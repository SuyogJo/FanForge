// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title DynamicFanNFT
 * @dev ERC-721 NFT that dynamically updates based on prediction accuracy
 */
contract DynamicFanNFT is ERC721URIStorage, Ownable {
    struct FanStats {
        uint256 level;
        uint256 correctPredictions;
        uint256 totalPredictions;
        string teamName;
    }

    mapping(uint256 => FanStats) public fanStats;
    mapping(address => uint256) public userToTokenId;
    mapping(uint256 => bool) public tokenIdExists;
    
    string public baseURI;
    address public predictionManager;
    
    uint256 private _tokenIdCounter;
    
    event NFTLevelUp(uint256 indexed tokenId, uint256 newLevel, address indexed fan);
    event FanNFTMinted(address indexed fan, uint256 indexed tokenId, string teamName);

    constructor(string memory _baseURI) ERC721("FanForge Fan NFT", "FAN") Ownable(msg.sender) {
        baseURI = _baseURI;
    }

    /**
     * @dev Mint a new Fan NFT for a user
     */
    function mintFanNFT(address fan, string memory teamName) external onlyOwner returns (uint256) {
        require(userToTokenId[fan] == 0 || !tokenIdExists[userToTokenId[fan]], "Fan already has NFT");
        
        _tokenIdCounter++;
        uint256 tokenId = _tokenIdCounter;
        
        fanStats[tokenId] = FanStats({
            level: 1,
            correctPredictions: 0,
            totalPredictions: 0,
            teamName: teamName
        });
        
        userToTokenId[fan] = tokenId;
        tokenIdExists[tokenId] = true;
        
        _safeMint(fan, tokenId);
        _setTokenURI(tokenId, string(abi.encodePacked(baseURI, "/1.json")));
        
        emit FanNFTMinted(fan, tokenId, teamName);
        return tokenId;
    }

    /**
     * @dev Update fan stats after a prediction result
     */
    function updateFanStats(address fan, bool isCorrect) external {
        require(msg.sender == predictionManager, "Only PredictionManager can update");
        
        uint256 tokenId = userToTokenId[fan];
        require(tokenIdExists[tokenId], "Fan NFT does not exist");
        
        FanStats storage stats = fanStats[tokenId];
        stats.totalPredictions++;
        
        if (isCorrect) {
            stats.correctPredictions++;
            
            // Level up logic: every 3 correct predictions = +1 level
            uint256 newLevel = (stats.correctPredictions / 3) + 1;
            if (newLevel > stats.level) {
                stats.level = newLevel;
                _setTokenURI(tokenId, string(abi.encodePacked(baseURI, "/", _toString(newLevel), ".json")));
                emit NFTLevelUp(tokenId, newLevel, fan);
            }
        }
    }

    /**
     * @dev Get fan stats
     */
    function getFanStats(address fan) external view returns (FanStats memory) {
        uint256 tokenId = userToTokenId[fan];
        require(tokenIdExists[tokenId], "Fan NFT does not exist");
        return fanStats[tokenId];
    }

    /**
     * @dev Set the prediction manager address
     */
    function setPredictionManager(address _predictionManager) external onlyOwner {
        predictionManager = _predictionManager;
    }

    /**
     * @dev Update base URI
     */
    function setBaseURI(string memory _baseURI) external onlyOwner {
        baseURI = _baseURI;
    }

    /**
     * @dev Helper to convert uint to string
     */
    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}

