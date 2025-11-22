const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("FanForge", function () {
  let cardPackFactory, fanNFT, predictionManager;
  let owner, user1, user2;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // Deploy CardPackFactory
    const CardPackFactory = await ethers.getContractFactory("CardPackFactory");
    cardPackFactory = await CardPackFactory.deploy();

    // Deploy DynamicFanNFT
    const DynamicFanNFT = await ethers.getContractFactory("DynamicFanNFT");
    fanNFT = await DynamicFanNFT.deploy("https://fanforge.com/api/nft");

    // Deploy PredictionManager
    const PredictionManager = await ethers.getContractFactory("PredictionManager");
    predictionManager = await PredictionManager.deploy(
      await cardPackFactory.getAddress(),
      await fanNFT.getAddress()
    );

    // Set PredictionManager in FanNFT
    await fanNFT.setPredictionManager(await predictionManager.getAddress());
  });

  describe("CardPackFactory", function () {
    it("Should open a pack and mint a card", async function () {
      const packPrice = await cardPackFactory.packPrice();
      await expect(
        cardPackFactory.connect(user1).openPack({ value: packPrice })
      ).to.emit(cardPackFactory, "PackOpened");

      // Check user has a card (check first few card IDs)
      let hasCard = false;
      for (let i = 1; i <= 20; i++) {
        try {
          const balance = await cardPackFactory.balanceOf(user1.address, i);
          if (balance > 0) {
            hasCard = true;
            break;
          }
        } catch (e) {
          // Card doesn't exist
        }
      }
      expect(hasCard).to.be.true;
    });

    it("Should reject opening pack without sufficient payment", async function () {
      await expect(
        cardPackFactory.connect(user1).openPack({ value: ethers.parseEther("0.001") })
      ).to.be.revertedWith("Insufficient payment");
    });
  });

  describe("DynamicFanNFT", function () {
    it("Should mint a Fan NFT", async function () {
      await expect(
        fanNFT.mintFanNFT(user1.address, "Lakers")
      ).to.emit(fanNFT, "FanNFTMinted");

      const stats = await fanNFT.getFanStats(user1.address);
      expect(stats.level).to.equal(1);
      expect(stats.teamName).to.equal("Lakers");
    });

    it("Should update stats after correct prediction", async function () {
      await fanNFT.mintFanNFT(user1.address, "Lakers");
      
      // Simulate 3 correct predictions
      for (let i = 0; i < 3; i++) {
        await fanNFT.updateFanStats(user1.address, true);
      }

      const stats = await fanNFT.getFanStats(user1.address);
      expect(stats.level).to.equal(2); // Level up after 3 correct
      expect(stats.correctPredictions).to.equal(3);
    });
  });

  describe("PredictionManager", function () {
    it("Should create a match", async function () {
      await expect(
        predictionManager.createMatch("Team A", "Team B", Math.floor(Date.now() / 1000) + 3600)
      ).to.emit(predictionManager, "MatchCreated");

      const match = await predictionManager.matches(1);
      expect(match.teamA).to.equal("Team A");
      expect(match.teamB).to.equal("Team B");
    });

    it("Should allow submitting a prediction", async function () {
      // Create match
      await predictionManager.createMatch("Team A", "Team B", Math.floor(Date.now() / 1000) + 3600);
      
      // Mint Fan NFT
      await fanNFT.mintFanNFT(user1.address, "Team A");
      
      // Open pack to get cards
      const packPrice = await cardPackFactory.packPrice();
      await cardPackFactory.connect(user1).openPack({ value: packPrice });
      
      // Find a card the user owns
      let cardId = 0;
      for (let i = 1; i <= 20; i++) {
        try {
          const balance = await cardPackFactory.balanceOf(user1.address, i);
          if (balance > 0) {
            cardId = i;
            break;
          }
        } catch (e) {
          // Continue
        }
      }

      if (cardId > 0) {
        // Approve PredictionManager to transfer cards
        await cardPackFactory.connect(user1).setApprovalForAll(await predictionManager.getAddress(), true);
        
        await expect(
          predictionManager.connect(user1).submitPrediction(1, [cardId])
        ).to.emit(predictionManager, "PredictionSubmitted");
      }
    });
  });
});

