import { defineConfig } from "hardhat/config";
import hardhatToolboxViem from "@nomicfoundation/hardhat-toolbox-viem";
import "dotenv/config";

export default defineConfig({
  plugins: [hardhatToolboxViem],
  paths: { tests: { nodejs: "./contracts/test" } },
  solidity: { version: "0.8.30", settings: { evmVersion: "prague", optimizer: { enabled: true, runs: 200 } } },
  networks: {
    whitechainSepolia: {
      type: "http", chainType: "op", chainId: 1874,
      url: process.env.WHITECHAIN_RPC_URL ?? "https://rpc.testnet.whitechain.io",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
    },
  },
});
