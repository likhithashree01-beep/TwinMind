"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const COMPONENTS: Components = {
  h1: ({ children }) => (
    <h3 className="mt-3 mb-1 text-[14px] font-semibold tracking-tight text-[var(--text)]">
      {children}
    </h3>
  ),
  h2: ({ children }) => (
    <h4 className="mt-3 mb-1 text-[13px] font-semibold tracking-tight text-[var(--text)]">
      {children}
    </h4>
  ),
  h3: ({ children }) => (
    <h5 className="mt-2 mb-1 text-[12px] font-semibold tracking-wide text-[var(--text)] uppercase">
      {children}
    </h5>
  ),
  p: ({ children }) => (
    <p className="my-2 text-[14px] leading-relaxed text-[var(--text)]">
      {children}
    </p>
  ),
  ul: ({ children }) => (
    <ul className="my-2 list-disc space-y-1 pl-5 text-[14px] leading-relaxed text-[var(--text)]">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2 list-decimal space-y-1 pl-5 text-[14px] leading-relaxed text-[var(--text)]">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="marker:text-[var(--text-faint)]">{children}</li>,
  strong: ({ children }) => (
    <strong className="font-semibold text-[var(--text)]">{children}</strong>
  ),
  em: ({ children }) => <em className="italic text-[var(--text-dim)]">{children}</em>,
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-[var(--border)] pl-3 text-[var(--text-dim)] italic">
      {children}
    </blockquote>
  ),
  code: ({ className, children, ...rest }) => {
    const isBlock = /language-/.test(className ?? "");
    if (isBlock) {
      return (
        <code
          className="block rounded-md border border-[var(--border)] bg-[var(--panel-2)] px-3 py-2 font-mono text-[12px] leading-relaxed text-[var(--text)] overflow-x-auto"
          {...rest}
        >
          {children}
        </code>
      );
    }
    return (
      <code
        className="rounded bg-[var(--panel-2)] px-1 py-0.5 font-mono text-[12px] text-[var(--text)]"
        {...rest}
      >
        {children}
      </code>
    );
  },
  pre: ({ children }) => <pre className="my-2 overflow-x-auto">{children}</pre>,
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="text-[var(--accent)] underline underline-offset-2 hover:text-[var(--accent)]/80"
    >
      {children}
    </a>
  ),
  hr: () => <hr className="my-3 border-[var(--border)]" />,
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="min-w-full text-[13px]">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-b border-[var(--border)] px-2 py-1 text-left font-semibold text-[var(--text)]">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-[var(--border)]/50 px-2 py-1 text-[var(--text)]">
      {children}
    </td>
  ),
};

export function Markdown({ children }: { children: string }) {
  return (
    <div className="markdown-body">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
