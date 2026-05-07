export type OpsCostEstimateInputs = {
  xchatPromptsToday: number;
  xchatPromptsMtd: number;
  strategyJobsToday: number;
  strategyJobsMtd: number;
  /** Conservative vCPU·hours for Cloud Run–class compute (configurable). */
  estimatedCloudRunVcpuHoursToday: number;
  estimatedCloudRunVcpuHoursMtd: number;
};

export type OpsCostEstimateBreakdown = {
  xchatUsd: number;
  strategyJobsUsd: number;
  cloudRunUsd: number;
};

export type OpsCostEstimateResult = {
  currency: "USD";
  todayTotalUsd: number;
  monthToDateTotalUsd: number;
  today: OpsCostEstimateBreakdown;
  monthToDate: OpsCostEstimateBreakdown;
  rates: {
    xaiCostPerPromptUsd: number;
    strategyJobPerRunUsd: number;
    gcpRunCostPerVcpuHourUsd: number;
  };
  notes: string[];
};

function parseRate(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === "") {
    return fallback;
  }
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function readOpsCostRatesFromEnv(): OpsCostEstimateResult["rates"] {
  return {
    xaiCostPerPromptUsd: parseRate(process.env.OPS_SUMMARY_XAI_COST_PER_PROMPT_USD, 0.0008),
    strategyJobPerRunUsd: parseRate(process.env.OPS_SUMMARY_STRATEGY_JOB_USD, 0.002),
    gcpRunCostPerVcpuHourUsd: parseRate(process.env.OPS_SUMMARY_GCP_VCPU_HOUR_USD, 0.0005)
  };
}

export function readDefaultCloudRunVcpuHoursToday(): number {
  return parseRate(process.env.OPS_SUMMARY_CLOUD_RUN_VCPU_HOURS_TODAY, 24);
}

/** MTD scale: multiply today's hourly rate by day-of-month (conservative, auditable). */
export function defaultCloudRunVcpuHoursMtd(now: Date, hoursToday: number): number {
  const dom = now.getUTCDate();
  return Math.max(0, hoursToday) * dom;
}

export function computeOpsCostEstimate(
  inputs: OpsCostEstimateInputs,
  rates: OpsCostEstimateResult["rates"],
  notes: string[] = []
): OpsCostEstimateResult {
  const today: OpsCostEstimateBreakdown = {
    xchatUsd: inputs.xchatPromptsToday * rates.xaiCostPerPromptUsd,
    strategyJobsUsd: inputs.strategyJobsToday * rates.strategyJobPerRunUsd,
    cloudRunUsd: inputs.estimatedCloudRunVcpuHoursToday * rates.gcpRunCostPerVcpuHourUsd
  };
  const monthToDate: OpsCostEstimateBreakdown = {
    xchatUsd: inputs.xchatPromptsMtd * rates.xaiCostPerPromptUsd,
    strategyJobsUsd: inputs.strategyJobsMtd * rates.strategyJobPerRunUsd,
    cloudRunUsd: inputs.estimatedCloudRunVcpuHoursMtd * rates.gcpRunCostPerVcpuHourUsd
  };
  const todayTotalUsd = today.xchatUsd + today.strategyJobsUsd + today.cloudRunUsd;
  const monthToDateTotalUsd =
    monthToDate.xchatUsd + monthToDate.strategyJobsUsd + monthToDate.cloudRunUsd;
  return {
    currency: "USD",
    todayTotalUsd,
    monthToDateTotalUsd,
    today,
    monthToDate,
    rates,
    notes
  };
}
