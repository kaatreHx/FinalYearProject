"use client";

import { useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import {
  deleteProperty,
  describeDocument,
  fetchProperty,
  mintProperty,
  openPropertyDocument,
} from "@/lib/properties";
import type { Property, VerificationStatus } from "@/types/property";
import styles from "./VerificationPanel.module.css";

const STEPS = ["Submitted", "Government review", "Verified", "NFT minted"];

// Which step is "current" for each status (REJECTED is handled separately).
const CURRENT_STEP: Record<VerificationStatus, number> = {
  PENDING: 1,
  DISPATCHED: 1,
  VERIFIED: 2,
  MINTING: 3,
  MINTED: 4,
  REJECTED: 1,
};

interface VerificationPanelProps {
  property: Property;
  onUpdated: (property: Property) => void;
  onDeleted: (id: string) => void;
}

export default function VerificationPanel({ property, onUpdated, onDeleted }: VerificationPanelProps) {
  const status = property.verificationStatus;
  const [busy, setBusy] = useState<null | "mint" | "delete" | "refresh">(null);
  const [error, setError] = useState<string | null>(null);

  async function run<T>(kind: "mint" | "delete" | "refresh", fn: () => Promise<T>) {
    setBusy(kind);
    setError(null);
    try {
      return await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function handleMint() {
    const updated = await run("mint", () => mintProperty(property.id));
    if (updated) onUpdated(updated);
  }

  async function handleDelete() {
    if (!window.confirm(`Delete "${property.title}"? This can't be undone.`)) return;
    const ok = await run("delete", async () => {
      await deleteProperty(property.id);
      return true;
    });
    if (ok) onDeleted(property.id);
  }

  async function handleRefresh() {
    const updated = await run("refresh", () => fetchProperty(property.id));
    if (updated) onUpdated(updated);
  }

  const current = CURRENT_STEP[status];
  const rejected = status === "REJECTED";

  return (
    <section className={styles.panel}>
      <div className={styles.headerRow}>
        <h3 className={styles.heading}>Verification &amp; NFT</h3>
        <button type="button" className={styles.linkBtn} onClick={handleRefresh} disabled={busy !== null}>
          {busy === "refresh" ? "Refreshing…" : "Refresh status"}
        </button>
      </div>

      <ol className={styles.steps}>
        {STEPS.map((label, i) => {
          const state = rejected && i === 1 ? "rejected" : i < current ? "done" : i === current ? "current" : "todo";
          return (
            <li key={label} className={styles.step} data-state={state}>
              <span className={styles.stepDot}>{state === "done" ? "✓" : state === "rejected" ? "✕" : i + 1}</span>
              <span className={styles.stepLabel}>{label}</span>
            </li>
          );
        })}
      </ol>

      {status === "PENDING" && (
        <p className={styles.text}>
          Your listing is waiting for a government officer to pick it up. You can still delete it
          while it&apos;s pending.
        </p>
      )}

      {status === "DISPATCHED" && (
        <p className={styles.text}>The government is verifying your ownership documents right now.</p>
      )}

      {rejected && (
        <div className={styles.rejectBox}>
          <strong>Rejected by the government</strong>
          <p className={styles.text}>{property.rejectReason ?? "No reason was given."}</p>
          <p className={styles.text}>
            Delete this listing, fix the issue, and{" "}
            <Link href="/seller/new">list it again</Link> with corrected documents.
          </p>
        </div>
      )}

      {status === "VERIFIED" && (
        <div className={styles.mintBox}>
          <p className={styles.text}>
            ✓ Ownership verified
            {property.governmentRefNumber ? ` (ref ${property.governmentRefNumber})` : ""}. You can now mint
            this property as an NFT to your wallet.
          </p>
          {property.verificationNotes && <p className={styles.note}>“{property.verificationNotes}”</p>}

          <p className={styles.text}>
            Your registered blockchain wallet will be used automatically:
            <br />
            <span className={styles.mono}>{property.ownerWalletAddress ?? "Wallet will be assigned by the backend"}</span>
          </p>
          <Button type="button" onClick={handleMint} isLoading={busy === "mint"}>
            Mint NFT
          </Button>
        </div>
      )}

      {status === "MINTING" && (
        <p className={styles.text}>
          The mint transaction is in progress. This can take a minute — use “Refresh status” to check.
          {property.mintTxHash && (
            <>
              <br />
              <span className={styles.mono}>tx {property.mintTxHash}</span>
            </>
          )}
        </p>
      )}

      {status === "MINTED" && (
        <dl className={styles.facts}>
          <dt>Token ID</dt>
          <dd>{property.tokenId ?? "—"}</dd>
          <dt>Owner wallet</dt>
          <dd className={styles.mono}>{property.ownerWalletAddress ?? "—"}</dd>
          <dt>Contract</dt>
          <dd className={styles.mono}>{property.contractAddress ?? "—"}</dd>
          <dt>Transaction</dt>
          <dd className={styles.mono}>{property.mintTxHash ?? "—"}</dd>
        </dl>
      )}

      {property.documents.length > 0 && (
        <div className={styles.docs}>
          <span className={styles.label}>Your submitted documents</span>
          <div className={styles.docRow}>
            {property.documents.map((doc) => {
              const { label, fileName } = describeDocument(doc.originalName);
              return (
                <button
                  key={doc.id}
                  type="button"
                  className={styles.docChip}
                  title={fileName}
                  onClick={() =>
                    openPropertyDocument(doc).catch((err) =>
                      setError(err instanceof Error ? err.message : "Couldn't open that document.")
                    )
                  }
                >
                  📎 {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}

      {(status === "PENDING" || status === "REJECTED") && (
        <button type="button" className={styles.deleteBtn} onClick={handleDelete} disabled={busy !== null}>
          {busy === "delete" ? "Deleting…" : "Delete listing"}
        </button>
      )}
    </section>
  );
}
