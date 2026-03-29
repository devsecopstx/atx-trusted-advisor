declare module "react-rrule-generator" {
  import type { ComponentType } from "react";

  type RRuleGeneratorProps = {
    value?: string;
    onChange: (rrule: string) => void;
    config?: Record<string, unknown>;
    translations?: Record<string, string> | ((key: string, replacements: Record<string, unknown>) => string);
    customCalendar?: ComponentType<unknown>;
  };

  const RRuleGenerator: ComponentType<RRuleGeneratorProps>;
  export default RRuleGenerator;
}
