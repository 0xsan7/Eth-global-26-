// Run only after reviewing and freezing config/service-terms.txt and confirming
// the official token, network, token decimals, merchant, and funded deployer.
// MERCHANT_ADDRESS=0x... npx hardhat run scripts/deploy-checkout.ts --network whitechainSepolia
import { network } from "hardhat";
import { decimalsAbi, requiredAddress, SERVICE_ID, termsHash, TOKEN } from "./checkout-parameters.js";

const { viem } = await network.create();
const client = await viem.getPublicClient();
if (await client.getChainId() !== 1874) throw new Error("Expected Whitechain Sepolia chain ID 1874");
if (!await client.getCode({ address: TOKEN })) throw new Error("Official token has no code at the configured address");
const decimals = await client.readContract({ address: TOKEN, abi: decimalsAbi, functionName: "decimals" });
if (decimals > 77) throw new Error("Token decimals exceed uint256 price capacity");
const amount = 10n ** BigInt(decimals); // exactly one token
const merchant = requiredAddress("MERCHANT_ADDRESS");
const hash = await termsHash();
const checkout = await viem.deployContract("ToolCityCheckout", [TOKEN, merchant, SERVICE_ID, amount, hash]);
console.log(JSON.stringify({ checkoutAddress: checkout.address, tokenAddress: TOKEN, tokenDecimals: decimals, merchantAddress: merchant, serviceId: SERVICE_ID, amountAtomic: amount.toString(), termsHash: hash }, null, 2));
console.log("Record the deployment transaction and block separately; run scripts/verify-deployment.ts and explorer source verification before configuring the app.");
