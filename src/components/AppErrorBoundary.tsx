"use client";

import React from "react";

type Props = { children: React.ReactNode };

type State = { failed: boolean };

export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch() {
    /* silent */
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-6">
        <button
          type="button"
          className="rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-sm text-white"
          onClick={() => this.setState({ failed: false })}
        >
          Reload
        </button>
      </div>
    );
  }
}
