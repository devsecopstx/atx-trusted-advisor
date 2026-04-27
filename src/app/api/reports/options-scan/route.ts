import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";
import { z } from "zod";

import { requireSessionUser } from "@/lib/auth";

const reportRowSchema = z.object({
  rowId: z.string().trim().min(1).max(160),
  source: z.enum(["holding", "watchlist"]),
  symbol: z.string().trim().min(1).max(32),
  strike: z.number().positive().optional(),
  exp: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  type: z.enum(["call", "put"]).optional(),
  qty: z.number().finite().optional(),
  recommendedAction: z.enum(["ROLL", "BTC", "HOLD", "LET_EXPIRE", "STC", "OPEN", "MONITOR", "WAIT"]),
  why: z.string().trim().min(1).max(500),
  urgency: z.enum(["high", "med", "low"]),
  targetWindow: z.string().trim().min(1).max(80),
  confidence: z.enum(["high", "medium", "low"]),
  applyToWatchlist: z.object({
    type: z.literal("apply_to_watchlist"),
    symbol: z.string().trim().min(1).max(32),
    allowPriceAlert: z.boolean(),
    defaultPriceAlertSeverity: z.literal("info")
  })
});

const bodySchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  scanData: z.object({
    generatedAt: z.string().datetime(),
    planTier: z.enum(["basic", "premium", "premium_plus", "global_admin"]),
    truncated: z.boolean(),
    rows: z.array(reportRowSchema).max(120),
    disclaimer: z.string().trim().min(1).max(1000)
  })
});

type PythonExecResult = {
  stdout: Buffer;
  stderr: string;
  exitCode: number;
};

async function runPythonReportGenerator(payload: unknown): Promise<PythonExecResult> {
  const scriptPath = path.join(process.cwd(), "services", "report-service", "options_scan_report.py");
  await fs.access(scriptPath);
  const pythonBin = process.env.PYTHON_BIN?.trim() || "python3";

  return await new Promise<PythonExecResult>((resolve) => {
    const child = spawn(pythonBin, [scriptPath, "--stdin"], {
      cwd: process.cwd(),
      env: process.env
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));
    child.on("error", (error: Error) => {
      stderrChunks.push(Buffer.from(String(error)));
    });
    child.on("close", (code) => {
      resolve({
        stdout: Buffer.concat(stdoutChunks),
        stderr: Buffer.concat(stderrChunks).toString("utf8"),
        exitCode: code ?? 1
      });
    });

    try {
      child.stdin.write(JSON.stringify(payload));
      child.stdin.end();
    } catch {
      child.kill("SIGKILL");
    }
  });
}

export async function POST(request: Request) {
  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid report payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  let result: PythonExecResult;
  try {
    result = await runPythonReportGenerator({
      title: parsed.data.title ?? "Options Action Scan Report",
      scanData: parsed.data.scanData
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Options scan report service unavailable",
        details: error instanceof Error ? error.message : "unknown_error"
      },
      { status: 503 }
    );
  }

  if (result.exitCode !== 0 || result.stdout.byteLength === 0) {
    console.error("[reports/options-scan] python report generation failed", {
      exitCode: result.exitCode,
      stderr: result.stderr.slice(0, 2000)
    });
    return NextResponse.json(
      { error: "Report generation failed", details: result.stderr || "no_output" },
      { status: 500 }
    );
  }

  const generatedAt = parsed.data.scanData.generatedAt.slice(0, 10);
  return new NextResponse(new Uint8Array(result.stdout), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="options-action-scan-${generatedAt}.pdf"`,
      "Cache-Control": "no-store"
    }
  });
}
