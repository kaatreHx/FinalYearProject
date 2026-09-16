"use client";

import { useRef } from "react";
import styles from "./DocumentUploader.module.css";

export interface DocumentTypeOption {
  value: string;
  label: string;
}

export interface UploadedDoc {
  id: string;
  type: string;
  file: File;
}

interface DocumentUploaderProps {
  title: string;
  description: string;
  options: DocumentTypeOption[];
  documents: UploadedDoc[];
  onChange: (documents: UploadedDoc[]) => void;
  uploadLabel?: string;
}

export default function DocumentUploader({
  title,
  description,
  options,
  documents,
  onChange,
  uploadLabel = "Upload documents",
}: DocumentUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  function addFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const additions: UploadedDoc[] = Array.from(fileList).map((file) => ({
      id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
      type: options[0]?.value ?? "other",
      file,
    }));
    onChange([...documents, ...additions]);
  }

  function updateType(id: string, type: string) {
    onChange(documents.map((doc) => (doc.id === id ? { ...doc, type } : doc)));
  }

  function removeDoc(id: string) {
    onChange(documents.filter((doc) => doc.id !== id));
  }

  return (
    <div className={styles.section}>
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.description}>{description}</p>

      <button
        type="button"
        className={styles.dropzone}
        onClick={() => fileInputRef.current?.click()}
      >
        <span className={styles.dropzoneIcon}>+</span>
        <span className={styles.dropzoneText}>{uploadLabel}</span>
      </button>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="application/pdf,image/png,image/jpeg"
        className={styles.hiddenInput}
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {documents.length > 0 && (
        <ul className={styles.list}>
          {documents.map((doc) => (
            <li key={doc.id} className={styles.row}>
              <span className={styles.fileName} title={doc.file.name}>
                {doc.file.name}
              </span>

              <select
                className={styles.select}
                value={doc.type}
                onChange={(e) => updateType(doc.id, e.target.value)}
              >
                {options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              <button
                type="button"
                className={styles.removeBtn}
                onClick={() => removeDoc(doc.id)}
                aria-label={`Remove ${doc.file.name}`}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
