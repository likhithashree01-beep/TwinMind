"use client";

import { ReactNode } from "react";

export function Panel({
  title,
  rightLabel,
  toolbar,
  children,
  footer,
}: {
  title: string;
  rightLabel?: ReactNode;
  toolbar?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--panel)]">
      <header className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-5 py-4">
        <h2 className="text-[11px] font-semibold tracking-[0.18em] text-[var(--text-dim)] uppercase">
          {title}
        </h2>
        {rightLabel ? (
          <span className="text-[11px] tracking-[0.18em] text-[var(--text-faint)] uppercase">
            {rightLabel}
          </span>
        ) : null}
      </header>
      {toolbar ? (
        <div className="shrink-0 border-b border-[var(--border)]">{toolbar}</div>
      ) : null}
      <div className="panel-scroll min-h-0 flex-1 overflow-y-auto">
        {children}
      </div>
      {footer ? (
        <div className="shrink-0 border-t border-[var(--border)] bg-[var(--panel)]">
          {footer}
        </div>
      ) : null}
    </section>
  );
}
