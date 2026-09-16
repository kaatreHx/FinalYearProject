"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import LocationPicker from "@/components/seller/LocationPicker";
import DocumentUploader, {
  type UploadedDoc,
} from "@/components/shared/DocumentUploader";
import {
  CURRENT_SELLER_ID,
  CURRENT_SELLER_NAME,
  DEFAULT_MAP_CENTER,
  createDraftProperty,
  formatPrice,
} from "@/lib/properties";
import type { ListingStatus, PropertyType } from "@/types/property";
import styles from "./ListPropertyForm.module.css";

const PROPERTY_DOCUMENT_OPTIONS = [
  { value: "ownership_deed", label: "Ownership deed / lalpurja" },
  { value: "land_survey", label: "Land survey / naksa" },
  { value: "tax_clearance", label: "Tax clearance certificate" },
  { value: "other", label: "Other" },
];

const PROPERTY_TYPES: PropertyType[] = [
  "House",
  "Apartment",
  "Land",
  "Commercial",
];

const STATUS_OPTIONS: ListingStatus[] = ["For Sale", "For Rent"];

type StepId = "details" | "location" | "documents";

const STEPS: { id: StepId; label: string }[] = [
  { id: "details", label: "Property details" },
  { id: "location", label: "Location" },
  { id: "documents", label: "Documents" },
];

const DETAIL_FIELDS = [
  "title",
  "address",
  "city",
  "price",
  "areaSqm",
  "beds",
  "baths",
  "parking",
] as const;

interface FormState {
  title: string;
  address: string;
  city: string;
  price: string;
  beds: string;
  baths: string;
  parking: string;
  areaSqm: string;
  type: PropertyType;
  status: ListingStatus;
  latitude: number;
  longitude: number;
}

const INITIAL_STATE: FormState = {
  title: "",
  address: "",
  city: "",
  price: "",
  beds: "",
  baths: "",
  parking: "",
  areaSqm: "",
  type: "Apartment",
  status: "For Sale",
  latitude: DEFAULT_MAP_CENTER.latitude,
  longitude: DEFAULT_MAP_CENTER.longitude,
};

type FormErrors = Partial<Record<keyof FormState, string>>;

function computeErrors(form: FormState): FormErrors {
  const isLand = form.type === "Land";
  const nextErrors: FormErrors = {};

  if (!form.title.trim()) nextErrors.title = "Give your listing a title.";
  if (!form.address.trim()) nextErrors.address = "Street address is required.";
  if (!form.city.trim()) nextErrors.city = "City is required.";

  const price = Number(form.price);
  if (!form.price.trim() || Number.isNaN(price) || price <= 0) {
    nextErrors.price = "Enter a valid price.";
  }

  const areaSqm = Number(form.areaSqm);
  if (!form.areaSqm.trim() || Number.isNaN(areaSqm) || areaSqm <= 0) {
    nextErrors.areaSqm = "Enter the floor area in m².";
  }

  if (!isLand) {
    if (form.beds.trim() && Number.isNaN(Number(form.beds))) {
      nextErrors.beds = "Beds must be a number.";
    }
    if (form.baths.trim() && Number.isNaN(Number(form.baths))) {
      nextErrors.baths = "Baths must be a number.";
    }
    if (form.parking.trim() && Number.isNaN(Number(form.parking))) {
      nextErrors.parking = "Parking must be a number.";
    }
  }

  return nextErrors;
}

