"use client";

import { ButtonHTMLAttributes } from "react";
import styles from "./Button.module.css";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
  isLoading?: boolean;
}

export default function Button({
  variant = "primary",
  isLoading = false,
  disabled,
  children,
  className,
  ...rest
}: ButtonProps) {
  const variantClass = variant === "secondary" ? styles.secondary : styles.primary;

  return (
    <button
      className={`${styles.btn} ${variantClass} ${className ?? ""}`}
      disabled={disabled || isLoading}
      {...rest}
    >
      {isLoading ? "Please wait…" : children}
    </button>
  );
}
