// Contract addresses - Update these after deployment
export const CONTRACT_ADDRESSES = {
  CardPackFactory: "0xe2764c8E76FdC1FB5660452F57B12913Ff2bc533", // Update after deployment
  PredictionManager: "0x1230da4e6d7367f191CE88342B8C11c584b106C1", // Update after deployment
  DynamicFanNFT: "0x318f18cF6788F360205c8fb5c825306fD84362E7" // Updated with demo feature
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

