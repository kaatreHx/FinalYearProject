"use client";

import { FormEvent, RefObject, useEffect, useRef, useState } from "react";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import {
  getFileUrl,
  loadKycApplicationMe,
  submitKyc,
  updateKyc,
} from "@/lib/kycApplications";
import type { KycDocumentType, KycGender, KycState, KycStatus } from "@/types/kyc";
import styles from "./ProfileSection.module.css";
import kycStyles from "./KycSection.module.css";

const DOCUMENT_OPTIONS: { value: KycDocumentType; label: string }[] = [
  { value: "CITIZENSHIP", label: "Citizenship certificate" },
  { value: "PASSPORT", label: "Passport" },
  { value: "NATIONAL_ID", label: "National ID card" },
  { value: "DRIVERS_LICENSE", label: "Driver's license" },
];

const DOCUMENT_LABEL: Record<KycDocumentType, string> = DOCUMENT_OPTIONS.reduce(
  (acc, opt) => ({ ...acc, [opt.value]: opt.label }),
  {} as Record<KycDocumentType, string>
);

const GENDER_OPTIONS: { value: KycGender; label: string }[] = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "OTHER", label: "Other" },
];

const STATUS_LABEL: Record<KycStatus, string> = {
  not_submitted: "Not submitted",
  PENDING: "Pending review",
  APPROVED: "Verified",
  REJECTED: "Rejected — resubmit",
};

type Step = 1 | 2 | 3 | 4;

const STEP_META: { step: Step; label: string; heading: string; description: string }[] = [
  {
    step: 1,
    label: "Identity",
    heading: "Personal identity",
    description: "Enter your full legal name exactly as it appears on your document.",
  },
  {
    step: 2,
    label: "Document",
    heading: "Identity document",
    description: "Tell us which document you're verifying with.",
  },
  {
    step: 3,
    label: "Address",
    heading: "Address",
    description: "Your current or permanent residential address.",
  },
  {
    step: 4,
    label: "Photos",
    heading: "Document & selfie photos",
    description: "Upload clear photos, then review everything before submitting.",
  },
];

// Shows the last 4 characters of a document number and masks the rest,
// e.g. "12-34-56-78901" -> "•••••••••8901". Used in the read-only summary.
function maskDocumentNumber(value: string): string {
  if (value.length <= 4) return value;
  const visible = value.slice(-4);
  return "•".repeat(value.length - 4) + visible;
}

interface FileSlotProps {
  label: string;
  file: File | null;
  setFile: (f: File | null) => void;
  existingUrl: string | null;
  inputRef: RefObject<HTMLInputElement | null>;
  disabled: boolean;
}

