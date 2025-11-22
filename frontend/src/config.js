// Contract addresses - Update these after deployment
export const CONTRACT_ADDRESSES = {
  CardPackFactory: "0xe2764c8E76FdC1FB5660452F57B12913Ff2bc533", // Update after deployment
  PredictionManager: "0x942E28eF94DE197f26D784408010BbF7019Af331", // Update after deployment
  DynamicFanNFT: "0x685B23A3AB0eBee8fBaB0D55108853BFCC27f51d" // Update after deployment
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

