"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import tableStyles from "@/components/admin/AdminTable.module.css";
import { MOCK_PROPERTIES } from "@/lib/properties";
import {
  MOCK_PURCHASE_REQUESTS,
  formatRequestDate,
} from "@/lib/purchaseRequests";
import type { PurchaseRequest, PurchaseRequestStatus } from "@/types/purchase-request";

const STATUS_FILTERS: (PurchaseRequestStatus | "All")[] = [
  "All",
  "Pending",
  "Accepted",
  "Declined",
];

export default function AdminRequestsPage() {
  const [requests, setRequests] = useState<PurchaseRequest[]>(MOCK_PURCHASE_REQUESTS);
  const [statusFilter, setStatusFilter] = useState<PurchaseRequestStatus | "All">("All");

  const rows = useMemo(() => {
    return requests
      .filter((r) => statusFilter === "All" || r.status === statusFilter)
      .map((request) => ({
        ...request,
        property: MOCK_PROPERTIES.find((p) => p.id === request.propertyId),
      }))
      .sort(
        (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
      );
  }, [requests, statusFilter]);

  function updateStatus(id: string, status: PurchaseRequestStatus) {
    // Mocked — no admin/requests endpoint exists yet, see
    // lib/purchaseRequests.ts for where the real PATCH call would go.
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
  }

  return (
    <div>
      <AdminPageHeader
        title="Purchase requests"
        description={`${requests.length} request${
          requests.length !== 1 ? "s" : ""
        } sent across all listings.`}
      />

      <div className={tableStyles.toolbar}>
        <select
          className={tableStyles.filterSelect}
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as PurchaseRequestStatus | "All")
          }
        >
          {STATUS_FILTERS.map((status) => (
            <option key={status} value={status}>
              {status === "All" ? "All statuses" : status}
            </option>
          ))}
        </select>
      </div>

      <div className={tableStyles.tableWrap}>
        {rows.length === 0 ? (
          <p className={tableStyles.emptyState}>No requests match that filter.</p>
        ) : (
          <table className={tableStyles.table}>
            <thead>
              <tr>
                <th>Buyer</th>
                <th>Property</th>
                <th>Seller</th>
                <th>Offer</th>
                <th>Docs</th>
                <th>Submitted</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((request) => (
                <tr key={request.id}>
                  <td>
                    <div>{request.buyerName}</div>
                    <div className={tableStyles.muted}>{request.buyerEmail}</div>
                  </td>
                  <td>
                    {request.property ? (
                      <Link
                        href={`/property/${request.property.id}`}
                        className={tableStyles.rowLink}
                      >
                        {request.property.title}
                      </Link>
                    ) : (
                      <span className={tableStyles.muted}>Removed listing</span>
                    )}
                  </td>
                  <td>{request.property?.ownerName ?? "—"}</td>
                  <td>
                    {request.offerPrice !== null
                      ? new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency: "USD",
                          maximumFractionDigits: 0,
                        }).format(request.offerPrice)
                      : "—"}
                  </td>
                  <td className={tableStyles.muted}>
                    {request.documents?.length
                      ? `${request.documents.length} file${
                          request.documents.length !== 1 ? "s" : ""
                        }`
                      : "—"}
                  </td>
                  <td className={tableStyles.muted}>
                    {formatRequestDate(request.submittedAt)}
                  </td>
                  <td>
                    <select
                      className={tableStyles.statusSelect}
                      value={request.status}
                      onChange={(e) =>
                        updateStatus(
                          request.id,
                          e.target.value as PurchaseRequestStatus
                        )
                      }
                    >
                      <option value="Pending">Pending</option>
                      <option value="Accepted">Accepted</option>
                      <option value="Declined">Declined</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
