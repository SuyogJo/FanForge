// Contract addresses - Update these after deployment
export const CONTRACT_ADDRESSES = {
  CardPackFactory: "0xc4Ac7F2649216f1A82d9c6A261D072440127d094", // Redeployed with packPrice = 1 CHZ and proper card initialization
  PredictionManager: "0xB868DdF537F1d219E86419E4e269a65555349d97", // Redeployed with new CardPackFactory address
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

