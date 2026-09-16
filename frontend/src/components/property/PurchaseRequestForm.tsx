"use client";

import { FormEvent, useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import DocumentUploader, {
  type UploadedDoc,
} from "@/components/shared/DocumentUploader";
import { createPurchaseRequest } from "@/lib/purchaseRequests";
import type { Property } from "@/types/property";
import styles from "./PurchaseRequestForm.module.css";

const BUYER_DOCUMENT_OPTIONS = [
  { value: "proof_of_funds", label: "Proof of funds" },
  { value: "government_id", label: "Government ID" },
  { value: "pre_approval_letter", label: "Pre-approval letter" },
  { value: "other", label: "Other" },
];

interface FormState {
  buyerName: string;
  buyerEmail: string;
  offerPrice: string;
  message: string;
}

const INITIAL_STATE: FormState = {
  buyerName: "",
  buyerEmail: "",
  offerPrice: "",
  message: "",
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface PurchaseRequestFormProps {
  property: Property;
}

export default function PurchaseRequestForm({ property }: PurchaseRequestFormProps) {
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [documents, setDocuments] = useState<UploadedDoc[]>([]);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const isRental = property.status === "For Rent";

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function validate(): boolean {
    const nextErrors: Partial<Record<keyof FormState, string>> = {};

    if (!form.buyerName.trim()) nextErrors.buyerName = "Enter your name.";
    if (!form.buyerEmail.trim() || !EMAIL_PATTERN.test(form.buyerEmail.trim())) {
      nextErrors.buyerEmail = "Enter a valid email address.";
    }
    if (!form.message.trim()) {
      nextErrors.message = "Tell the seller a bit about your interest.";
    }
    if (form.offerPrice.trim() && Number.isNaN(Number(form.offerPrice))) {
      nextErrors.offerPrice = "Offer must be a number.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      createPurchaseRequest({
        propertyId: property.id,
        buyerName: form.buyerName.trim(),
        buyerEmail: form.buyerEmail.trim(),
        offerPrice: form.offerPrice.trim() ? Number(form.offerPrice) : null,
        message: form.message.trim(),
        documentNames: documents.map((doc) => doc.file.name),
      });

      // Mocked — no requests endpoint exists yet, see
      // lib/purchaseRequests.ts::createPurchaseRequest for where the
      // real POST call (multipart, including `documents`) would go.
      await new Promise((resolve) => setTimeout(resolve, 500));

      setSubmitted(true);
      setForm(INITIAL_STATE);
      setDocuments([]);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className={styles.successCard}>
        <span className={styles.successIcon}>✓</span>
        <h2 className={styles.successTitle}>Request sent</h2>
        <p className={styles.successBody}>
          Your {isRental ? "rental inquiry" : "purchase request"} for{" "}
          <strong>{property.title}</strong> has been sent to the seller.
          They&apos;ll reach out at the email you provided.
        </p>
        <button
          type="button"
          className={styles.secondaryBtn}
          onClick={() => setSubmitted(false)}
        >
          Send another request
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className={styles.card}>
      <h2 className={styles.title}>
        {isRental ? "Request to rent" : "Make a purchase request"}
      </h2>
      <p className={styles.description}>
        Share a few details and any supporting documents — the seller will
        follow up directly.
      </p>

      <div className={styles.row}>
        <Input
          label="Your name"
          placeholder="Sujata Rana"
          value={form.buyerName}
          onChange={(e) => update("buyerName", e.target.value)}
          error={errors.buyerName}
          required
        />
        <Input
          label="Email"
          type="email"
          placeholder="you@example.com"
          value={form.buyerEmail}
          onChange={(e) => update("buyerEmail", e.target.value)}
          error={errors.buyerEmail}
          required
        />
      </div>

      <Input
        label={
          isRental
            ? "Proposed monthly rent (USD, optional)"
            : "Your offer (USD, optional)"
        }
        type="number"
        inputMode="numeric"
        placeholder={String(property.price)}
        value={form.offerPrice}
        onChange={(e) => update("offerPrice", e.target.value)}
        error={errors.offerPrice}
      />

      <div className={styles.textareaField}>
        <label className={styles.textareaLabel} htmlFor="message">
          Message
        </label>
        <textarea
          id="message"
          className={styles.textarea}
          rows={4}
          placeholder={
            isRental
              ? "When are you looking to move in? Any questions about the unit?"
              : "Tell the seller about your timeline, financing, or any questions."
          }
          value={form.message}
          onChange={(e) => update("message", e.target.value)}
        />
        {errors.message && <p className={styles.fieldError}>{errors.message}</p>}
      </div>

      <DocumentUploader
        title="Supporting documents"
        description="Help the seller trust your request — proof of funds, ID, or a pre-approval letter. PDF, JPG, or PNG, under 10MB each."
        options={BUYER_DOCUMENT_OPTIONS}
        documents={documents}
        onChange={setDocuments}
      />

      <Button type="submit" isLoading={isSubmitting}>
        {isRental ? "Send rental request" : "Send purchase request"}
      </Button>
    </form>
  );
}
