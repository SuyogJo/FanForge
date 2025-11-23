// Contract addresses - Update these after deployment
export const CONTRACT_ADDRESSES = {
  CardPackFactory: "0x329da0F6a40aB518Df99D74B58D19ea9B06AD62B", // Redeployed with correct card types
  PredictionManager: "0x1Cc16D3f76463d5d7C1A3A46f664D10c8889b24D", // Updated with new CardPackFactory address
  DynamicFanNFT: "0x318f18cF6788F360205c8fb5c825306fD84362E7"
};

// Network configuration
// Chain ID: 88882 (0x15B38 in hex)
export const NETWORK_CONFIG = {
  chainId: "0x15B32", // 88882 in hex (Chiliz Spicy Testnet)
  chainName: "Chiliz Spicy Testnet",
  nativeCurrency: {
    name: "CHZ",
    symbol: "CHZ",
    decimals: 18
  },
  rpcUrls: ["https://spicy-rpc.chiliz.com"],
  blockExplorerUrls: ["https://testnet.chiliscan.com"]
};

// Manual MetaMask setup instructions (if automatic fails)
export const MANUAL_SETUP = {
  networkName: "Chiliz Spicy Testnet",
  rpcUrl: "https://spicy-rpc.chiliz.com",
  chainId: 88882,
  currencySymbol: "CHZ",
  blockExplorer: "https://testnet.chiliscan.com"
};

