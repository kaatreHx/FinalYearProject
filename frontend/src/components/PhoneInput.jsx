import { useEffect, useState } from "react";

/**
 * Country dial codes offered in the phone inputs. Nepal is the default so
 * numbers are consistent everywhere (always stored as "+977 9801234567").
 */
const COUNTRIES = [
  { code: "+977", label: "Nepal (+977)" },
  { code: "+91", label: "India (+91)" },
  { code: "+1", label: "USA / Canada (+1)" },
  { code: "+44", label: "UK (+44)" },
  { code: "+61", label: "Australia (+61)" },
  { code: "+86", label: "China (+86)" },
  { code: "+971", label: "UAE (+971)" },
  { code: "+974", label: "Qatar (+974)" },
  { code: "+966", label: "Saudi Arabia (+966)" },
  { code: "+65", label: "Singapore (+65)" },
  { code: "+60", label: "Malaysia (+60)" },
  { code: "+81", label: "Japan (+81)" },
  { code: "+82", label: "South Korea (+82)" },
  { code: "+49", label: "Germany (+49)" },
  { code: "+33", label: "France (+33)" },
];

const DEFAULT_CODE = "+977";

/** Split a stored value such as "+977 9801234567" into code + local number. */
function split(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(\+\d{1,4})\s*(.*)$/);
  if (match) return { code: match[1], number: match[2] };
  // No country code saved yet - assume the default and keep the digits.
  return { code: DEFAULT_CODE, number: text };
}

/**
 * Phone input with a country-code selector. Always emits a single string
 * including the code (e.g. "+977 9801234567"), so no number is stored without
 * one.
 */
export default function PhoneInput({ value, onChange, placeholder = "98XXXXXXXX" }) {
  const [code, setCode] = useState(() => split(value).code);
  const [number, setNumber] = useState(() => split(value).number);

  // Re-sync when the parent loads a value from outside (e.g. the saved profile).
  useEffect(() => {
    const parsed = split(value);
    setNumber(parsed.number);
    setCode((current) => (value ? parsed.code : current));
  }, [value]);

  const emit = (nextCode, nextNumber) => {
    onChange(nextNumber ? `${nextCode} ${nextNumber}` : "");
  };

  // Make sure a saved code that isn't in the list still appears.
  const options = COUNTRIES.some((c) => c.code === code)
    ? COUNTRIES
    : [{ code, label: code }, ...COUNTRIES];

  return (
    <div className="phone-input">
      <select
        aria-label="Country code"
        value={code}
        onChange={(e) => {
          setCode(e.target.value);
          emit(e.target.value, number);
        }}
      >
        {options.map((c) => (
          <option key={c.code} value={c.code}>
            {c.label}
          </option>
        ))}
      </select>
      <input
        type="tel"
        value={number}
        onChange={(e) => {
          setNumber(e.target.value);
          emit(code, e.target.value);
        }}
        placeholder={placeholder}
      />
    </div>
  );
}
