"use client";

import { FormEvent, useEffect, useState } from "react";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { updateProfile, me } from "@/lib/users";
import type { UserProfile } from "@/types/profile";
import styles from "./ProfileSection.module.css";


export default function PersonalDetailsSection() {
  const [profile, setProfile] = useState<UserProfile>({
    firstName: "",
    lastName: "",
    email: "",
    phone: ""
  });

  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function getUser() {
    try {
      const data = await me();
      setProfile(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't get your profile.");
    }
  }

  useEffect(() => {
    getUser();
  }, []);

  function updateField<K extends keyof UserProfile>(key: K, value: UserProfile[K]) {
    setProfile((p) => ({ ...p, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus(null);
    setError(null);

    if (!profile.firstName || !profile.lastName || !profile.email) {
      setError("Name and email can't be empty.");
      return;
    }

    setIsSaving(true);
    try {
      await updateProfile(profile);
      setStatus("Profile updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save your changes.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.card} noValidate>
      <h2 className={styles.title}>Personal details</h2>
      <p className={styles.description}>
        This is how agents and other users will see you on Meridian.
      </p>

      <div className={styles.fieldRow}>
        <Input
          label="First name"
          type="text"
          value={profile.firstName}
          onChange={(e) => updateField("firstName", e.target.value)}
          required
        />
        <Input
          label="Last name"
          type="text"
          value={profile.lastName}
          onChange={(e) => updateField("lastName", e.target.value)}
          required
        />
      </div>

      <Input
        label="Email"
        type="email"
        value={profile.email}
        onChange={(e) => updateField("email", e.target.value)}
        required
      />
      <Input
        label="Phone"
        type="text"
        value={profile.phone}
        onChange={(e) => updateField("phone", e.target.value)}
      />

      {error && <p className={styles.error}>{error}</p>}
      {status && <p className={styles.success}>{status}</p>}

      <div className={styles.actions}>
        <Button type="submit" isLoading={isSaving}>
          Save changes
        </Button>
      </div>
    </form>
  );
}
