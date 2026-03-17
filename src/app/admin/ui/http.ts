"use client";

export async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      code?: string;
      details?: {
        formErrors?: string[];
        fieldErrors?: Record<string, string[] | undefined>;
      };
    };
    const detailText = formatErrorDetails(payload.details);
    const baseMessage = payload.error ?? `Request failed (${response.status})`;
    const codeSuffix = payload.code ? ` [${payload.code}]` : "";
    const messageSuffix = detailText ? ` - ${detailText}` : "";
    throw new Error(`${baseMessage}${codeSuffix}${messageSuffix}`);
  }

  return (await response.json()) as T;
}

function formatErrorDetails(details: {
  formErrors?: string[];
  fieldErrors?: Record<string, string[] | undefined>;
} | undefined): string {
  if (!details) {
    return "";
  }

  const formErrors = (details.formErrors ?? []).filter(Boolean);
  const fieldErrors = Object.entries(details.fieldErrors ?? {}).flatMap(([field, messages]) =>
    (messages ?? []).filter(Boolean).map((message) => `${field}: ${message}`)
  );
  const combined = [...formErrors, ...fieldErrors];

  return combined.join("; ");
}
