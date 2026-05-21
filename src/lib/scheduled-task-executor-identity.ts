import os from "node:os";

export type TaskRunExecutorEnvironment =
  | "local"
  | "development"
  | "staging"
  | "production"
  | "test"
  | "unknown";

export type TaskRunExecutor = {
  /** Process that executed (or enqueued) the job body. */
  runtime: "next" | "spring";
  environment: TaskRunExecutorEnvironment;
  /** Primary admin label, e.g. `Next · local · MacBook-Pro` or `Spring · production · rev-…`. */
  label: string;
  service?: string;
  revision?: string;
  host?: string;
  /** Next run invoked by Spring scheduler delegate HTTP. */
  delegateFrom?: "spring";
};

export type BuildTaskRunExecutorIdentityOptions = {
  runtime: TaskRunExecutor["runtime"];
  delegateFrom?: "spring";
};

function readDeployTarget(): string {
  return (process.env.ATX_DEPLOY_TARGET ?? process.env.DEPLOY_TARGET ?? "").trim().toLowerCase();
}

export function resolveTaskRunExecutorEnvironment(): TaskRunExecutorEnvironment {
  const deployTarget = readDeployTarget();
  if (deployTarget === "deploy" || deployTarget === "production" || deployTarget === "prod") {
    return "production";
  }
  if (deployTarget === "stage" || deployTarget === "staging") {
    return "staging";
  }

  const nodeEnv = (process.env.NODE_ENV ?? "development").trim().toLowerCase();
  if (nodeEnv === "test") {
    return "test";
  }
  if (nodeEnv === "development") {
    return "local";
  }
  if (nodeEnv === "production") {
    return process.env.K_SERVICE?.trim() ? "production" : "unknown";
  }
  return "unknown";
}

function formatEnvironmentLabel(environment: TaskRunExecutorEnvironment): string {
  switch (environment) {
    case "local":
      return "local";
    case "staging":
      return "staging";
    case "production":
      return "production";
    case "test":
      return "test";
    case "development":
      return "development";
    default:
      return "unknown";
  }
}

function readExecutorHost(): string | undefined {
  const kService = process.env.K_SERVICE?.trim();
  if (kService) {
    return kService;
  }
  const hostname = (process.env.POD_NAME ?? process.env.HOSTNAME ?? os.hostname()).trim();
  if (!hostname || hostname === "0.0.0.0") {
    return undefined;
  }
  return hostname;
}

function readServiceName(runtime: TaskRunExecutor["runtime"]): string | undefined {
  if (runtime === "next") {
    return process.env.K_SERVICE?.trim() || "atxfinance-core-app";
  }
  return process.env.K_SERVICE?.trim() || "atxfinance-backend";
}

export function buildScheduledTaskExecutorIdentity(
  options: BuildTaskRunExecutorIdentityOptions
): TaskRunExecutor {
  const environment = resolveTaskRunExecutorEnvironment();
  const service = readServiceName(options.runtime);
  const revision = process.env.K_REVISION?.trim() || undefined;
  const host = readExecutorHost();

  const runtimeTitle = options.runtime === "next" ? "Next" : "Spring";
  const labelParts = [runtimeTitle, formatEnvironmentLabel(environment)];
  if (options.delegateFrom === "spring") {
    labelParts.push("via Spring delegate");
  }
  if (revision) {
    const shortRev = revision.length > 36 ? `${revision.slice(0, 36)}…` : revision;
    labelParts.push(shortRev);
  } else if (host && environment === "local") {
    labelParts.push(host);
  }

  return {
    runtime: options.runtime,
    environment,
    label: labelParts.join(" · "),
    ...(service ? { service } : {}),
    ...(revision ? { revision } : {}),
    ...(host ? { host } : {}),
    ...(options.delegateFrom ? { delegateFrom: options.delegateFrom } : {})
  };
}
