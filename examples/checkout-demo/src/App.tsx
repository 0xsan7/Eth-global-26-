import { useState } from "react";
import {
  useAccount,
  useChainId,
  useConnect,
  useDisconnect,
  usePublicClient,
  useSignMessage,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import { erc20Abi } from "viem";
import { checkoutAbi } from "../../../src/lib/shared/checkout-abi";
import type { Hex, JobSummary, JobView } from "../../../src/lib/shared/domain";
import { sameAddress } from "../../../src/lib/shared/validation";
import { api, ApiError } from "../../../src/lib/client/api-client";
// Buyer checkout runs on Whitechain (common contract §4).
const WHITECHAIN_ID = 1874;

// COPY NOTE: DemoPay below is a minimal standalone copy of
// src/components/checkout/ToolCityPay.tsx (same allowance -> approve exact
// amount -> purchase -> verify-payment with backoff on 202 sequence). It is
// duplicated — not imported — so this demo keeps exactly one copy of react and
// wagmi. Keep the two in sync when the checkout sequence changes.

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isUserRejection(e: unknown): boolean {
  const code = (e as { code?: unknown }).code;
  if (code === 4001) return true;
  const name = (e as { name?: unknown }).name;
  return typeof name === "string" && name.includes("UserRejected");
}

function DemoPay({ job, onJobChange }: { job: JobView; onJobChange: (j: JobView) => void }) {
  const { address } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient({ chainId: WHITECHAIN_ID });
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const [phase, setPhase] = useState("idle");
  const [error, setError] = useState<string | null>(null);

  const terms = job.terms;
  const payable = job.status === "awaiting_payment" || job.status === "payment_pending";
  const isBuyer = !!address && sameAddress(address, job.buyerAddress);
  const busy = phase !== "idle" && phase !== "done" && phase !== "error";

  async function handlePay() {
    if (busy) return;
    setError(null);
    try {
      if (!address || !sameAddress(address, job.buyerAddress)) {
        setPhase("error");
        setError("Connect the buyer wallet for this job first.");
        return;
      }
      if (!payable) {
        setPhase("error");
        setError(`Job is ${job.status}; reload the saved job instead of repaying.`);
        return;
      }
      const amount = BigInt(terms.amountAtomic);
      if (chainId !== terms.chainId) {
        setPhase("switching");
        await switchChainAsync({ chainId: terms.chainId });
      }
      if (!publicClient) throw new Error("Whitechain client unavailable; reconnect and retry.");
      const allowance = (await publicClient.readContract({
        address: terms.tokenAddress,
        abi: erc20Abi,
        functionName: "allowance",
        args: [job.buyerAddress, terms.checkoutAddress],
      })) as bigint;
      if (allowance < amount) {
        setPhase("approving");
        const approveHash = await writeContractAsync({
          address: terms.tokenAddress,
          abi: erc20Abi,
          functionName: "approve",
          args: [terms.checkoutAddress, amount],
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }
      setPhase("purchasing");
      const txHash = await writeContractAsync({
        address: terms.checkoutAddress,
        abi: checkoutAbi,
        functionName: "purchase",
        args: [job.id, terms.serviceId, amount, terms.termsHash],
      });
      setPhase("verifying");
      let result = await api.verifyPayment(job.id, txHash);
      for (const wait of [1000, 2000, 4000, 8000]) {
        if (!result.pending) break;
        await sleep(wait);
        result = await api.verifyPayment(job.id, txHash);
      }
      setPhase("done");
      onJobChange(result.job);
    } catch (e) {
      setPhase("error");
      if (e instanceof ApiError) setError(`Server (${e.code}): ${e.message}`);
      else if (isUserRejection(e)) setError("Declined in wallet. Nothing was recorded; retry when ready.");
      else setError(e instanceof Error ? e.message : "Payment failed.");
    }
  }

  return (
    <section aria-label="Demo checkout">
      <p>
        Price: {terms.amountAtomic} (atomic, {terms.tokenDecimals} decimals) · buyer{" "}
        {job.buyerAddress}
      </p>
      {!payable && <p>Job status is {job.status}; no payment action is available.</p>}
      {(payable || phase === "error") && (
        <button type="button" disabled={busy || !isBuyer} onClick={handlePay}>
          {phase === "idle" ? "Pay with test USDT" : phase}
        </button>
      )}
      {address && !isBuyer && <p role="alert">Connected wallet is not this job&apos;s buyer.</p>}
      {phase === "error" && error && <p role="alert">{error}</p>}
      {phase === "done" && <p role="status">Payment recorded on the server job.</p>}
    </section>
  );
}

export default function App() {
  const { address, isConnected } = useAccount();
  const { connectors, connect } = useConnect();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const [session, setSession] = useState<string | null>(null);
  const [entityKey, setEntityKey] = useState("");
  const [text, setText] = useState("");
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [job, setJob] = useState<JobView | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function login() {
    if (!address) return;
    try {
      const ch = await api.challenge(address);
      const sig = await signMessageAsync({ message: ch.message });
      const verified = await api.verify(ch.challengeId, sig);
      setSession(verified.address);
      setNote(null);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Login failed.");
    }
  }

  async function refreshJobs() {
    try {
      setJobs(await api.listJobs());
      setNote(null);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not list jobs.");
    }
  }

  async function createJob() {
    try {
      const created = await api.createJob(entityKey.trim() as Hex, text);
      setJob(created);
      setNote(null);
      await refreshJobs();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not create job.");
    }
  }

  async function openJob(id: Hex) {
    try {
      setJob(await api.getJob(id));
      setNote(null);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not open job.");
    }
  }

  return (
    <main style={{ padding: "1rem", maxWidth: "48rem", margin: "0 auto", fontFamily: "system-ui" }}>
      <h1>Tool City — Checkout Demo</h1>
      <p>Standalone embed: create or select a genuine job, then pay with the shared checkout ABI.</p>

      {!isConnected ? (
        connectors.map((c) => (
          <button key={c.uid} type="button" onClick={() => connect({ connector: c })}>
            Connect {c.name}
          </button>
        ))
      ) : (
        <p>
          {address} <button type="button" onClick={() => disconnect()}>Disconnect</button>{" "}
          <button type="button" onClick={login}>Log in</button>
          {session && <span> · session: {session}</span>}
        </p>
      )}

      <h2>1. Create or select a job</h2>
      <label>
        Workshop entity key{" "}
        <input value={entityKey} onChange={(e) => setEntityKey(e.target.value)} size={70} />
      </label>
      <br />
      <label>
        Text (EN) <br />
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} cols={70} />
      </label>
      <br />
      <button type="button" onClick={createJob}>Create job</button>{" "}
      <button type="button" onClick={refreshJobs}>Refresh my jobs</button>
      <ul>
        {jobs.map((j) => (
          <li key={j.id}>
            <button type="button" onClick={() => openJob(j.id)}>
              {j.id.slice(0, 12)}… ({j.status})
            </button>
          </li>
        ))}
      </ul>

      {job && (
        <>
          <h2>2. Pay</h2>
          <DemoPay job={job} onJobChange={setJob} />
          <p>
            Status: {job.status}
            {job.payment && ` · tx ${job.payment.txHash} (${job.payment.status})`}
          </p>
        </>
      )}
      {note && <p role="alert">{note}</p>}
    </main>
  );
}
