"use client";

import cronstrue from "cronstrue";
import { useMemo, useState } from "react";
import { RRule, rrulestr } from "rrule";

type ScheduleDraft = {
  scheduleRRule?: string;
  scheduleCron?: string;
  scheduleDescription?: string;
};

type BuilderFrequency = "DAILY" | "WEEKLY" | "MONTHLY";
type MonthMode = "day_of_month" | "last_day";

type Props = {
  open: boolean;
  title: string;
  initial: ScheduleDraft;
  disabled?: boolean;
  onClose: () => void;
  onApply: (next: Required<Pick<ScheduleDraft, "scheduleRRule" | "scheduleDescription">> & Pick<ScheduleDraft, "scheduleCron">) => void;
};

const WEEK_DAYS: Array<{ key: number; label: string }> = [
  { key: 1, label: "Mon" },
  { key: 2, label: "Tue" },
  { key: 3, label: "Wed" },
  { key: 4, label: "Thu" },
  { key: 5, label: "Fri" },
  { key: 6, label: "Sat" },
  { key: 0, label: "Sun" }
];

type SchedulerState = {
  frequency: BuilderFrequency;
  interval: number;
  hour: number;
  minute: number;
  weekDays: number[];
  monthMode: MonthMode;
  monthDay: number;
};

function weekdayLabelToNumber(value: string): number {
  switch (value) {
    case "SU":
      return 0;
    case "MO":
      return 1;
    case "TU":
      return 2;
    case "WE":
      return 3;
    case "TH":
      return 4;
    case "FR":
      return 5;
    case "SA":
      return 6;
    default:
      return 1;
  }
}

function parseRRuleToState(rruleValue?: string): SchedulerState {
  const fallback: SchedulerState = {
    frequency: "DAILY",
    interval: 1,
    hour: 9,
    minute: 0,
    weekDays: [1],
    monthMode: "day_of_month",
    monthDay: 1
  };
  if (!rruleValue) {
    return fallback;
  }
  try {
    const parsed = rrulestr(rruleValue);
    if (!(parsed instanceof RRule)) {
      return fallback;
    }
    const options = parsed.origOptions;
    const hour = Array.isArray(options.byhour) ? options.byhour[0] ?? 9 : 9;
    const minute = Array.isArray(options.byminute) ? options.byminute[0] ?? 0 : 0;
    const interval = options.interval ?? 1;
    if (options.freq === RRule.WEEKLY) {
      const byweekday = Array.isArray(options.byweekday)
        ? options.byweekday
        : options.byweekday !== undefined
          ? [options.byweekday]
          : [RRule.MO];
      const days = byweekday.map((day) => {
        if (day == null) {
          return 1;
        }
        if (typeof day === "number") {
          return day;
        }
        if (typeof day === "string") {
          return weekdayLabelToNumber(day);
        }
        return day.weekday;
      });
      return {
        frequency: "WEEKLY",
        interval,
        hour,
        minute,
        weekDays: days,
        monthMode: "day_of_month",
        monthDay: 1
      };
    }
    if (options.freq === RRule.MONTHLY) {
      const monthDay = Array.isArray(options.bymonthday) ? options.bymonthday[0] ?? 1 : 1;
      return {
        frequency: "MONTHLY",
        interval,
        hour,
        minute,
        weekDays: [1],
        monthMode: monthDay === -1 ? "last_day" : "day_of_month",
        monthDay: monthDay > 0 ? monthDay : 1
      };
    }
    return {
      frequency: "DAILY",
      interval,
      hour,
      minute,
      weekDays: [1],
      monthMode: "day_of_month",
      monthDay: 1
    };
  } catch {
    return fallback;
  }
}

function monthDayOptions(): number[] {
  return Array.from({ length: 31 }, (_, idx) => idx + 1);
}

function buildRRuleFromState(state: SchedulerState): RRule {
  const now = new Date();
  const dtstart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), state.hour, state.minute, 0)
  );
  if (state.frequency === "DAILY") {
    return new RRule({
      freq: RRule.DAILY,
      interval: state.interval,
      byhour: [state.hour],
      byminute: [state.minute],
      dtstart
    });
  }
  if (state.frequency === "WEEKLY") {
    const weekdays = state.weekDays.length > 0 ? state.weekDays : [1];
    const byweekday = weekdays.map((day) => weekdayFromNumber(day));
    return new RRule({
      freq: RRule.WEEKLY,
      interval: state.interval,
      byhour: [state.hour],
      byminute: [state.minute],
      byweekday,
      dtstart
    });
  }
  return new RRule({
    freq: RRule.MONTHLY,
    interval: state.interval,
    byhour: [state.hour],
    byminute: [state.minute],
    bymonthday: [state.monthMode === "last_day" ? -1 : state.monthDay],
    dtstart
  });
}

function weekdayFromNumber(value: number) {
  switch (value) {
    case 0:
      return RRule.SU;
    case 1:
      return RRule.MO;
    case 2:
      return RRule.TU;
    case 3:
      return RRule.WE;
    case 4:
      return RRule.TH;
    case 5:
      return RRule.FR;
    case 6:
      return RRule.SA;
    default:
      return RRule.MO;
  }
}

function cronSuggestionFromState(state: SchedulerState): string | undefined {
  if (state.frequency === "DAILY" && state.interval === 1) {
    return `${state.minute} ${state.hour} * * *`;
  }
  if (state.frequency === "WEEKLY" && state.interval === 1 && state.weekDays.length > 0) {
    const sorted = [...state.weekDays].sort((a, b) => a - b).join(",");
    return `${state.minute} ${state.hour} * * ${sorted}`;
  }
  if (state.frequency === "MONTHLY" && state.interval === 1 && state.monthMode === "day_of_month") {
    return `${state.minute} ${state.hour} ${state.monthDay} * *`;
  }
  return undefined;
}

