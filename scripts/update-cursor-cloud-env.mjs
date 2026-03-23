import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const requiredKeys = [
  "MONGODB_URI",
  "XAI_API_KEY",
  "XAI_MANAGEMENT_API_KEY",
  "X_OAUTH_CLIENT_ID",
  "X_OAUTH_CLIENT_SECRET",
  "AUTH_SECRET",
  "ADMIN_SEED_EMAIL"
];

const optionalKeys = [
  "ALLOW_ANY_X_USER_LOGIN",
  "SLACK_WEBHOOK_URL",
  "ADMIN_X_USERNAMES",
  "X_OAUTH_CALLBACK_URL"
];

const args = new Set(process.argv.slice(2));
const force = args.has("--force");
const cwd = process.cwd();
const envPath = resolve(cwd, ".env");
const envExamplePath = resolve(cwd, ".env.example");
const cursorDirPath = resolve(cwd, ".cursor");
const worktreesPath = resolve(cursorDirPath, "worktrees.json");

function formatValue(value) {
  if (value === "") {
    return '""';
  }

  if (/[\r\n]/.test(value)) {
    return JSON.stringify(value);
  }

  if (/[\s#"'`]/.test(value)) {
    return JSON.stringify(value);
  }

  return value;
}

function isDefined(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function ensureCursorWorktreesFile() {
  mkdirSync(cursorDirPath, { recursive: true });

  if (existsSync(worktreesPath)) {
    return false;
  }

  const defaultWorktrees = {
    version: 1,
    worktrees: []
  };
  writeFileSync(worktreesPath, `${JSON.stringify(defaultWorktrees, null, 2)}\n`);
  return true;
}

function buildEnvContentFromProcess() {
  const lines = [
    "# Auto-generated for Cursor Cloud agent runtime.",
    "# Source: injected process environment values."
  ];

  for (const key of requiredKeys) {
    const value = process.env[key];
    if (isDefined(value)) {
      lines.push(`${key}=${formatValue(value)}`);
    }
  }

  for (const key of optionalKeys) {
    const value = process.env[key];
    if (typeof value === "string") {
      lines.push(`${key}=${formatValue(value)}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

function ensureEnvFile() {
  if (existsSync(envPath) && !force) {
    return { status: "exists" };
  }

  const missingRequiredKeys = requiredKeys.filter((key) => !isDefined(process.env[key]));
  if (missingRequiredKeys.length === 0) {
    const envContent = buildEnvContentFromProcess();
    writeFileSync(envPath, envContent);
    return { status: "generated", source: "injected-secrets" };
  }

  if (!existsSync(envExamplePath)) {
    const fallback = `${requiredKeys
      .map((key) => `${key}=replace-me`)
      .join("\n")}\n`;
    writeFileSync(envPath, fallback);
    return { status: "generated", source: "fallback-template", missingRequiredKeys };
  }

  const template = readFileSync(envExamplePath, "utf8");
  writeFileSync(envPath, template);
  return { status: "generated", source: ".env.example", missingRequiredKeys };
}

const createdWorktrees = ensureCursorWorktreesFile();
const envResult = ensureEnvFile();

if (createdWorktrees) {
  console.log("Created .cursor/worktrees.json");
} else {
  console.log("Found existing .cursor/worktrees.json");
}

if (envResult.status === "exists") {
  console.log("Found existing .env (no changes)");
} else if (envResult.source === "injected-secrets") {
  console.log("Generated .env from injected environment secrets");
} else if (envResult.source === ".env.example") {
  console.log("Generated .env from .env.example (injected secrets incomplete)");
} else {
  console.log("Generated .env fallback template (injected secrets incomplete, no .env.example)");
}

if (
  envResult.status === "generated" &&
  "missingRequiredKeys" in envResult &&
  Array.isArray(envResult.missingRequiredKeys) &&
  envResult.missingRequiredKeys.length > 0
) {
  console.log(`Missing injected required keys: ${envResult.missingRequiredKeys.join(", ")}`);
}
