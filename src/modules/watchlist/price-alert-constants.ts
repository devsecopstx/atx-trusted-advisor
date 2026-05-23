/** Default minimum absolute % move vs prior `lastPrice` before creating a portfolio alert. */
export const DEFAULT_MIN_ABS_MOVE_PERCENT = 5;

/** Default cooldown: skip a new alert if one for the same symbol was created within this window. */
export const DEFAULT_PRICE_ALERT_COOLDOWN_MS = 4 * 60 * 60 * 1000;

/** Clamp per-row minimum move % to a sane range (0.1% – 100%). */
export const MIN_USER_MOVE_PERCENT = 0.1;
export const MAX_USER_MOVE_PERCENT = 100;
