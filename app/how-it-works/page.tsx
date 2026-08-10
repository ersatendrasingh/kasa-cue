import { FileText, Headphones, MessageSquareText, MonitorUp } from "lucide-react";

import { MarketingFooter, MarketingHeader } from "@/components/marketing/site-chrome";

export default function HowItWorksPage() {
  return (
    <main className="min-h-screen bg-white text-slate-950">
      <MarketingHeader />

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
          How it works
        </p>
        <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
          Prepare context once, then use Kasa Cue during the live conversation.
        </h1>
        <div className="mt-10 grid gap-5 md:grid-cols-4">
          {[
            {
              icon: FileText,
              title: "Upload context",
              text: "Add meeting notes, daily updates, project docs, or client background.",
            },
            {
              icon: MonitorUp,
              title: "Start a session",
              text: "Choose team meeting, daily standup, client call, or project KT.",
            },
            {
              icon: Headphones,
              title: "Listen quietly",
              text: "The app follows the conversation without disrupting your call.",
            },
            {
              icon: MessageSquareText,
              title: "Speak the reply",
              text: "Read the suggested answer and say it in your own voice.",
            },
          ].map((step) => (
            <div className="rounded-lg border border-slate-200 p-5" key={step.title}>
              <step.icon className="size-6 text-emerald-600" />
              <h2 className="mt-4 text-lg font-semibold">{step.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{step.text}</p>
            </div>
          ))}
        </div>
      </section>
      <MarketingFooter />
    </main>
  );
}
