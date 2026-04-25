"use client";

import { useRef } from "react";
import { Header } from "@/components/Header";
import { TranscriptPanel } from "@/components/TranscriptPanel";
import { SuggestionsPanel } from "@/components/SuggestionsPanel";
import { ChatPanel, ChatPanelHandle } from "@/components/ChatPanel";
import { ErrorBanner } from "@/components/ErrorBanner";
import type { Suggestion } from "@/lib/types";

export default function Home() {
  const chatRef = useRef<ChatPanelHandle | null>(null);

  function handleSuggestionClick(s: Suggestion) {
    void chatRef.current?.expandSuggestion(s);
  }

  return (
    <div className="flex min-h-screen flex-1 flex-col lg:fixed lg:inset-0 lg:h-screen lg:min-h-0 lg:overflow-hidden">
      <Header />
      <ErrorBanner />
      <main className="grid flex-1 grid-cols-1 gap-4 px-6 pb-6 lg:min-h-0 lg:grid-cols-3 lg:grid-rows-1 lg:overflow-hidden">
        <TranscriptPanel />
        <SuggestionsPanel onClickSuggestion={handleSuggestionClick} />
        <ChatPanel ref={chatRef} />
      </main>
    </div>
  );
}
