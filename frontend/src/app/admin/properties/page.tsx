"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import tableStyles from "@/components/admin/AdminTable.module.css";
import styles from "./page.module.css";
import {
  dispatchProperty,
  fetchReviewDetail,
  fetchReviewQueue,
  rejectProperty,
  verifyProperty,
} from "@/lib/government";
import {
  STATUS_LABEL,
  describeDocument,
  formatPrice,
  openPropertyDocument,
} from "@/lib/properties";
import { formatSubmittedDate } from "@/lib/kycApplications";
import type { Property, StatusLogEntry, VerificationStatus } from "@/types/property";

const STATUS_FILTERS: VerificationStatus[] = [
  "PENDING",
  "DISPATCHED",
  "VERIFIED",
  "MINTED",
  "REJECTED",
];

export default function AdminPropertiesPage() {
  const [statusFilter, setStatusFilter] = useState<VerificationStatus>("PENDING");
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [history, setHistory] = useState<StatusLogEntry[]>([]);
  const [refDraft, setRefDraft] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [isActing, setIsActing] = useState(false);

  function refresh(status: VerificationStatus = statusFilter) {
    setIsLoading(true);
    setLoadError(null);
    fetchReviewQueue(status)
      .then(setProperties)
      .catch((err) => {
        setProperties([]);
        setLoadError(err instanceof Error ? err.message : "Couldn't load properties.");
      })
      .finally(() => setIsLoading(false));
  }

  useEffect(() => {
    setExpandedId(null);
    refresh(statusFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return properties.filter(
      (p) =>
        !q ||
        `${p.title} ${p.ownerName} ${p.city} ${p.landRegistrationNumber ?? ""}`.toLowerCase().includes(q)
    );
  }, [properties, query]);

  function toggleExpanded(property: Property) {
    if (expandedId === property.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(property.id);
    setRefDraft("");
    setNoteDraft("");
    setActionError(null);
    setHistory([]);
    fetchReviewDetail(property.id)
      .then((d) => setHistory(d.history))
      .catch(() => undefined); // history is a nicety; the actions don't depend on it
  }

  async function act(fn: () => Promise<Property>) {
    setIsActing(true);
    setActionError(null);
    try {
      await fn();
      setExpandedId(null);
      refresh(); // the property has left this status column, so reload the list
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Couldn't save that action.");
    } finally {
      setIsActing(false);
    }
  }

  const handleDispatch = (p: Property) => act(() => dispatchProperty(p.id, noteDraft.trim() || undefined));

  function handleVerify(p: Property) {
    if (!refDraft.trim()) {
      setActionError("Enter the government reference number to verify this property.");
      return;
    }
    return act(() => verifyProperty(p.id, refDraft.trim(), noteDraft.trim() || undefined));
  }

  function handleReject(p: Property) {
    if (!noteDraft.trim()) {
      setActionError("Add a note explaining why this property is being rejected.");
      return;
    }
    return act(() => rejectProperty(p.id, noteDraft.trim()));
  }

  return (
    <div>
      <AdminPageHeader
        title="Property verification"
        description="Review seller ownership documents, then dispatch, verify or reject each listing."
      />

      <div className={tableStyles.toolbar}>
        <input
          type="text"
          className={tableStyles.searchInput}
          placeholder="Search by title, owner, city, or land reg. no…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className={tableStyles.filterSelect}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as VerificationStatus)}
        >
          {STATUS_FILTERS.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABEL[status]}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <p className={tableStyles.emptyState}>Loading properties…</p>
      ) : loadError ? (
        <p className={tableStyles.emptyState}>{loadError}</p>
      ) : (
        <div className={tableStyles.tableWrap}>
          {rows.length === 0 ? (
            <p className={tableStyles.emptyState}>
              No {STATUS_LABEL[statusFilter].toLowerCase()} properties
              {query ? " match that search" : ""}.
            </p>
          ) : (
            <table className={tableStyles.table}>
              <thead>
                <tr>
                  <th>Property</th>
                  <th>Seller</th>
                  <th>Type</th>
                  <th>Land reg. no.</th>
                  <th>Price</th>
                  <th>Submitted</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((property) => (
                  <Fragment key={property.id}>
                    <tr>
                      <td>
                        <Link href={`/property/${property.id}`} className={tableStyles.rowLink}>
                          {property.title}
                        </Link>
                        <div className={tableStyles.muted}>{property.city}</div>
                      </td>
                      <td>{property.ownerName}</td>
                      <td>{property.type}</td>
                      <td className={tableStyles.muted}>{property.landRegistrationNumber ?? "—"}</td>
                      <td>{formatPrice(property.price, property.status)}</td>
                      <td className={tableStyles.muted}>{formatSubmittedDate(property.createdAt)}</td>
                      <td>
                        <span
                          className={tableStyles.tag}
                          data-tone={
                            property.verificationStatus === "VERIFIED" || property.verificationStatus === "MINTED"
                              ? "accepted"
                              : property.verificationStatus === "REJECTED"
                                ? "declined"
                                : undefined
                          }
                        >
                          {STATUS_LABEL[property.verificationStatus]}
                        </span>
                      </td>
                      <td>
                        <button type="button" className={styles.reviewBtn} onClick={() => toggleExpanded(property)}>
                          {expandedId === property.id ? "Close" : "Review"}
                        </button>
                      </td>
                    </tr>

                    {expandedId === property.id && (
                      <tr>
                        <td colSpan={8}>
                          <div className={styles.detailPanel}>
                            <div className={styles.metaGrid}>
                              <div>
                                <span className={styles.metaLabel}>Address</span>
                                <span className={styles.metaValue}>
                                  {[property.address, property.city, property.zip].filter(Boolean).join(", ")}
                                </span>
                              </div>
                              <div>
                                <span className={styles.metaLabel}>Area</span>
                                <span className={styles.metaValue}>{property.areaSqm} m²</span>
                              </div>
                              <div>
                                <span className={styles.metaLabel}>Land registration no.</span>
                                <span className={styles.metaValue}>{property.landRegistrationNumber ?? "—"}</span>
                              </div>
                              {property.governmentRefNumber && (
                                <div>
                                  <span className={styles.metaLabel}>Government ref.</span>
                                  <span className={styles.metaValue}>{property.governmentRefNumber}</span>
                                </div>
                              )}
                              {property.rejectReason && (
                                <div>
                                  <span className={styles.metaLabel}>Rejection reason</span>
                                  <span className={styles.metaValue}>{property.rejectReason}</span>
                                </div>
                              )}
                              {property.tokenId && (
                                <div>
                                  <span className={styles.metaLabel}>NFT token</span>
                                  <span className={styles.metaValue}>#{property.tokenId}</span>
                                </div>
                              )}
                            </div>

                            {property.description && <p className={styles.description}>{property.description}</p>}

                            <span className={styles.sectionLabel}>Ownership documents</span>
                            <div className={styles.fileRow}>
                              {property.documents.length === 0 && <span className={tableStyles.muted}>None attached</span>}
                              {property.documents.map((doc) => {
                                const { label, fileName } = describeDocument(doc.originalName);
                                return (
                                  <button
                                    key={doc.id}
                                    type="button"
                                    className={styles.fileChipBtn}
                                    title={fileName}
                                    onClick={() =>
                                      openPropertyDocument(doc).catch((err) =>
                                        setActionError(err instanceof Error ? err.message : "Couldn't open that document.")
                                      )
                                    }
                                  >
                                    📎 {label} — {fileName}
                                  </button>
                                );
                              })}
                            </div>

                            {history.length > 0 && (
                              <>
                                <span className={styles.sectionLabel}>History</span>
                                <ul className={styles.history}>
                                  {history.map((h) => (
                                    <li key={h.id}>
                                      <strong>
                                        {h.fromStatus ? `${STATUS_LABEL[h.fromStatus]} → ` : ""}
                                        {STATUS_LABEL[h.toStatus]}
                                      </strong>{" "}
                                      · {formatSubmittedDate(h.createdAt)}
                                      {h.note ? ` · ${h.note}` : ""}
                                    </li>
                                  ))}
                                </ul>
                              </>
                            )}

                            {(property.verificationStatus === "PENDING" || property.verificationStatus === "DISPATCHED") && (
                              <>
                                {property.verificationStatus === "DISPATCHED" && (
                                  <>
                                    <label className={styles.noteLabel} htmlFor={`ref-${property.id}`}>
                                      Government reference number (required to verify)
                                    </label>
                                    <input
                                      id={`ref-${property.id}`}
                                      className={styles.refInput}
                                      value={refDraft}
                                      onChange={(e) => {
                                        setRefDraft(e.target.value);
                                        if (actionError) setActionError(null);
                                      }}
                                      placeholder="e.g. REG-2026-004512"
                                    />
                                  </>
                                )}

                                <label className={styles.noteLabel} htmlFor={`note-${property.id}`}>
                                  {property.verificationStatus === "PENDING"
                                    ? "Note (optional to dispatch, required to reject)"
                                    : "Note (optional to verify, required to reject)"}
                                </label>
                                <textarea
                                  id={`note-${property.id}`}
                                  className={styles.noteInput}
                                  rows={2}
                                  value={noteDraft}
                                  onChange={(e) => {
                                    setNoteDraft(e.target.value);
                                    if (actionError) setActionError(null);
                                  }}
                                  placeholder="e.g. Deed matches registry records."
                                />
                              </>
                            )}

                            {actionError && expandedId === property.id && (
                              <p className={styles.rejectError}>{actionError}</p>
                            )}

                            {property.verificationStatus === "PENDING" && (
                              <div className={styles.decisionRow}>
                                <button type="button" className={styles.rejectBtn} onClick={() => handleReject(property)} disabled={isActing}>
                                  Reject
                                </button>
                                <button type="button" className={styles.dispatchBtn} onClick={() => handleDispatch(property)} disabled={isActing}>
                                  Dispatch for verification
                                </button>
                              </div>
                            )}

                            {property.verificationStatus === "DISPATCHED" && (
                              <div className={styles.decisionRow}>
                                <button type="button" className={styles.rejectBtn} onClick={() => handleReject(property)} disabled={isActing}>
                                  Reject
                                </button>
                                <button type="button" className={styles.approveBtn} onClick={() => handleVerify(property)} disabled={isActing}>
                                  Verify ownership
                                </button>
                              </div>
                            )}

                            {(property.verificationStatus === "VERIFIED" ||
                              property.verificationStatus === "MINTING" ||
                              property.verificationStatus === "MINTED" ||
                              property.verificationStatus === "REJECTED") && (
                              <p className={styles.readOnlyNote}>
                                No further government action is needed for this property.
                              </p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
