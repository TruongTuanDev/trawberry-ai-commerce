"use client";

import { useState } from "react";

export function MessageComposer({
  placeholder,
  submitLabel,
  submittingLabel,
  disabled,
  onSubmit,
  testIdPrefix,
}: {
  placeholder: string;
  submitLabel: string;
  submittingLabel: string;
  disabled?: boolean;
  onSubmit: (message: string) => Promise<void>;
  testIdPrefix: string;
}) {
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (disabled || submitting) {
      return;
    }
    const trimmed = message.trim();
    if (!trimmed) {
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(trimmed);
      setMessage("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-[1.5rem] border border-[var(--border)] bg-white p-4">
      <textarea
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder={placeholder}
        className="min-h-[120px] w-full rounded-[1.15rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)]"
        data-testid={`${testIdPrefix}-input`}
      />
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={disabled || submitting}
          className="public-button-primary px-4 py-2 text-sm disabled:opacity-60"
          data-testid={`${testIdPrefix}-submit`}
        >
          {submitting ? submittingLabel : submitLabel}
        </button>
      </div>
    </div>
  );
}