export function RRuleScheduleBuilderModal({
  open,
  title,
  initial,
  disabled,
  onClose,
  onApply
}: Props) {
  const [state, setState] = useState<SchedulerState>(() => parseRRuleToState(initial.scheduleRRule));

  const built = useMemo(() => {
    const rule = buildRRuleFromState(state);
    const scheduleRRule = rule.toString();
    const scheduleDescription = rule.toText().slice(0, 280);
    const scheduleCron = cronSuggestionFromState(state);
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
    return { scheduleRRule, scheduleDescription, scheduleCron, cronDescription };
  }, [state]);

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
            onClick={() =>
              setState((prev) => ({ ...prev, frequency: "DAILY", interval: 1, hour: 8, minute: 0 }))
            }
          >
            Daily 8:00
          </button>
          <button
            type="button"
            className="tiny-button"
            disabled={disabled}
            onClick={() =>
              setState((prev) => ({
                ...prev,
                frequency: "WEEKLY",
                interval: 1,
                weekDays: [1],
                hour: 9,
                minute: 0
              }))
            }
          >
            Weekly Mon 9:00
          </button>
          <button
            type="button"
            className="tiny-button"
            disabled={disabled}
            onClick={() =>
              setState((prev) => ({
                ...prev,
                frequency: "MONTHLY",
                interval: 1,
                monthMode: "day_of_month",
                monthDay: 1,
                hour: 9,
                minute: 0
              }))
            }
          >
            Monthly 1st 9:00
          </button>
          <button
            type="button"
            className="tiny-button"
            disabled={disabled}
            onClick={() =>
              setState((prev) => ({
                ...prev,
                frequency: "MONTHLY",
                interval: 1,
                monthMode: "last_day",
                hour: 16,
                minute: 0
              }))
            }
          >
            End of month 16:00
          </button>
        </div>

        <div className="crud-table-wrap">
          <table className="crud-table">
            <tbody>
              <tr>
                <td style={{ width: "180px" }}>Frequency</td>
                <td>
                  <select
                    value={state.frequency}
                    disabled={disabled}
                    onChange={(event) =>
                      setState((prev) => ({ ...prev, frequency: event.currentTarget.value as BuilderFrequency }))
                    }
                  >
                    <option value="DAILY">Daily</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="MONTHLY">Monthly</option>
                  </select>
                </td>
              </tr>
              <tr>
                <td>Every</td>
                <td>
                  <input
                    type="number"
                    min={1}
                    max={90}
                    value={state.interval}
                    disabled={disabled}
                    onChange={(event) =>
                      setState((prev) => ({
                        ...prev,
                        interval: Math.max(1, Math.min(90, Number(event.currentTarget.value) || 1))
                      }))
                    }
                  />
                </td>
              </tr>
              <tr>
                <td>Time (UTC)</td>
                <td className="tool-row" style={{ gap: "0.5rem" }}>
                  <input
                    type="number"
                    min={0}
                    max={23}
                    value={state.hour}
                    disabled={disabled}
                    onChange={(event) =>
                      setState((prev) => ({
                        ...prev,
                        hour: Math.max(0, Math.min(23, Number(event.currentTarget.value) || 0))
                      }))
                    }
                  />
                  <span>:</span>
                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={state.minute}
                    disabled={disabled}
                    onChange={(event) =>
                      setState((prev) => ({
                        ...prev,
                        minute: Math.max(0, Math.min(59, Number(event.currentTarget.value) || 0))
                      }))
                    }
                  />
                </td>
              </tr>
              {state.frequency === "WEEKLY" ? (
                <tr>
                  <td>Weekdays</td>
                  <td className="tool-row" style={{ gap: "0.4rem", flexWrap: "wrap" }}>
                    {WEEK_DAYS.map((day) => {
                      const active = state.weekDays.includes(day.key);
                      return (
                        <button
                          key={day.key}
                          type="button"
                          className={`tiny-button ${active ? "cta cta-primary" : ""}`}
                          disabled={disabled}
                          onClick={() =>
                            setState((prev) => {
                              const next = active
                                ? prev.weekDays.filter((item) => item !== day.key)
                                : [...prev.weekDays, day.key];
                              return { ...prev, weekDays: next.length > 0 ? next : [1] };
                            })
                          }
                        >
                          {day.label}
                        </button>
                      );
                    })}
                  </td>
                </tr>
              ) : null}
              {state.frequency === "MONTHLY" ? (
                <tr>
                  <td>Monthly mode</td>
                  <td className="tool-row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className={`tiny-button ${state.monthMode === "day_of_month" ? "cta cta-primary" : ""}`}
                      disabled={disabled}
                      onClick={() => setState((prev) => ({ ...prev, monthMode: "day_of_month" }))}
                    >
                      Day of month
                    </button>
                    <button
                      type="button"
                      className={`tiny-button ${state.monthMode === "last_day" ? "cta cta-primary" : ""}`}
                      disabled={disabled}
                      onClick={() => setState((prev) => ({ ...prev, monthMode: "last_day" }))}
                    >
                      Last day
                    </button>
                    {state.monthMode === "day_of_month" ? (
                      <select
                        value={state.monthDay}
                        disabled={disabled}
                        onChange={(event) =>
                          setState((prev) => ({ ...prev, monthDay: Number(event.currentTarget.value) || 1 }))
                        }
                      >
                        {monthDayOptions().map((day) => (
                          <option key={day} value={day}>
                            {day}
                          </option>
                        ))}
                      </select>
                    ) : null}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
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
            disabled={disabled}
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
