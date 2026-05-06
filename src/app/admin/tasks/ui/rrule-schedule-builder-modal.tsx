"use client";

import cronstrue from "cronstrue";
import { useMemo, useState } from "react";
import rruleModule from "rrule";

const { RRule, rrulestr } = rruleModule;

type ScheduleDraft = {
  scheduleRRule?: string;
  scheduleCron?: string;
  scheduleDescription?: string;
};

type Props = {
  open: boolean;
  title: string;
  initial: ScheduleDraft;
  disabled?: boolean;
  onClose: () => void;
  onApply: (next: Required<Pick<ScheduleDraft, "scheduleRRule" | "scheduleDescription">> & Pick<ScheduleDraft, "scheduleCron">) => void;
};

function buildPresetRRule(preset: "daily_8" | "weekly_mon_9" | "monthly_1st_9" | "eom_16"): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const day = now.getUTCDate();
  if (preset === "daily_8") {
    return new RRule({
      freq: RRule.DAILY,
      interval: 1,
      byhour: [8],
      byminute: [0],
      dtstart: new Date(Date.UTC(year, month, day, 8, 0, 0))
    }).toString();
  }
  if (preset === "weekly_mon_9") {
    return new RRule({
      freq: RRule.WEEKLY,
      interval: 1,
      byweekday: [RRule.MO],
      byhour: [9],
      byminute: [0],
      dtstart: new Date(Date.UTC(year, month, day, 9, 0, 0))
    }).toString();
  }
  if (preset === "monthly_1st_9") {
    return new RRule({
      freq: RRule.MONTHLY,
      interval: 1,
      bymonthday: [1],
      byhour: [9],
      byminute: [0],
      dtstart: new Date(Date.UTC(year, month, day, 9, 0, 0))
    }).toString();
  }
  return new RRule({
    freq: RRule.MONTHLY,
    interval: 1,
    bymonthday: [-1],
    byhour: [16],
    byminute: [0],
    dtstart: new Date(Date.UTC(year, month, day, 16, 0, 0))
  }).toString();
}

