"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import tableStyles from "@/components/admin/AdminTable.module.css";
import styles from "./page.module.css";
import {
  decideKycApplication,
  fetchAdminKycApplications,
  formatSubmittedDate,
  getFileUrl,
} from "@/lib/kycApplications";
import type { KycApplication, KycStatus } from "@/types/kyc";

const STATUS_FILTERS: (KycStatus | "All")[] = [
  "All",
  "PENDING",
  "APPROVED",
  "REJECTED",
];

const STATUS_LABEL: Record<KycStatus, string> = {
  not_submitted: "Not submitted",
  PENDING: "Pending review",
  APPROVED: "Verified",
  REJECTED: "Rejected",
};

const DOCUMENT_LABEL: Record<KycApplication["documentType"], string> = {
  CITIZENSHIP: "Citizenship certificate",
  PASSPORT: "Passport",
  NATIONAL_ID: "National ID card",
  DRIVERS_LICENSE: "Driver's license",
};

export default function AdminKycPage() {
  const [applications, setApplications] = useState<KycApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<KycStatus | "All">("All");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [isDeciding, setIsDeciding] = useState(false);

  useEffect(() => {
    refresh();
  }, []);

  function refresh() {
    setIsLoading(true);
    fetchAdminKycApplications()
      .then(setApplications)
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Couldn't load applications."))
      .finally(() => setIsLoading(false));
  }

  const rows = useMemo(() => {
    return applications
      .filter((app) => statusFilter === "All" || app.status === statusFilter)
      .sort(
        (a, b) =>
          new Date(b.submittedAt ?? 0).getTime() -
          new Date(a.submittedAt ?? 0).getTime()
      );
  }, [applications, statusFilter]);

  const pendingCount = applications.filter((a) => a.status === "PENDING").length;

  function toggleExpanded(app: KycApplication) {
    if (expandedId === app.id) {
      setExpandedId(null);
      setNoteDraft("");
      setRejectError(null);
    } else {
      setExpandedId(app.id);
      setNoteDraft(app.rejectReason ?? "");
      setRejectError(null);
    }
  }

  async function decide(id: string, status: "APPROVED" | "REJECTED") {
    if (status === "REJECTED" && !noteDraft.trim()) {
      setRejectError("Add a note explaining why this application is being rejected.");
      return;
    }

    setIsDeciding(true);
    try {
      const updated = await decideKycApplication(id, status, noteDraft.trim() || undefined);
      setApplications((prev) => prev.map((app) => (app.id === id ? updated : app)));
      setExpandedId(null);
      setNoteDraft("");
      setRejectError(null);
    } catch (err) {
      setRejectError(err instanceof Error ? err.message : "Couldn't save the decision.");
    } finally {
      setIsDeciding(false);
    }
  }

  return (
    <div>
      <AdminPageHeader
        title="KYC review"
        description={`${pendingCount} application${
          pendingCount !== 1 ? "s" : ""
        } waiting on a decision.`}
      />

      <div className={tableStyles.toolbar}>
        <select
          className={tableStyles.filterSelect}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as KycStatus | "All")}
        >
          {STATUS_FILTERS.map((status) => (
            <option key={status} value={status}>
              {status === "All" ? "All statuses" : STATUS_LABEL[status]}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <p className={tableStyles.emptyState}>Loading applications…</p>
      ) : loadError ? (
        <p className={tableStyles.emptyState}>{loadError}</p>
      ) : (
        <div className={tableStyles.tableWrap}>
          {rows.length === 0 ? (
            <p className={tableStyles.emptyState}>No applications match that filter.</p>
          ) : (
            <table className={tableStyles.table}>
              <thead>
                <tr>
                  <th>Applicant</th>
                  <th>Document</th>
                  <th>Full legal name</th>
                  <th>Submitted</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((app) => (
                  <Fragment key={app.id}>
                    <tr>
                      <td>
                        <div>{app.userName}</div>
                        <div className={tableStyles.muted}>{app.userEmail}</div>
                      </td>
                      <td>
                        <div>{DOCUMENT_LABEL[app.documentType]}</div>
                        <div className={tableStyles.muted}>{app.documentNumber}</div>
                      </td>
                      <td>
                        {[app.firstName, app.middleName, app.lastName]
                          .filter(Boolean)
                          .join(" ")}
                      </td>
                      <td className={tableStyles.muted}>
                        {formatSubmittedDate(app.submittedAt)}
                      </td>
                      <td>
                        <span
                          className={tableStyles.tag}
                          data-tone={
                            app.status === "APPROVED"
                              ? "accepted"
                              : app.status === "REJECTED"
                                ? "declined"
                                : undefined
                          }
                        >
                          {STATUS_LABEL[app.status]}
                        </span>
                        {app.rejectReason && app.status !== "PENDING" && (
                          <div className={tableStyles.muted} title={app.rejectReason}>
                            {app.rejectReason}
                          </div>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className={styles.reviewBtn}
                          onClick={() => toggleExpanded(app)}
                        >
                          {expandedId === app.id ? "Close" : "Review"}
                        </button>
                      </td>
                    </tr>

                    {expandedId === app.id && (
                      <tr>
                        <td colSpan={6}>
                          <div className={styles.detailPanel}>
                            <div className={styles.fileRow}>
                              {app.documentFrontUrl && (
                                <a
                                  className={styles.fileChip}
                                  href={getFileUrl(app.documentFrontUrl)}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  📎 View front
                                </a>
                              )}
                              {app.documentBackUrl && (
                                <a
                                  className={styles.fileChip}
                                  href={getFileUrl(app.documentBackUrl)}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  📎 View back
                                </a>
                              )}
                              {app.selfieUrl && (
                                <a
                                  className={styles.fileChip}
                                  href={getFileUrl(app.selfieUrl)}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  📎 View selfie
                                </a>
                              )}
                            </div>

                            <label className={styles.noteLabel} htmlFor={`note-${app.id}`}>
                              Reviewer note (required to reject)
                            </label>
                            <textarea
                              id={`note-${app.id}`}
                              className={styles.noteInput}
                              rows={2}
                              value={noteDraft}
                              onChange={(e) => {
                                setNoteDraft(e.target.value);
                                if (rejectError) setRejectError(null);
                              }}
                              placeholder="e.g. Name mismatch, please resubmit."
                            />
                            {rejectError && expandedId === app.id && (
                              <p className={styles.rejectError}>{rejectError}</p>
                            )}

                            <div className={styles.decisionRow}>
                              <button
                                type="button"
                                className={styles.rejectBtn}
                                onClick={() => decide(app.id, "REJECTED")}
                                disabled={isDeciding}
                              >
                                Reject
                              </button>
                              <button
                                type="button"
                                className={styles.approveBtn}
                                onClick={() => decide(app.id, "APPROVED")}
                                disabled={isDeciding}
                              >
                                Approve
                              </button>
                            </div>
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
