export function isTextLikeMimeType(mimeType: string): boolean {
  if (mimeType.startsWith("text/")) {
    return true;
  }
  return (
    mimeType === "application/json" ||
    mimeType === "application/xml" ||
    mimeType === "application/javascript"
  );
}

export function chunkText(
  text: string,
  options?: {
    chunkSize?: number;
    overlap?: number;
  }
): Array<{ text: string; tokenEstimate: number }> {
  const cleaned = text.replace(/\r\n/g, "\n").trim();
  if (!cleaned) {
    return [];
  }

  const chunkSize = options?.chunkSize ?? 900;
  const overlap = options?.overlap ?? 120;
  const chunks: Array<{ text: string; tokenEstimate: number }> = [];

  let cursor = 0;
  while (cursor < cleaned.length) {
    const end = Math.min(cleaned.length, cursor + chunkSize);
    const chunk = cleaned.slice(cursor, end).trim();
    if (chunk.length > 0) {
      chunks.push({
        text: chunk,
        tokenEstimate: Math.ceil(chunk.length / 4)
      });
    }
    if (end >= cleaned.length) {
      break;
    }
    cursor = Math.max(0, end - overlap);
  }

  return chunks;
}
