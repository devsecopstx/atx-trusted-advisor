import { execFile } from "node:child_process";
import { mkdtemp, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { isVisionVirusScanEnabled, readVisionClamscanBinFromEnv } from "@/lib/env";

const execFileAsync = promisify(execFile);

function execExitCode(error: unknown): number | undefined {
  if (!error || typeof error !== "object") {
    return undefined;
  }
  const code = (error as { code?: unknown }).code;
  return typeof code === "number" ? code : undefined;
}

export type VisionVirusScanOk = { ok: true; scanned: boolean };
export type VisionVirusScanThreat = { ok: false; kind: "threat"; scanned: true };
export type VisionVirusScanError = { ok: false; kind: "scan_error"; scanned: boolean; message: string };

export type VisionVirusScanResult = VisionVirusScanOk | VisionVirusScanThreat | VisionVirusScanError;

/**
 * When `VISION_VIRUS_SCAN_ENABLED=true`, runs `clamscan` (or `VISION_CLAMSCAN_BIN`) on a buffer via a temp file.
 * Exit code **1** = infected; **0** = clean. Other non-zero = infrastructure failure (**fail-closed** when enabled).
 */
export async function scanImageBufferWithClamAV(buf: Buffer): Promise<VisionVirusScanResult> {
  if (!isVisionVirusScanEnabled()) {
    return { ok: true, scanned: false };
  }
  if (buf.length === 0) {
    return { ok: false, kind: "scan_error", scanned: true, message: "empty_buffer" };
  }
  const bin = readVisionClamscanBinFromEnv();
  const dir = await mkdtemp(join(tmpdir(), "xf-vision-"));
  const filePath = join(dir, "scan.bin");
  try {
    await writeFile(filePath, buf, { mode: 0o600 });
    await execFileAsync(
      bin,
      ["--no-summary", "--stdout", "--infected", filePath],
      {
        maxBuffer: 2_000_000,
        timeout: 120_000,
        killSignal: "SIGKILL"
      }
    );
    return { ok: true, scanned: true };
  } catch (error: unknown) {
    const code = execExitCode(error);
    if (code === 1) {
      return { ok: false, kind: "threat", scanned: true };
    }
    const msg = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      kind: "scan_error",
      scanned: true,
      message: code != null ? `clamscan_exit_${code}:${msg}` : msg
    };
  } finally {
    try {
      await unlink(filePath);
    } catch {
      /* ignore */
    }
  }
}
