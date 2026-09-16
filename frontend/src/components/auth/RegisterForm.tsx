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

      localStorage.removeItem("token")
      localStorage.removeItem("user")

      if (response.token) {
        localStorage.setItem("token", response.token);
        localStorage.setItem("user", JSON.stringify(response.user));
        router.push("/dashboard");
      } else {
        setFormError("Registration failed. Please try again.");
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