function FileSlot({ label, file, setFile, existingUrl, inputRef, disabled }: FileSlotProps) {
  // A locally-selected new file always takes priority in the preview; if
  // nothing new was picked, fall back to whatever's already on the server.
  const previewUrl = file ? URL.createObjectURL(file) : getFileUrl(existingUrl);
  const hasSomething = Boolean(file || existingUrl);

  return (
    <div className={styles.field}>
      <label className={styles.label}>{label}</label>
      {hasSomething ? (
        <div className={kycStyles.previewBox}>
          <div className={kycStyles.previewImageWrapper}>
            <img
              src={previewUrl}
              alt={label}
              className={kycStyles.previewImage}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
          <div className={kycStyles.previewActions}>
            <button
              type="button"
              className={kycStyles.changeFileBtn}
              onClick={() => inputRef.current?.click()}
              disabled={disabled}
            >
              Replace photo
            </button>
            {file && (
              <button
                type="button"
                className={kycStyles.removeFileBtn}
                onClick={() => setFile(null)}
                disabled={disabled}
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      ) : (
        <button
          type="button"
          className={kycStyles.dropzone}
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
        >
          <span className={kycStyles.dropzoneIcon}>+</span>
          <span className={kycStyles.dropzoneText}>Upload photo</span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className={kycStyles.hiddenInput}
        onChange={(e) => {
          const selected = e.target.files?.[0];
          if (selected) setFile(selected);
        }}
        disabled={disabled}
      />
    </div>
  );
}

export default function KycSection() {
  const [status, setStatus] = useState<KycStatus>("not_submitted");
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [isLoaded, setIsLoaded] = useState(false);

  // Personal Identity
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState<KycGender>("MALE");

  // Identity Document Details
  const [documentType, setDocumentType] = useState<KycDocumentType>("CITIZENSHIP");
  const [documentNumber, setDocumentNumber] = useState("");
  const [documentExpiryDate, setDocumentExpiryDate] = useState("");

  // Address Information
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [zip, setZip] = useState("");

  // Existing uploaded files (URLs already on the server)
  const [existingFront, setExistingFront] = useState<string | null>(null);
  const [existingBack, setExistingBack] = useState<string | null>(null);
  const [existingSelfie, setExistingSelfie] = useState<string | null>(null);

  // Newly selected files pending upload
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);

  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [rejectionNote, setRejectionNote] = useState<string | null>(null);

  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);
  const selfieInputRef = useRef<HTMLInputElement>(null);

  // The essential-only summary is shown while under review or already
  // verified; the full editable wizard only applies before first
  // submission, or after a rejection.
  const showSummary = status === "PENDING" || status === "APPROVED";
  const isEditingExisting = status === "REJECTED";

  function applyState(res: KycState) {
    setStatus(res.status);
    setFirstName(res.firstName);
    setMiddleName(res.middleName ?? "");
    setLastName(res.lastName);
    setDob(res.dob ? res.dob.split("T")[0] : "");
    setGender(res.gender);
    setDocumentType(res.documentType);
    setDocumentNumber(res.documentNumber);
    setDocumentExpiryDate(res.documentExpiryDate ? res.documentExpiryDate.split("T")[0] : "");
    setStreet(res.street);
    setCity(res.city);
    setZip(res.zip);
    setExistingFront(res.documentFrontUrl);
    setExistingBack(res.documentBackUrl);
    setExistingSelfie(res.selfieUrl);
    setSubmittedAt(res.submittedAt);
    setRejectionNote(res.status === "REJECTED" ? res.rejectReason ?? null : null);
  }

  useEffect(() => {
    loadKycApplicationMe()
      .then(applyState)
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load your KYC status."))
      .finally(() => setIsLoaded(true));
  }, []);

  function validateStep(step: Step): string | null {
    if (step === 1) {
      if (!firstName || !lastName) return "Enter your full legal name.";
      if (!dob) return "Enter your date of birth.";
      return null;
    }
    if (step === 2) {
      if (!documentNumber) return "Enter your document number.";
      if (!documentExpiryDate) return "Enter the document's expiry date.";
      return null;
    }
    if (step === 3) {
      if (!street || !city || !zip) return "Enter your complete address.";
      return null;
    }
    if (step === 4) {
      const hasFront = Boolean(frontFile || existingFront);
      const hasBack = Boolean(backFile || existingBack);
      const hasSelfie = Boolean(selfieFile || existingSelfie);

      if (!hasFront || !hasBack) return "Upload clear photos of the front and back of your document.";
      if (!hasSelfie) return "Upload a live selfie photo for identity verification.";
      return null;
    }
    return null;
  }

  function handleNext() {
    const validationError = validateStep(currentStep);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setCurrentStep((s) => (s < 4 ? ((s + 1) as Step) : s));
  }

  function handleBack() {
    setError(null);
    setCurrentStep((s) => (s > 1 ? ((s - 1) as Step) : s));
  }

  function goToStep(step: Step) {
    if (step <= currentStep) {
      setError(null);
      setCurrentStep(step);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const validationError = validateStep(4);
    if (validationError) {
      setError(validationError);
      return;
    }

    const submission = {
      firstName,
      middleName: middleName || undefined,
      lastName,
      dob,
      gender,
      documentType,
      documentNumber,
      documentExpiryDate,
      street,
      city,
      zip,
    };
    const files = { front: frontFile, back: backFile, selfie: selfieFile };

    setIsSubmitting(true);
    try {
      // REJECTED means an application already exists on the server — edit
      // it (only the changed fields/files get sent). Otherwise this is a
      // first-time submission, which requires every field and all 3 files.
      const result = isEditingExisting
        ? await updateKyc(submission, files)
        : await submitKyc(submission, files);

      applyState(result);
      setFrontFile(null);
      setBackFile(null);
      setSelfieFile(null);
      setSuccessMsg("Documents submitted. Review usually takes 1–2 business days.");
      setCurrentStep(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't submit your documents.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const activeMeta = STEP_META[currentStep - 1];

  return (
    <div className={kycStyles.stack}>
      <div className={styles.card}>
        <div className={kycStyles.statusRow}>
          <div>
            <h2 className={styles.title}>Identity verification</h2>
            <p className={styles.description}>
              Verified accounts get faster viewing approvals and can list
              properties directly.
            </p>
          </div>
          <span className={`${kycStyles.statusPill} ${kycStyles[`status_${status}`]}`}>
            {STATUS_LABEL[status]}
          </span>
        </div>
        {status === "REJECTED" && rejectionNote && (
          <p className={kycStyles.rejectedNote}>
            <strong>Reason for rejection:</strong> {rejectionNote}
          </p>
        )}
      </div>

      {!isLoaded ? null : showSummary ? (
        // PENDING / APPROVED — read-only summary, essential fields only.
        // No document/selfie photos and no address shown here; the full
        // record only becomes editable again if the application is rejected.
        <div className={styles.card}>
          <h2 className={styles.title}>Submission summary</h2>
          <p className={styles.description}>
            {status === "APPROVED"
              ? "Your identity has been verified with these details."
              : "Your documents are under review. You'll be notified once a decision is made."}
          </p>
          <div className={kycStyles.summaryGrid}>
            <div className={kycStyles.summaryItem}>
              <span className={kycStyles.summaryLabel}>Full name</span>
              <span className={kycStyles.summaryValue}>
                {[firstName, middleName, lastName].filter(Boolean).join(" ")}
              </span>
            </div>
            <div className={kycStyles.summaryItem}>
              <span className={kycStyles.summaryLabel}>Document type</span>
              <span className={kycStyles.summaryValue}>{DOCUMENT_LABEL[documentType]}</span>
            </div>
            <div className={kycStyles.summaryItem}>
              <span className={kycStyles.summaryLabel}>Document number</span>
              <span className={kycStyles.summaryValue}>{maskDocumentNumber(documentNumber)}</span>
            </div>
            <div className={kycStyles.summaryItem}>
              <span className={kycStyles.summaryLabel}>Submitted</span>
              <span className={kycStyles.summaryValue}>
                {submittedAt ? new Date(submittedAt).toLocaleDateString() : "—"}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className={styles.card} noValidate>
          {status === "REJECTED" && (
            <p className={kycStyles.resubmitNote}>
              Update the details below based on the reason above, then resubmit for another review.
            </p>
          )}

          <div className={kycStyles.stepper}>
            {STEP_META.map((meta, i) => (
              <div
                key={meta.step}
                className={kycStyles.stepItem}
                style={{ flex: i === STEP_META.length - 1 ? "0 0 auto" : 1 }}
              >
                <button
                  type="button"
                  onClick={() => goToStep(meta.step)}
                  className={[
                    kycStyles.stepCircle,
                    meta.step === currentStep ? kycStyles.stepCircle_active : "",
                    meta.step < currentStep ? kycStyles.stepCircle_done : "",
                  ].join(" ")}
                  aria-current={meta.step === currentStep}
                  aria-label={`Step ${meta.step}: ${meta.label}`}
                >
                  {meta.step < currentStep ? "✓" : meta.step}
                </button>
                <span
                  className={[
                    kycStyles.stepLabel,
                    meta.step === currentStep ? kycStyles.stepLabel_active : "",
                  ].join(" ")}
                >
                  {meta.label}
                </span>
                {i < STEP_META.length - 1 && (
                  <span
                    className={[
                      kycStyles.stepLine,
                      meta.step < currentStep ? kycStyles.stepLine_done : "",
                    ].join(" ")}
                  />
                )}
              </div>
            ))}
          </div>

          <fieldset className={kycStyles.fieldset}>
            <h3 className={kycStyles.stepHeading}>{activeMeta.heading}</h3>
            <p className={`${styles.description} ${kycStyles.stepDescription}`}>
              {activeMeta.description}
            </p>

            {currentStep === 1 && (
              <>
                <div className={styles.fieldRow}>
                  <Input
                    label="First name"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="As printed on your document"
                    required
                  />
                  <Input
                    label="Middle name (optional)"
                    type="text"
                    value={middleName}
                    onChange={(e) => setMiddleName(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
                <div className={styles.fieldRow}>
                  <Input
                    label="Last name"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="As printed on your document"
                    required
                  />
                  <Input
                    label="Date of birth"
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    required
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="gender">
                    Gender
                  </label>
                  <select
                    id="gender"
                    className={styles.select}
                    value={gender}
                    onChange={(e) => setGender(e.target.value as KycGender)}
                  >
                    {GENDER_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {currentStep === 2 && (
              <>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="doc-type">
                    Document type
                  </label>
                  <select
                    id="doc-type"
                    className={styles.select}
                    value={documentType}
                    onChange={(e) => setDocumentType(e.target.value as KycDocumentType)}
                  >
                    {DOCUMENT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.fieldRow}>
                  <Input
                    label="Document number"
                    type="text"
                    value={documentNumber}
                    onChange={(e) => setDocumentNumber(e.target.value)}
                    placeholder="e.g. 12-34-56-78901"
                    required
                  />
                  <Input
                    label="Document expiry date"
                    type="date"
                    value={documentExpiryDate}
                    onChange={(e) => setDocumentExpiryDate(e.target.value)}
                    required
                  />
                </div>
              </>
            )}

            {currentStep === 3 && (
              <>
                <div className={styles.field}>
                  <Input
                    label="Street address"
                    type="text"
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    placeholder="House number and street"
                    required
                  />
                </div>
                <div className={styles.fieldRow}>
                  <Input
                    label="City"
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="City"
                    required
                  />
                  <Input
                    label="Zip / postal code"
                    type="text"
                    value={zip}
                    onChange={(e) => setZip(e.target.value)}
                    placeholder="Zip / postal code"
                    required
                  />
                </div>
              </>
            )}

            {currentStep === 4 && (
              <>
                <div className={styles.fieldRow}>
                  <FileSlot
                    label="Front side"
                    file={frontFile}
                    setFile={setFrontFile}
                    existingUrl={existingFront}
                    inputRef={frontInputRef}
                    disabled={false}
                  />
                  <FileSlot
                    label="Back side"
                    file={backFile}
                    setFile={setBackFile}
                    existingUrl={existingBack}
                    inputRef={backInputRef}
                    disabled={false}
                  />
                </div>

                <FileSlot
                  label="Selfie / live face photo"
                  file={selfieFile}
                  setFile={setSelfieFile}
                  existingUrl={existingSelfie}
                  inputRef={selfieInputRef}
                  disabled={false}
                />

                <h3 className={kycStyles.stepHeading}>Review before submitting</h3>
                <div className={kycStyles.reviewGrid}>
                  <div className={kycStyles.reviewItem}>
                    <span className={kycStyles.reviewLabel}>Full name</span>
                    <span className={kycStyles.reviewValue}>
                      {[firstName, middleName, lastName].filter(Boolean).join(" ") || "—"}
                    </span>
                  </div>
                  <div className={kycStyles.reviewItem}>
                    <span className={kycStyles.reviewLabel}>Date of birth</span>
                    <span className={kycStyles.reviewValue}>{dob || "—"}</span>
                  </div>
                  <div className={kycStyles.reviewItem}>
                    <span className={kycStyles.reviewLabel}>Document</span>
                    <span className={kycStyles.reviewValue}>{DOCUMENT_LABEL[documentType]}</span>
                  </div>
                  <div className={kycStyles.reviewItem}>
                    <span className={kycStyles.reviewLabel}>Document number</span>
                    <span className={kycStyles.reviewValue}>{documentNumber || "—"}</span>
                  </div>
                  <div className={kycStyles.reviewItem}>
                    <span className={kycStyles.reviewLabel}>Expiry date</span>
                    <span className={kycStyles.reviewValue}>{documentExpiryDate || "—"}</span>
                  </div>
                  <div className={kycStyles.reviewItem}>
                    <span className={kycStyles.reviewLabel}>Address</span>
                    <span className={kycStyles.reviewValue}>
                      {[street, city, zip].filter(Boolean).join(", ") || "—"}
                    </span>
                  </div>
                </div>
              </>
            )}

            {error && <p className={styles.error}>{error}</p>}
            {successMsg && <p className={styles.success}>{successMsg}</p>}

            <div className={kycStyles.stepActions}>
              {currentStep > 1 && (
                <Button type="button" variant="secondary" onClick={handleBack}>
                  Back
                </Button>
              )}
              <div className={kycStyles.stepActionsRight}>
                {currentStep < 4 && (
                  <Button type="button" onClick={handleNext}>
                    Continue
                  </Button>
                )}
                {currentStep === 4 && (
                  <Button type="submit" isLoading={isSubmitting}>
                    Submit for review
                  </Button>
                )}
              </div>
            </div>
          </fieldset>
        </form>
      )}
    </div>
  );
}
