"use client";

type ErrorPayload = {
  error?: string;
  message?: string;
  code?: string;
  details?: {
    formErrors?: string[];
    fieldErrors?: Record<string, string[] | undefined>;
  };
};

function parseErrorPayload(rawText: string, trimmed: string): ErrorPayload {
  if (!trimmed.startsWith("{")) {
    return {};
  }
  try {
    return JSON.parse(rawText) as ErrorPayload;
  } catch {
    return {};
  }
}

export async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const rawText = await response.text();
    const trimmed = rawText.trim();
    const payload = parseErrorPayload(rawText, trimmed);
    const detailText = formatErrorDetails(payload.details);

    if (response.status === 429) {
      const baseMessage =
        payload.error ??
        payload.message ??
        "Too many requests. Please wait a moment and retry.";
      const codeSuffix = payload.code ? ` [${payload.code}]` : "";
      const messageSuffix = detailText ? ` - ${detailText}` : "";
      throw new Error(`${baseMessage}${codeSuffix}${messageSuffix}`);
    }

    const baseMessage =
      payload.error ??
      payload.message ??
      (!trimmed.startsWith("{") && trimmed
        ? trimmed.slice(0, 300)
        : `Request failed (${response.status})`);
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
