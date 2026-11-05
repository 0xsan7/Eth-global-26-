import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { network } from "hardhat";
import { encodeFunctionData, keccak256, toBytes, zeroAddress } from "viem";
import { checkoutAbi } from "../../src/lib/shared/checkout-abi";

const { viem, networkHelpers } = await network.create();
const service = keccak256(toBytes("tool-city.service.translation.en-hi.v1"));
const terms = keccak256(toBytes("terms"));
const job = keccak256(toBytes("job"));
const other = keccak256(toBytes("other"));
const amount = 1_000_000n;
type Purchase = { buyer: `0x${string}`; serviceId: `0x${string}`; merchant: `0x${string}`; amount: bigint; termsHash: `0x${string}` };

async function setup() {
  const [deployer, buyer, buyer2, merchant] = await viem.getWalletClients();
  const token = await viem.deployContract("TestToken");
  const checkout = await viem.deployContract("ToolCityCheckout", [token.address, merchant.account.address, service, amount, terms]);
  for (const wallet of [buyer, buyer2]) {
    await token.write.mint([wallet.account.address, amount * 2n]);
    await token.write.approve([checkout.address, amount * 2n], { account: wallet.account });
  }
  return { deployer, buyer, buyer2, merchant, token, checkout, client: await viem.getPublicClient() };
}

describe("ToolCityCheckout", () => {
  it("settles to the merchant, stores the exact purchase and emits its receipt", async () => {
    const { buyer, merchant, token, checkout, client } = await networkHelpers.loadFixture(setup);
    const tx = await checkout.write.purchase([job, service, amount, terms], { account: buyer.account });
    const receipt = await client.waitForTransactionReceipt({ hash: tx });
    assert.equal(receipt.status, "success");
    const events = await checkout.getEvents.PurchaseMade({ buyer: buyer.account.address, jobId: job, serviceId: service }, { fromBlock: receipt.blockNumber, toBlock: receipt.blockNumber });
    assert.equal(events.length, 1);
    const event = events[0].args as { merchant: `0x${string}`; amount: bigint; termsHash: `0x${string}` };
    assert.equal(event.merchant.toLowerCase(), merchant.account.address.toLowerCase());
    assert.equal(event.amount, amount);
    assert.equal(event.termsHash, terms);
    assert.equal(await token.read.balanceOf([merchant.account.address]), amount);
    const p = await checkout.read.getPurchase([buyer.account.address, job]) as Purchase;
    assert.equal(p.buyer.toLowerCase(), buyer.account.address.toLowerCase());
    assert.equal(p.serviceId, service);
    assert.equal(p.merchant.toLowerCase(), merchant.account.address.toLowerCase());
    assert.equal(p.amount, amount);
    assert.equal(p.termsHash, terms);
  });

  it("rejects each mismatched expected term before moving tokens", async () => {
    const { buyer, merchant, token, checkout } = await networkHelpers.loadFixture(setup);
    for (const args of [[job, other, amount, terms], [job, service, amount + 1n, terms], [job, service, amount, other]] as const) {
      await assert.rejects(checkout.write.purchase(args, { account: buyer.account }), /TermsMismatch/);
    }
    assert.equal(await token.read.balanceOf([merchant.account.address]), 0n);
    assert.equal((await checkout.read.getPurchase([buyer.account.address, job]) as Purchase).buyer, zeroAddress);
  });

  it("rolls back the purchase and emits no success event when transfer returns false", async () => {
    const { buyer, merchant, token, checkout, client } = await networkHelpers.loadFixture(setup);
    await token.write.setFailTransfer([true]);
    const start = await client.getBlockNumber();
    await assert.rejects(checkout.write.purchase([job, service, amount, terms], { account: buyer.account }));
    assert.equal((await checkout.read.getPurchase([buyer.account.address, job]) as Purchase).buyer, zeroAddress);
    assert.equal(await token.read.balanceOf([merchant.account.address]), 0n);
    assert.equal((await checkout.getEvents.PurchaseMade({}, { fromBlock: start })).length, 0);
  });

  it("rejects a duplicate while allowing a second buyer the same job ID", async () => {
    const { buyer, buyer2, merchant, token, checkout } = await networkHelpers.loadFixture(setup);
    await checkout.write.purchase([job, service, amount, terms], { account: buyer.account });
    await assert.rejects(checkout.write.purchase([job, service, amount, terms], { account: buyer.account }), /AlreadyPurchased/);
    await checkout.write.purchase([job, service, amount, terms], { account: buyer2.account });
    assert.equal((await checkout.read.getPurchase([buyer2.account.address, job]) as Purchase).buyer.toLowerCase(), buyer2.account.address.toLowerCase());
    assert.equal(await token.read.balanceOf([merchant.account.address]), amount * 2n);
  });
  it("blocks reentrancy for the same buyer and job while settling once", async () => {
    const { merchant, token, checkout } = await networkHelpers.loadFixture(setup);
    await token.write.mint([token.address, amount * 2n]);
    const data = encodeFunctionData({ abi: checkoutAbi, functionName: "purchase", args: [job, service, amount, terms] });
    await token.write.attack([checkout.address, data, amount * 2n]);
    assert.equal(await token.read.reentryAttempted(), true);
    assert.equal(await token.read.reentrySucceeded(), false);
    assert.equal(await token.read.balanceOf([merchant.account.address]), amount);
    assert.equal((await checkout.getEvents.PurchaseMade({ buyer: token.address, jobId: job })).length, 1);
  });

});
