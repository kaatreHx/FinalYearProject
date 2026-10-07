"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import LocationPicker from "@/components/seller/LocationPicker";
import DocumentUploader, {
  type UploadedDoc,
} from "@/components/shared/DocumentUploader";
import PhotoUploader from "@/components/shared/PhotoUploader";
import { ApiError } from "@/lib/http";
import { reverseGeocode } from "@/lib/geocode";
import {
  DEFAULT_MAP_CENTER,
  PROPERTY_DOCUMENT_OPTIONS,
  createProperty,
  formatPrice,
  tagDocumentFile,
} from "@/lib/properties";
import type { PropertyType } from "@/types/property";
import styles from "./ListPropertyForm.module.css";

const PROPERTY_TYPES: PropertyType[] = ["House", "Apartment", "Land", "Commercial"];

type StepId = "details" | "location" | "documents";

const STEPS: { id: StepId; label: string }[] = [
  { id: "details", label: "Property details" },
  { id: "location", label: "Location" },
  { id: "documents", label: "Photos & documents" },
];

const DETAIL_FIELDS = [
  "title",
  "description",
  "address",
  "city",
  "zip",
  "landRegistrationNumber",
  "price",
  "areaSqm",
  "beds",
  "baths",
] as const;

interface FormState {
  title: string;
  description: string;
  address: string;
  city: string;
  zip: string;
  landRegistrationNumber: string;
  price: string;
  beds: string;
  baths: string;
  areaSqm: string;
  type: PropertyType;
  // Map pin only; the backend stores the address, not coordinates.
  latitude: number;
  longitude: number;
}

const INITIAL_STATE: FormState = {
  title: "",
  description: "",
  address: "",
  city: "",
  zip: "",
  landRegistrationNumber: "",
  price: "",
  beds: "",
  baths: "",
  areaSqm: "",
  type: "Apartment",
  latitude: DEFAULT_MAP_CENTER.latitude,
  longitude: DEFAULT_MAP_CENTER.longitude,
};

type FormErrors = Partial<Record<keyof FormState, string>>;

function computeErrors(form: FormState): FormErrors {
  const isLand = form.type === "Land";
  const nextErrors: FormErrors = {};

  if (form.title.trim().length < 3) nextErrors.title = "Give your listing a title (3+ characters).";
  if (form.description.trim().length < 10) {
    nextErrors.description = "Describe the property in a sentence or two (10+ characters).";
  }
  if (!form.address.trim()) nextErrors.address = "Street address is required.";
  if (!form.city.trim()) nextErrors.city = "City is required.";
  if (!form.zip.trim()) nextErrors.zip = "Postal code is required.";
  if (form.landRegistrationNumber.trim().length < 3) {
    nextErrors.landRegistrationNumber = "Enter the land registration number from your ownership deed.";
  }

  const price = Number(form.price);
  if (!form.price.trim() || Number.isNaN(price) || price <= 0) {
    nextErrors.price = "Enter a valid price.";
  } else if (!/^\d{1,16}(\.\d{1,2})?$/.test(form.price.trim())) {
    nextErrors.price = "Use at most 2 decimal places.";
  }

  const areaSqm = Number(form.areaSqm);
  if (!form.areaSqm.trim() || Number.isNaN(areaSqm) || areaSqm <= 0) {
    nextErrors.areaSqm = "Enter the floor area in m².";
  }

  if (!isLand) {
    for (const key of ["beds", "baths"] as const) {
      const v = form[key].trim();
      if (v && (!Number.isInteger(Number(v)) || Number(v) < 0 || Number(v) > 100)) {
        nextErrors[key] = "Enter a whole number.";
      }
    }
  }

  return nextErrors;
}

