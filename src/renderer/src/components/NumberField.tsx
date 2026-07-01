import { useEffect, useState } from 'react'

/**
 * Strict numeric format: optional sign, an integer part with no leading zeros
 * ("0" or "1".."9" followed by digits) or a bare fraction (".5"), an optional
 * fractional part, and an optional exponent. Accepts 0, 0.5, 1e-4; rejects
 * "0123", "00", "01.5".
 */
const NUMBER_RE = /^[+-]?(?:(?:0|[1-9]\d*)(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?$/

interface Props {
  label: string
  value: number
  onChange: (n: number) => void
  hint?: string
}

/**
 * Numeric input that is pleasant to type in. The raw text is held in local state
 * so the user can clear the field, type intermediate values (e.g. "1e-", "0.")
 * and scientific notation without the value snapping to 0 or being coerced on
 * every keystroke. The parsed number is committed to `onChange` only when the
 * text is a valid number (see NUMBER_RE — no leading zeros); on blur, an
 * empty/invalid field defaults to 0.
 */
export default function NumberField({ label, value, onChange, hint }: Props): JSX.Element {
  const [text, setText] = useState(() => String(value))

  // Re-sync when the value changes from outside (benchmark pick, reset, etc.).
  // The guard avoids clobbering the field while the user is mid-edit on a value
  // that already parses to the current number.
  useEffect(() => {
    if (Number(text) !== value) setText(String(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  function handleChange(raw: string): void {
    setText(raw)
    const trimmed = raw.trim()
    if (NUMBER_RE.test(trimmed)) onChange(Number(trimmed))
  }

  function handleBlur(): void {
    const trimmed = text.trim()
    if (NUMBER_RE.test(trimmed)) {
      // Normalize a bare fraction so it shows the leading 0: ".124" -> "0.124".
      const normalized = trimmed.replace(/^([+-]?)\./, '$10.')
      if (normalized !== text) setText(normalized)
    } else {
      // Empty or malformed input (including leading-zero values like "0123")
      // defaults to 0.
      setText('0')
      onChange(0)
    }
  }

  return (
    <div className="field">
      <label>{label}</label>
      <input
        type="text"
        inputMode="decimal"
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
      />
      {hint && (
        <span className="muted" style={{ fontSize: 12 }}>
          {hint}
        </span>
      )}
    </div>
  )
}
