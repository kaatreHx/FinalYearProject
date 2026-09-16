"use client";

import { FormEvent, useState } from "react";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { changePassword } from "@/lib/users";
import styles from "./ProfileSection.module.css";
import secStyles from "./PasswordSecuritySection.module.css";

export default function PasswordSecuritySection() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [twoFactor, setTwoFactor] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus(null);
    setError(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("Fill in all three password fields.");
      return;
    }
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation don't match.");
      return;
    }

    setIsSaving(true);
    try {
      await changePassword({ currentPassword, newPassword, confirmPassword });
      setStatus("Password changed.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't change your password.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className={secStyles.stack}>
      <form onSubmit={handleSubmit} className={styles.card} noValidate>
        <h2 className={styles.title}>Password</h2>
        <p className={styles.description}>
          Use at least 8 characters. We recommend a mix you don&apos;t reuse
          elsewhere.
        </p>

        <Input
          label="Current password"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          autoComplete="current-password"
        />
        <div className={styles.fieldRow}>
          <Input
            label="New password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
          />
          <Input
            label="Confirm new password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
          />
        </div>

        {error && <p className={styles.error}>{error}</p>}
        {status && <p className={styles.success}>{status}</p>}

        <div className={styles.actions}>
          <Button type="submit" variant="secondary" isLoading={isSaving}>
            Update password
          </Button>
        </div>
      </form>

      <div className={styles.card}>
        <h2 className={styles.title}>Two-factor authentication</h2>
        <p className={styles.description}>
          Add an extra step at login using a code sent to your phone.
        </p>

        <div className={secStyles.toggleRow}>
          <div>
            <p className={secStyles.toggleLabel}>SMS verification</p>
            <p className={secStyles.toggleHint}>
              {twoFactor ? "Enabled — codes sent to your phone" : "Currently off"}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={twoFactor}
            className={`${secStyles.toggle} ${twoFactor ? secStyles.toggleOn : ""}`}
            onClick={() => setTwoFactor((v) => !v)}
          >
            <span className={secStyles.toggleKnob} />
          </button>
        </div>
      </div>
    </div>
  );
}
