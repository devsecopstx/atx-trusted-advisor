"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
};

type State = {
  error: Error | null;
};

export class XoptionsErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[xoptions/boundary]", error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div
          className="rounded-md border border-[color-mix(in_srgb,var(--xf-danger-400)_45%,transparent)] bg-[color-mix(in_srgb,var(--xf-danger-400)_8%,transparent)] p-4 text-sm text-[var(--xf-text-200)]"
          role="alert"
        >
          <p className="m-0 font-semibold">Something went wrong loading this step.</p>
          <p className="mt-2 mb-0 text-[var(--xf-text-400)]">
            Refresh the page or return later. Market data may be temporarily unavailable.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