export default function ListPropertyForm() {
  const [activeStep, setActiveStep] = useState<StepId>("details");
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [documents, setDocuments] = useState<UploadedDoc[]>([]);
  const [errors, setErrors] = useState<FormErrors>({});
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<null | {
    title: string;
    priceLabel: string;
    documentCount: number;
  }>(null);

  const isLand = form.type === "Land";

  // Once the seller has tried to submit at least once, keep error
  // state (and the red section indicators) live as they fix fields.
  useEffect(() => {
    if (attemptedSubmit) {
      setErrors(computeErrors(form));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, attemptedSubmit]);

  const detailsHaveError = DETAIL_FIELDS.some((field) => Boolean(errors[field]));
  const stepHasError: Record<StepId, boolean> = {
    details: attemptedSubmit && detailsHaveError,
    location: false,
    documents: false,
  };

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function goTo(step: StepId) {
    setActiveStep(step);
  }

  function goNext() {
    const index = STEPS.findIndex((s) => s.id === activeStep);
    if (index < STEPS.length - 1) setActiveStep(STEPS[index + 1].id);
  }

  function goBack() {
    const index = STEPS.findIndex((s) => s.id === activeStep);
    if (index > 0) setActiveStep(STEPS[index - 1].id);
  }

  function validate(): boolean {
    setAttemptedSubmit(true);
    const nextErrors = computeErrors(form);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      const hasDetailError = DETAIL_FIELDS.some((field) => nextErrors[field]);
      if (hasDetailError) setActiveStep("details");
    }

    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const draft = createDraftProperty(
        {
          title: form.title.trim(),
          address: form.address.trim(),
          city: form.city.trim(),
          price: Number(form.price),
          status: form.status,
          type: form.type,
          beds: isLand || !form.beds.trim() ? 0 : Number(form.beds),
          baths: isLand || !form.baths.trim() ? 0 : Number(form.baths),
          parking: isLand || !form.parking.trim() ? 0 : Number(form.parking),
          areaSqm: Number(form.areaSqm),
          latitude: form.latitude,
          longitude: form.longitude,
        },
        CURRENT_SELLER_ID,
        CURRENT_SELLER_NAME
      );

      // Mocked — no create-listing or document-upload endpoint exists yet,
      // see lib/properties.ts::createDraftProperty for where the real
      // POST call (multipart, including `documents`) would go.
      await new Promise((resolve) => setTimeout(resolve, 500));

      setSubmitted({
        title: draft.title,
        priceLabel: formatPrice(draft.price, draft.status),
        documentCount: documents.length,
      });
      setForm(INITIAL_STATE);
      setDocuments([]);
      setErrors({});
      setAttemptedSubmit(false);
      setActiveStep("details");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className={styles.successCard}>
        <span className={styles.successIcon}>✓</span>
        <h2 className={styles.successTitle}>Listing created</h2>
        <p className={styles.successBody}>
          <strong>{submitted.title}</strong> ({submitted.priceLabel}) is now
          live{submitted.documentCount > 0
            ? ` with ${submitted.documentCount} document${submitted.documentCount !== 1 ? "s" : ""} attached`
            : ""}. Buyers can start sending purchase requests — you&apos;ll
          see them on your listings page.
        </p>
        <div className={styles.successActions}>
          <Link href="/seller/listings" className={styles.primaryLink}>
            View purchase requests
          </Link>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={() => setSubmitted(null)}
          >
            List another property
          </button>
        </div>
      </div>
    );
  }

  const activeIndex = STEPS.findIndex((s) => s.id === activeStep);
  const isLastStep = activeIndex === STEPS.length - 1;

  return (
    <form onSubmit={handleSubmit} noValidate className={styles.layout}>
      <div className={styles.stepList} role="tablist" aria-orientation="vertical">
        {STEPS.map((step, index) => (
          <button
            key={step.id}
            type="button"
            role="tab"
            aria-selected={activeStep === step.id}
            className={`${styles.stepItem} ${
              activeStep === step.id ? styles.stepItemActive : ""
            } ${stepHasError[step.id] ? styles.stepItemError : ""}`}
            onClick={() => goTo(step.id)}
          >
            <span className={styles.stepNumber}>{index + 1}</span>
            <span className={styles.stepLabelGroup}>
              <span className={styles.stepLabel}>{step.label}</span>
              {stepHasError[step.id] && (
                <span className={styles.stepIssue}>Needs attention</span>
              )}
            </span>
          </button>
        ))}
      </div>

      <div className={styles.content}>
        <div className={styles.card}>
          {activeStep === "details" && (
            <div role="tabpanel">
              <h2 className={styles.sectionTitle}>Property details</h2>
              <p className={styles.sectionDescription}>
                The basics buyers see first — what it is, where it is, and
                what it costs.
              </p>

              <Input
                label="Listing title"
                placeholder="Riverside two-bed apartment"
                value={form.title}
                onChange={(e) => update("title", e.target.value)}
                error={errors.title}
                required
              />

              <div className={styles.row}>
                <Input
                  label="Street address"
                  placeholder="12 Willow Court"
                  value={form.address}
                  onChange={(e) => update("address", e.target.value)}
                  error={errors.address}
                  required
                />
                <Input
                  label="City"
                  placeholder="Kathmandu"
                  value={form.city}
                  onChange={(e) => update("city", e.target.value)}
                  error={errors.city}
                  required
                />
              </div>

              <div className={styles.row}>
                <div className={styles.selectField}>
                  <label className={styles.selectLabel} htmlFor="type">
                    Property type
                  </label>
                  <select
                    id="type"
                    className={styles.select}
                    value={form.type}
                    onChange={(e) => update("type", e.target.value as PropertyType)}
                  >
                    {PROPERTY_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.selectField}>
                  <label className={styles.selectLabel} htmlFor="status">
                    Listing status
                  </label>
                  <select
                    id="status"
                    className={styles.select}
                    value={form.status}
                    onChange={(e) => update("status", e.target.value as ListingStatus)}
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={styles.row}>
                <Input
                  label={form.status === "For Rent" ? "Monthly rent (USD)" : "Price (USD)"}
                  type="number"
                  inputMode="numeric"
                  placeholder="185000"
                  value={form.price}
                  onChange={(e) => update("price", e.target.value)}
                  error={errors.price}
                  required
                />
                <Input
                  label="Floor area (m²)"
                  type="number"
                  inputMode="numeric"
                  placeholder="86"
                  value={form.areaSqm}
                  onChange={(e) => update("areaSqm", e.target.value)}
                  error={errors.areaSqm}
                  required
                />
              </div>

              {!isLand && (
                <div className={styles.row}>
                  <Input
                    label="Bedrooms"
                    type="number"
                    inputMode="numeric"
                    placeholder="2"
                    value={form.beds}
                    onChange={(e) => update("beds", e.target.value)}
                    error={errors.beds}
                  />
                  <Input
                    label="Bathrooms"
                    type="number"
                    inputMode="numeric"
                    placeholder="2"
                    value={form.baths}
                    onChange={(e) => update("baths", e.target.value)}
                    error={errors.baths}
                  />
                </div>
              )}

              {!isLand && (
                <div className={styles.row}>
                  <Input
                    label="Parking spaces"
                    type="number"
                    inputMode="numeric"
                    placeholder="1"
                    value={form.parking}
                    onChange={(e) => update("parking", e.target.value)}
                    error={errors.parking}
                  />
                </div>
              )}
            </div>
          )}

          {activeStep === "location" && (
            <div role="tabpanel">
              <h2 className={styles.sectionTitle}>Location</h2>
              <p className={styles.sectionDescription}>
                Search for the address, or click and drag the pin on the
                map for the exact spot.
              </p>
              <LocationPicker
                latitude={form.latitude}
                longitude={form.longitude}
                onChange={(latitude, longitude) =>
                  setForm((prev) => ({ ...prev, latitude, longitude }))
                }
              />
            </div>
          )}

          {activeStep === "documents" && (
            <div role="tabpanel">
              <DocumentUploader
                title="Supporting documents"
                description="Add ownership proof and other paperwork buyers may ask for — ownership deed, land survey, or a tax clearance certificate. PDF, JPG, or PNG, under 10MB each."
                options={PROPERTY_DOCUMENT_OPTIONS}
                documents={documents}
                onChange={setDocuments}
              />
            </div>
          )}
        </div>

        <div className={styles.stepActions}>
          {activeIndex > 0 && (
            <button type="button" className={styles.backBtn} onClick={goBack}>
              ← Back
            </button>
          )}
          <div className={styles.stepActionsRight}>
            {!isLastStep && (
              <button type="button" className={styles.nextBtn} onClick={goNext}>
                Next: {STEPS[activeIndex + 1].label} →
              </button>
            )}
            {isLastStep && (
              <Button type="submit" isLoading={isSubmitting}>
                List property
              </Button>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
