// Read-only reconciliation; this does not submit source code to an explorer.
// MERCHANT_ADDRESS=0x... CHECKOUT_ADDRESS=0x... npx hardhat run scripts/verify-deployment.ts --network whitechainSepolia
import { network } from "hardhat";
import { decimalsAbi, requiredAddress, SERVICE_ID, termsHash, TOKEN } from "./checkout-parameters.js";

const { viem } = await network.create();
const client = await viem.getPublicClient();
if (await client.getChainId() !== 1874) throw new Error("Expected Whitechain Sepolia chain ID 1874");
const address = requiredAddress("CHECKOUT_ADDRESS");
const merchant = requiredAddress("MERCHANT_ADDRESS");
if (!await client.getCode({ address }) || !await client.getCode({ address: TOKEN })) throw new Error("Checkout or token has no code");
const decimals = await client.readContract({ address: TOKEN, abi: decimalsAbi, functionName: "decimals" });
if (decimals > 77) throw new Error("Token decimals exceed uint256 price capacity");
const amount = 10n ** BigInt(decimals);
const hash = await termsHash();
const checkout = await viem.getContractAt("ToolCityCheckout", address);
const [actualToken, actualMerchant, actualService, actualAmount, actualTerms] = await Promise.all([
  checkout.read.token(), checkout.read.merchant(), checkout.read.serviceId(), checkout.read.amount(), checkout.read.termsHash(),
]);
if (typeof actualToken !== "string" || typeof actualMerchant !== "string"
    || actualToken.toLowerCase() !== TOKEN.toLowerCase() || actualMerchant.toLowerCase() !== merchant.toLowerCase()
    || actualService !== SERVICE_ID || actualAmount !== amount || actualTerms !== hash) {
  throw new Error("On-chain checkout configuration does not match expected values");
}
console.log(JSON.stringify({ chainId: 1874, checkoutAddress: address, tokenAddress: TOKEN, tokenDecimals: decimals, merchantAddress: merchant, serviceId: SERVICE_ID, amountAtomic: amount.toString(), termsHash: hash, reconciled: true }, null, 2));
console.log("Read reconciliation is not explorer source verification or settlement evidence. Verify the exact deployment build with the Hardhat verify command and review the explorer result separately.");
console.log(`Explorer source verification (use the exact compiler settings and build used to deploy): npx hardhat verify --network whitechainSepolia ${address} ${TOKEN} ${merchant} ${SERVICE_ID} ${amount} ${hash}`);