function rruleToCronFallback(rruleValue: string): string | undefined {
  try {
    const parsed = rrulestr(rruleValue);
    if (!(parsed instanceof RRule)) {
      return undefined;
    }
    const options = parsed.origOptions;
    const interval = options.interval ?? 1;
    const hour = Array.isArray(options.byhour) ? options.byhour[0] : undefined;
    const minute = Array.isArray(options.byminute) ? options.byminute[0] : undefined;
    if (hour === undefined || minute === undefined) {
      return undefined;
    }

    if (options.freq === RRule.DAILY && interval === 1) {
      return `${minute} ${hour} * * *`;
    }
    if (options.freq === RRule.WEEKLY && interval === 1) {
      const daysRaw = Array.isArray(options.byweekday)
        ? options.byweekday
        : options.byweekday !== undefined
          ? [options.byweekday]
          : [];
      const days = daysRaw
        .map((day) => {
          if (typeof day === "number") {
            return day;
          }
          if (day && typeof day === "object" && "weekday" in day) {
            return day.weekday;
          }
          return undefined;
        })
        .filter((day): day is number => day !== undefined)
        .sort((a, b) => a - b);
      if (days.length > 0) {
        return `${minute} ${hour} * * ${days.join(",")}`;
      }
    }
    if (options.freq === RRule.MONTHLY && interval === 1 && Array.isArray(options.bymonthday)) {
      const monthDay = options.bymonthday[0];
      if (typeof monthDay === "number" && monthDay > 0) {
        return `${minute} ${hour} ${monthDay} * *`;
      }
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export function RRuleScheduleBuilderModal({
  open,
  title,
  initial,
  disabled,
  onClose,
  onApply
}: Props) {
  const [rruleValue, setRRuleValue] = useState<string>(
    initial.scheduleRRule ?? buildPresetRRule("daily_8")
  );

  const built = useMemo(() => {
    try {
      const parsed = rrulestr(rruleValue);
      const rule = parsed instanceof RRule ? parsed : null;
      const scheduleRRule = rule?.toString() ?? rruleValue;
      const scheduleDescription = (rule?.toText() ?? "Custom RRULE schedule").slice(0, 280);
      const scheduleCron = rruleToCronFallback(scheduleRRule);
      const cronDescription =
        scheduleCron != null
          ? (() => {
              try {
                return cronstrue.toString(scheduleCron);
              } catch {
                return "";
              }
            })()
          : "";
      return { isValid: true, scheduleRRule, scheduleDescription, scheduleCron, cronDescription };
    } catch {
      return {
        isValid: false,
        scheduleRRule: rruleValue,
        scheduleDescription: "Invalid RRULE",
        scheduleCron: undefined,
        cronDescription: ""
      };
    }
  }, [rruleValue]);

  if (!open) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 80,
        padding: "1rem"
      }}
      onClick={onClose}
    >
      <div
        className="surface-card xf-widget section-card"
        style={{ width: "min(980px, 100%)", maxHeight: "90vh", overflow: "auto" }}
        onClick={(event) => event.stopPropagation()}
      >
        <h3>{title}</h3>
        <p className="status-text" style={{ marginBottom: "0.65rem" }}>
          RRULE scheduler with finance presets. Apply to save expression + human-readable summary.
        </p>

        <div className="tool-row" style={{ gap: "0.5rem", marginBottom: "0.65rem", flexWrap: "wrap" }}>
          <button
            type="button"
            className="tiny-button"
            disabled={disabled}
            onClick={() => setRRuleValue(buildPresetRRule("daily_8"))}
          >
            Daily 8:00
          </button>
          <button
            type="button"
            className="tiny-button"
            disabled={disabled}
            onClick={() => setRRuleValue(buildPresetRRule("weekly_mon_9"))}
          >
            Weekly Mon 9:00
          </button>
          <button
            type="button"
            className="tiny-button"
            disabled={disabled}
            onClick={() => setRRuleValue(buildPresetRRule("monthly_1st_9"))}
          >
            Monthly 1st 9:00
          </button>
          <button
            type="button"
            className="tiny-button"
            disabled={disabled}
            onClick={() => setRRuleValue(buildPresetRRule("eom_16"))}
          >
            End of month 16:00
          </button>
        </div>

        <div className="surface-card" style={{ border: "1px solid var(--xf-border-subtle)", padding: "0.75rem" }}>
          <label className="status-text" htmlFor="rrule-editor">
            RRULE expression
          </label>
          <textarea
            id="rrule-editor"
            className="crud-input font-mono text-xs"
            rows={4}
            disabled={disabled}
            value={rruleValue}
            onChange={(event) => setRRuleValue(event.currentTarget.value)}
          />
          <p className="status-text" style={{ marginTop: "0.5rem" }}>
            Use presets above or paste full RRULE (`FREQ=...;INTERVAL=...`). DTSTART is optional.
          </p>
        </div>

        <div className="stack-gap" style={{ marginTop: "0.8rem" }}>
          <p className="status-text">
            RRULE: <code className="font-mono text-xs">{built.scheduleRRule}</code>
          </p>
          <p className="status-text">
            Human: <code className="font-mono text-xs">{built.scheduleDescription}</code>
          </p>
          <p className="status-text">
            Cron fallback:{" "}
            <code className="font-mono text-xs">{built.scheduleCron ?? "not representable as simple cron"}</code>
          </p>
          {built.cronDescription ? (
            <p className="status-text">
              Cron readable: <code className="font-mono text-xs">{built.cronDescription}</code>
            </p>
          ) : null}
        </div>

        <div className="tool-row" style={{ marginTop: "0.8rem" }}>
          <button className="cta cta-secondary" type="button" onClick={onClose} disabled={disabled}>
            Cancel
          </button>
          <button
            className="cta cta-primary"
            type="button"
            disabled={disabled || !built.isValid}
            onClick={() =>
              onApply({
                scheduleRRule: built.scheduleRRule,
                scheduleCron: built.scheduleCron,
                scheduleDescription: built.scheduleDescription
              })
            }
          >
            Apply Schedule
          </button>
        </div>
      </div>
    </div>
  );
}