export default function ListPropertyForm() {
  const [activeStep, setActiveStep] = useState<StepId>("details");
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [photos, setPhotos] = useState<File[]>([]);
  const [documents, setDocuments] = useState<UploadedDoc[]>([]);
  const [errors, setErrors] = useState<FormErrors>({});
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<{ message: string; status: number } | null>(null);
  const [submitted, setSubmitted] = useState<null | {
    title: string;
    priceLabel: string;
    photoCount: number;
    documentCount: number;
  }>(null);

  const isLand = form.type === "Land";

  const photoError =
    attemptedSubmit && photos.length === 0 ? "Add at least one photo of the property." : undefined;
  const documentError =
    attemptedSubmit && documents.length === 0
      ? "Add at least one ownership document — the government needs it to verify your listing."
      : undefined;

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
    documents: Boolean(photoError || documentError),
  };

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // --- Map pin -> address -------------------------------------------------
  // The backend stores street/city/zip rather than coordinates, so when the
  // seller moves the pin we reverse-geocode it into those fields. Fields the
  // seller typed themselves are never overwritten.
  const lastAuto = useRef({ address: "", city: "", zip: "" });
  const geoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (geoTimer.current) clearTimeout(geoTimer.current);
  }, []);

  function handleLocationChange(latitude: number, longitude: number) {
    setForm((prev) => ({ ...prev, latitude, longitude }));
    if (geoTimer.current) clearTimeout(geoTimer.current);
    geoTimer.current = setTimeout(async () => {
      const place = await reverseGeocode(latitude, longitude).catch(() => null);
      if (!place) return;
      setForm((prev) => {
        const next = { ...prev };
        const found = { address: place.street, city: place.city, zip: place.zip };
        for (const key of ["address", "city", "zip"] as const) {
          const value = found[key];
          if (value && (prev[key].trim() === "" || prev[key] === lastAuto.current[key])) {
            next[key] = value;
            lastAuto.current[key] = value;
          }
        }
        return next;
      });
    }, 800);
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

    const hasDetailError = DETAIL_FIELDS.some((field) => nextErrors[field]);
    if (hasDetailError) {
      setActiveStep("details");
      return false;
    }
    if (photos.length === 0 || documents.length === 0) {
      setActiveStep("documents");
      return false;
    }
    return true;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const created = await createProperty(
        {
          title: form.title.trim(),
          description: form.description.trim(),
          type: form.type,
          price: Number(form.price),
          areaSqm: Number(form.areaSqm),
          beds: isLand || !form.beds.trim() ? null : Number(form.beds),
          baths: isLand || !form.baths.trim() ? null : Number(form.baths),
          address: form.address.trim(),
          city: form.city.trim(),
          zip: form.zip.trim(),
          landRegistrationNumber: form.landRegistrationNumber.trim(),
        },
        photos,
        documents.map((doc) => tagDocumentFile(doc.file, doc.type))
      );

      setSubmitted({
        title: created.title,
        priceLabel: formatPrice(created.price, created.status),
        photoCount: photos.length,
        documentCount: documents.length,
      });
      setForm(INITIAL_STATE);
      setPhotos([]);
      setDocuments([]);
      setErrors({});
      setAttemptedSubmit(false);
      setActiveStep("details");
      lastAuto.current = { address: "", city: "", zip: "" };
    } catch (err) {
      setSubmitError({
        message: err instanceof Error ? err.message : "Couldn't submit your listing. Try again.",
        status: err instanceof ApiError ? err.status : 0,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className={styles.successCard}>
        <span className={styles.successIcon}>✓</span>
        <h2 className={styles.successTitle}>Listing submitted</h2>
        <p className={styles.successBody}>
          <strong>{submitted.title}</strong> ({submitted.priceLabel}) is now{" "}
          <strong>pending government verification</strong>, with {submitted.photoCount} photo
          {submitted.photoCount !== 1 ? "s" : ""} and {submitted.documentCount} document
          {submitted.documentCount !== 1 ? "s" : ""} attached. It goes live for buyers once the
          government confirms your ownership — track progress on your listings page.
        </p>
        <div className={styles.successActions}>
          <Link href="/seller/listings" className={styles.primaryLink}>
            Track verification
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

              <div className={styles.textareaField}>
                <label className={styles.selectLabel} htmlFor="description">
                  Description
                </label>
                <textarea
                  id="description"
                  className={styles.textarea}
                  rows={4}
                  placeholder="Light-filled corner unit with river views, close to transit…"
                  value={form.description}
                  onChange={(e) => update("description", e.target.value)}
                />
                {errors.description && <p className={styles.fieldError}>{errors.description}</p>}
              </div>

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
                <Input
                  label="Postal code"
                  placeholder="44600"
                  value={form.zip}
                  onChange={(e) => update("zip", e.target.value)}
                  error={errors.zip}
                  required
                />
                <Input
                  label="Land registration number"
                  placeholder="As written on your lalpurja"
                  value={form.landRegistrationNumber}
                  onChange={(e) => update("landRegistrationNumber", e.target.value)}
                  error={errors.landRegistrationNumber}
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

                <Input
                  label="Price (USD)"
                  type="number"
                  inputMode="decimal"
                  placeholder="185000"
                  value={form.price}
                  onChange={(e) => update("price", e.target.value)}
                  error={errors.price}
                  required
                />
              </div>

              <div className={styles.row}>
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
                {!isLand && (
                  <Input
                    label="Bedrooms"
                    type="number"
                    inputMode="numeric"
                    placeholder="2"
                    value={form.beds}
                    onChange={(e) => update("beds", e.target.value)}
                    error={errors.beds}
                  />
                )}
              </div>

              {!isLand && (
                <div className={styles.row}>
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
            </div>
          )}

          {activeStep === "location" && (
            <div role="tabpanel">
              <h2 className={styles.sectionTitle}>Location</h2>
              <p className={styles.sectionDescription}>
                Search for the address, or click and drag the pin on the map.
                We&apos;ll fill in any empty street, city and postal-code fields from
                the pin — double-check them on the first step.
              </p>
              <LocationPicker
                latitude={form.latitude}
                longitude={form.longitude}
                onChange={handleLocationChange}
              />
            </div>
          )}

          {activeStep === "documents" && (
            <div role="tabpanel">
              <PhotoUploader
                title="Photos"
                description="Up to 10 photos — the first one is the cover. JPG, PNG, or WEBP, under 10MB each."
                files={photos}
                onChange={setPhotos}
                error={photoError}
              />

              <DocumentUploader
                title="Ownership documents"
                description="Required for government verification — ownership deed (lalpurja), land survey (naksa), or a tax clearance certificate. PDF, JPG, or PNG, under 10MB each. These stay private: only you and the verifying officer can open them."
                options={PROPERTY_DOCUMENT_OPTIONS}
                documents={documents}
                onChange={setDocuments}
              />
              {documentError && <p className={styles.fieldError}>{documentError}</p>}
            </div>
          )}
        </div>

        {submitError && (
          <p className={styles.submitError}>
            {submitError.message}
            {submitError.status === 403 && (
              <>
                {" "}
                <Link href="/profile">Go to your profile</Link>
              </>
            )}
          </p>
        )}

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
                Submit for verification
              </Button>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
