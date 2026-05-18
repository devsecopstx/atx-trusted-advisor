#!/usr/bin/env python3
"""
PDF → Markdown chunks for aTx RAG ingest (pymupdf4llm).

Reads JSON from stdin:
  { "pdfPath": "/abs/path.pdf", "maxChunkChars": 12000 }

Writes JSON to stdout:
  { "pageCount": N, "title": "...", "chunks": [{ "index": 1, "markdown": "...", "pageStart": 1, "pageEnd": 3 }] }
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any, Dict, List


def _split_markdown_chunks(full_md: str, max_chars: int) -> List[str]:
    text = full_md.strip()
    if not text:
        return [""]

    sections = re.split(r"(?=\n#{1,3} )", text)
    chunks: List[str] = []
    buf = ""

    def flush() -> None:
        nonlocal buf
        if buf.strip():
            chunks.append(buf.strip())
        buf = ""

    for section in sections:
        section = section.strip()
        if not section:
            continue
        candidate = f"{buf}\n\n{section}".strip() if buf else section
        if len(candidate) <= max_chars:
            buf = candidate
            continue
        flush()
        if len(section) <= max_chars:
            buf = section
            continue
        # Hard split long sections by paragraphs
        paras = section.split("\n\n")
        part = ""
        for para in paras:
            next_part = f"{part}\n\n{para}".strip() if part else para
            if len(next_part) <= max_chars:
                part = next_part
            else:
                if part:
                    chunks.append(part.strip())
                if len(para) <= max_chars:
                    part = para
                else:
                    for i in range(0, len(para), max_chars):
                        chunks.append(para[i : i + max_chars].strip())
                    part = ""
        if part:
            buf = part
    flush()
    return chunks if chunks else [text[:max_chars]]


def ingest_pdf(pdf_path: str, max_chunk_chars: int = 12_000) -> Dict[str, Any]:
    path = Path(pdf_path).resolve()
    if not path.is_file():
        raise FileNotFoundError(f"PDF not found: {path}")

    try:
        import pymupdf4llm  # type: ignore
    except ImportError as exc:
        raise RuntimeError(
            "pymupdf4llm is not installed. Run: pip install -r services/pdf-ingest/requirements.txt"
        ) from exc

    import fitz  # type: ignore

    doc = fitz.open(str(path))
    page_count = doc.page_count
    doc.close()

    full_md = pymupdf4llm.to_markdown(str(path))
    title_match = re.search(r"^#\s+(.+)$", full_md, re.MULTILINE)
    title = title_match.group(1).strip() if title_match else path.stem

    raw_chunks = _split_markdown_chunks(full_md, max_chunk_chars)
    chunks_out: List[Dict[str, Any]] = []
    for idx, body in enumerate(raw_chunks, start=1):
        chunks_out.append(
            {
                "index": idx,
                "markdown": body,
                "pageStart": 1 if idx == 1 else None,
                "pageEnd": page_count if idx == len(raw_chunks) else None,
            }
        )

    return {"pageCount": page_count, "title": title, "chunks": chunks_out}


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError as exc:
        print(json.dumps({"error": f"invalid stdin JSON: {exc}"}), file=sys.stderr)
        return 2

    pdf_path = payload.get("pdfPath")
    if not isinstance(pdf_path, str) or not pdf_path.strip():
        print(json.dumps({"error": "pdfPath is required"}), file=sys.stderr)
        return 2

    max_chunk = payload.get("maxChunkChars", 12_000)
    if not isinstance(max_chunk, int) or max_chunk < 2000:
        max_chunk = 12_000

    try:
        result = ingest_pdf(pdf_path.strip(), max_chunk)
    except Exception as exc:  # noqa: BLE001 — CLI boundary
        print(json.dumps({"error": str(exc)}), file=sys.stderr)
        return 1

    json.dump(result, sys.stdout, ensure_ascii=False)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
