import {
  ArrowRight,
  Bot,
  BriefcaseBusiness,
  CheckCircle2,
  EyeOff,
  FileText,
  Headphones,
  MessageSquareText,
  Mic2,
  MonitorUp,
  ShieldCheck,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import Link from "next/link";

import { MarketingFooter, MarketingHeader } from "@/components/marketing/site-chrome";

export default async function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <MarketingHeader dark />
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(34,197,94,0.32),transparent_34rem),radial-gradient(circle_at_78%_8%,rgba(59,130,246,0.30),transparent_30rem)]" />
        <div className="relative mx-auto grid min-h-[calc(100vh-76px)] max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.02fr_0.98fr] lg:px-8 lg:py-20">
          <div className="flex flex-col justify-center">
            <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-sm font-medium text-emerald-100">
              <Sparkles className="size-4" />
              Mobile-ready support for everyday work meetings
            </div>
            <h1 className="max-w-4xl text-5xl font-semibold tracking-tight sm:text-6xl lg:text-7xl">
              Stay clear and confident in every work meeting.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-200">
              Kasa Cue captures team meetings, client calls, daily standups,
              and project KT, then turns the conversation into a clear
              transcript and a reply you can speak in your own voice.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-white px-5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-100"
                href="/signup"
              >
                Start free
                <ArrowRight className="size-4" />
              </Link>
              <Link
                className="inline-flex h-11 items-center justify-center rounded-lg border border-white/20 px-5 text-sm font-semibold text-white transition hover:bg-white/10"
                href="/how-it-works"
              >
                See how it works
              </Link>
            </div>
            <div className="mt-8 grid max-w-2xl gap-3 text-sm text-slate-200 sm:grid-cols-3">
              {["Daily standups", "Client calls", "Project KT"].map((item) => (
                <div className="flex items-center gap-2" key={item}>
                  <CheckCircle2 className="size-4 text-emerald-300" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center">
            <div className="w-full rounded-lg border border-white/10 bg-white/[0.06] p-4 shadow-2xl shadow-black/30 backdrop-blur">
              <div className="rounded-lg bg-slate-100 p-4 text-slate-950">
                <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
                  <div className="flex items-center gap-3">
                    <img
                      alt="Kasa Cue"
                      className="size-10 rounded-lg"
                      src="/kasa-icon.png"
                    />
                    <div>
                      <p className="font-semibold">Answer window</p>
                      <p className="text-xs text-slate-500">Team meeting mode</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                    Listening
                  </span>
                </div>
                <div className="space-y-3">
                  <p className="rounded-lg bg-white p-3 text-sm text-slate-600">
                    Manager: Can you walk me through what you handled this week?
                  </p>
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                    <p className="mb-2 text-xs font-semibold uppercase text-emerald-700">
                      Suggested reply
                    </p>
                    <p className="text-sm leading-6 text-slate-800">
                      This week I focused on stabilizing the core workflow,
                      testing edge cases, and documenting the rollout plan. The
                      next priority is to reduce manual checks and keep updates
                      predictable for the team.
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {[
                      ["Context", "Reference docs"],
                      ["Tone", "Professional"],
                      ["Mode", "Call ready"],
                    ].map(([label, value]) => (
                      <div
                        className="rounded-lg border border-slate-200 bg-white p-3"
                        key={label}
                      >
                        <p className="text-xs text-slate-500">{label}</p>
                        <p className="mt-1 text-sm font-semibold">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-18 text-slate-950 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6">
              <div className="mb-5 flex size-12 items-center justify-center rounded-lg bg-emerald-600 text-white">
                <EyeOff className="size-6" />
              </div>
              <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
                Invisible support
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight">
                Stays out of the call, keeps the answer ready.
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-700">
                The desktop overlay is designed to stay quiet while you listen.
                It helps you understand what was asked and gives a speakable
                response without turning your meeting into a tool demo.
              </p>
            </div>
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-6">
              <div className="mb-5 flex size-12 items-center justify-center rounded-lg bg-indigo-600 text-white">
                <BriefcaseBusiness className="size-6" />
              </div>
              <p className="text-sm font-semibold uppercase tracking-wide text-indigo-700">
                Work meeting context
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight">
                Turn agendas and project notes into better replies.
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-700">
                Add a meeting agenda, project notes, client brief, or daily
                update. Kasa Cue uses that context to keep every reply specific,
                accurate, and useful for the current discussion.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-slate-50 px-4 py-18 text-slate-950 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
              Features
            </p>
            <h2 className="mt-3 text-4xl font-semibold tracking-tight">
              Built for real conversations, not just transcripts.
            </h2>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Headphones,
                title: "Daily communication",
                text: "Use it when a manager or teammate asks something and you need a clear professional reply.",
              },
              {
                icon: Mic2,
                title: "Live transcript",
                text: "Capture conversation context and keep answer generation focused on what was just said.",
              },
              {
                icon: FileText,
                title: "Reference docs",
                text: "Upload topic files so answers match the meeting you are about to join.",
              },
              {
                icon: MonitorUp,
                title: "Desktop overlay",
                text: "Use the Mac app for a floating answer window during calls and meetings.",
              },
              {
                icon: Bot,
                title: "Screen analysis",
                text: "Analyze coding questions or prompts on screen and generate a useful response.",
              },
              {
                icon: ShieldCheck,
                title: "Role-based access",
                text: "User workspaces and admin controls are separated for safer production use.",
              },
            ].map((item) => (
              <div className="rounded-lg border border-slate-200 bg-white p-5" key={item.title}>
                <item.icon className="mb-4 size-6 text-emerald-600" />
                <h3 className="text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-18 text-slate-950 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.75fr_1.25fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
              Workflow
            </p>
            <h2 className="mt-3 text-4xl font-semibold tracking-tight">
              From setup to spoken answer in four steps.
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {[
              [FileText, "Add context", "Meeting agenda, daily update, product notes, or client details."],
              [MessageSquareText, "Choose the call", "Team meeting, daily standup, client call, or project KT."],
              [Headphones, "Listen quietly", "Kasa Cue follows the conversation without interrupting."],
              [WandSparkles, "Speak the answer", "Use the highlighted answer as your natural response."],
            ].map(([Icon, title, text], index) => (
              <div className="rounded-lg border border-slate-200 p-5" key={String(title)}>
                <div className="mb-4 flex size-9 items-center justify-center rounded-lg bg-slate-950 text-sm font-semibold text-white">
                  {index + 1}
                </div>
                <Icon className="mb-3 size-5 text-emerald-600" />
                <h3 className="font-semibold">{String(title)}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{String(text)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-950 px-4 py-18 text-white sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 rounded-lg border border-white/10 bg-white/[0.06] p-8 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">
              Ready for your next English call?
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              Create an account, upload your context, and keep the answer window
              ready before the meeting starts.
            </p>
          </div>
          <Link
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-white px-5 text-sm font-semibold text-slate-950 hover:bg-emerald-100"
            href="/signup"
          >
            Create account
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>

      <MarketingFooter />
    </main>
  );
}
