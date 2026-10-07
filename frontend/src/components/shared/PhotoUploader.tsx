"use client";

import { useEffect, useMemo, useRef } from "react";
import styles from "./PhotoUploader.module.css";

interface PhotoUploaderProps {
  title: string;
  description: string;
  files: File[];
  onChange: (files: File[]) => void;
  max?: number;
  error?: string;
}

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024;

export default function PhotoUploader({
  title,
  description,
  files,
  onChange,
  max = 10,
  error,
}: PhotoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Object URLs for previews; revoked when the file list changes / unmounts.
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const valid = Array.from(list).filter((f) => ACCEPTED.includes(f.type) && f.size <= MAX_BYTES);
    onChange([...files, ...valid].slice(0, max));
  }

  return (
    <div className={styles.section}>
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.description}>{description}</p>

      <div className={styles.grid}>
        {files.map((file, i) => (
          <div key={`${file.name}-${file.lastModified}-${i}`} className={styles.thumbWrap}>
            <img className={styles.thumb} src={previews[i]} alt={file.name} />
            {i === 0 && <span className={styles.coverTag}>Cover</span>}
            <button
              type="button"
              className={styles.removeBtn}
              aria-label={`Remove ${file.name}`}
              onClick={() => onChange(files.filter((_, idx) => idx !== i))}
            >
              ×
            </button>
          </div>
        ))}

        {files.length < max && (
          <button type="button" className={styles.addTile} onClick={() => inputRef.current?.click()}>
            <span className={styles.addIcon}>+</span>
            <span>Add photos</span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        className={styles.hiddenInput}
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
