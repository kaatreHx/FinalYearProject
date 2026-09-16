"use client";

import { forwardRef, InputHTMLAttributes } from "react";
import styles from "./Input.module.css";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, id, ...rest }, ref) => {
    const inputId = id ?? label.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className={styles.field}>
        <label htmlFor={inputId} className={styles.label}>
          {label}
        </label>
        <input
          id={inputId}
          ref={ref}
          className={styles.input}
          aria-invalid={Boolean(error)}
          {...rest}
        />
        {error && <p className={styles.error}>{error}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";

export default Input;
