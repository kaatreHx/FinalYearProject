"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { login } from "@/lib/api";
import styles from "./AuthForm.module.css";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [keepSignedIn, setKeepSignedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!email || !password) {
      setFormError("Enter your email and password to continue.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await login({ email, password, keepSignedIn });

      localStorage.removeItem("token")
      localStorage.removeItem("user")

      if (response.token) {
        localStorage.setItem("token", response.token);
        localStorage.setItem("user", JSON.stringify(response.user));

        router.push("/dashboard");
      } else {
        setFormError("Invalid credentials");
      }
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Couldn't sign you in. Try again."
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h1 className={styles.heading}>Welcome back</h1>
      <p className={styles.subheading}>
        Sign in to view saved listings and your viewing schedule.
      </p>

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
        placeholder="••••••••••"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="current-password"
        required
      />

      {formError && <p className={styles.formError}>{formError}</p>}

      <div className={styles.rowBetween}>
        <label className={styles.checkboxLine}>
          <input
            type="checkbox"
            checked={keepSignedIn}
            onChange={(e) => setKeepSignedIn(e.target.checked)}
          />
          Keep me signed in
        </label>
        <Link className={styles.linkMuted} href="/forgot-password">
          Forgot password?
        </Link>
      </div>

      <Button type="submit" isLoading={isLoading}>
        Sign in
      </Button>

      <div className={styles.divider}>or</div>

      <Button type="button" variant="secondary">
        Continue with Google
      </Button>

      <p className={styles.switchLine}>
        New to Meridian? <Link href="/register">Create an account</Link>
      </p>
    </form>
  );
}
