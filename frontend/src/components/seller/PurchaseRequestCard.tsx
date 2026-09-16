"use client";

import Button from "@/components/ui/Button";
import type { PurchaseRequest } from "@/types/purchase-request";
import { formatRequestDate } from "@/lib/purchaseRequests";
import styles from "./PurchaseRequestCard.module.css";

interface PurchaseRequestCardProps {
  request: PurchaseRequest;
  onAccept: () => void;
  onDecline: () => void;
}

export default function PurchaseRequestCard({
  request,
  onAccept,
  onDecline,
}: PurchaseRequestCardProps) {
  const initials = request.buyerName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <article className={styles.card}>
      <div className={styles.top}>
        <div className={styles.buyer}>
          <span className={styles.avatar}>{initials}</span>
          <div>
            <p className={styles.buyerName}>{request.buyerName}</p>
            <p className={styles.buyerEmail}>{request.buyerEmail}</p>
          </div>
        </div>

        <div className={styles.right}>
          {request.offerPrice !== null && (
            <span className={styles.offer}>
              {new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
                maximumFractionDigits: 0,
              }).format(request.offerPrice)}
            </span>
          )}
          <span className={styles.date}>
            {formatRequestDate(request.submittedAt)}
          </span>
        </div>
      </div>

      <p className={styles.message}>{request.message}</p>

      {request.documents && request.documents.length > 0 && (
        <ul className={styles.attachments}>
          {request.documents.map((doc) => (
            <li key={doc.id} className={styles.attachment}>
              📎 {doc.name}
            </li>
          ))}
        </ul>
      )}

      <div className={styles.footer}>
        <span className={styles.statusTag} data-status={request.status}>
          {request.status}
        </span>

        {request.status === "Pending" && (
          <div className={styles.actions}>
            <Button
              type="button"
              variant="secondary"
              className={styles.declineBtn}
              onClick={onDecline}
            >
              Decline
            </Button>
            <Button type="button" onClick={onAccept}>
              Accept
            </Button>
          </div>
        )}
      </div>
    </article>
  );
}
