"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { register } from "@/lib/api";
import styles from "./AuthForm.module.css";

export default function RegisterForm() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isAgent, setIsAgent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [walletCredentials, setWalletCredentials] = useState<{
    address: string;
    privateKey: string;
  } | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!firstName || !lastName || !email || !password) {
      setFormError("Fill in every field to create your account.");
      return;
    }
    if (password.length < 8) {
      setFormError("Password must be at least 8 characters.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await register({ firstName, lastName, email, password, isAgent });

      localStorage.removeItem("token");
      localStorage.removeItem("user");

      if (response.token && response.user.walletAddress && response.walletPrivateKey) {
        localStorage.setItem("token", response.token);
        localStorage.setItem("user", JSON.stringify(response.user));

        // Deliberately keep the private key only in React state. It is shown once
        // so the user can back it up, but it is not persisted in localStorage.
        setWalletCredentials({
          address: response.user.walletAddress,
          privateKey: response.walletPrivateKey,
        });
      } else {
        setFormError("Account was created, but the blockchain wallet could not be created.");
      }
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : "Couldn't create your account. Try again."
      );
    } finally {
      setIsLoading(false);
    }
  }

  if (walletCredentials) {
    return (
      <div>
        <h1 className={styles.heading}>Your blockchain wallet is ready</h1>
        <p className={styles.subheading}>
          Your account has been created. Back up the private key below before continuing.
          Your property ownership will use this wallet automatically.
        </p>

        <div className={styles.walletBox}>
          <p className={styles.walletWarning}>
            ⚠️ Never share your private key with anyone. Anyone who has it can control this wallet.
          </p>

          <label>Wallet address</label>
          <textarea readOnly value={walletCredentials.address} rows={2} />

          <label>Private key</label>
          <textarea readOnly value={walletCredentials.privateKey} rows={4} />

          <p className={styles.walletHint}>
            This key is shown only during registration and is not saved in browser localStorage.
            Your backend also keeps an encrypted copy so it can perform authorized blockchain
            operations for this custodial FYP design.
          </p>

          <Button type="button" onClick={() => router.push("/dashboard")}>
            I have backed up my key — continue
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h1 className={styles.heading}>Create your account</h1>
      <p className={styles.subheading}>
        Save listings, track price changes, and book viewings in one place.
      </p>

      <div className={styles.fieldRow}>
        <Input
          label="First name"
          type="text"
          placeholder="Asha"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          autoComplete="given-name"
          required
        />
        <Input
          label="Last name"
          type="text"
          placeholder="Gurung"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          autoComplete="family-name"
          required
        />
      </div>

      <Input
        label="Email"
        type="email"
        placeholder="you@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
        required
      />
      <Input
        label="Password"
        type="password"
        placeholder="At least 8 characters"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="new-password"
        required
      />

      {formError && <p className={styles.formError}>{formError}</p>}

      <div className={styles.rowBetweenTight}>
        <label className={styles.checkboxLine}>
          <input
            type="checkbox"
            checked={isAgent}
            onChange={(e) => setIsAgent(e.target.checked)}
          />
          I&apos;m a licensed agent
        </label>
      </div>

      <Button type="submit" isLoading={isLoading}>
        Create account
      </Button>

      <div className={styles.divider}>or</div>

      <Button type="button" variant="secondary">
        Continue with Google
      </Button>

      <p className={styles.switchLine}>
        Already have an account? <Link href="/login">Sign in</Link>
      </p>
    </form>
  );
}
