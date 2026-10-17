require("@nomicfoundation/hardhat-toolbox");

/**
 * Land Chain - Hardhat configuration
 * We only need the local Hardhat network for development/testing.
 */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
  },
};
