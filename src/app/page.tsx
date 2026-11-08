import { BookOpenCheckIcon, GitBranchIcon, HandHelpingIcon, RouteIcon } from "lucide-react";
import Link from "next/link";
import { Brand } from "@/components/nav";
import { ThemeToggle } from "@/components/theme";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: RouteIcon,
    title: "A plan for your arrival",
    text: "Tell us your university, arrival date, programme and housing. You get the tasks that apply to you, grouped from before arrival to settling in.",
  },
  {
    icon: GitBranchIcon,
    title: "Tasks in the right order",
    text: "Prerequisites are tracked, so you always see what you can do now and what unlocks next. Your plan adapts when your situation changes.",
  },
  {
    icon: BookOpenCheckIcon,
    title: "Sources you can check",
    text: "Each task links to official information and shows whether and when it was last verified.",
  },
  {
    icon: HandHelpingIcon,
    title: "Help when you are stuck",
    text: "Ask a question on any task. A mentor answers it, with the context of your plan.",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-14 items-center justify-between px-4 sm:px-6">
        <Brand />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="ghost" asChild>
            <Link href="/sign-in">Sign in</Link>
          </Button>
        </div>
      </header>
      <main className="flex flex-1 flex-col">
        <section className="bg-navy text-white">
          <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6">
            <p className="text-sm font-medium uppercase tracking-wide text-teal-300">Pilot: international students arriving in Liepāja</p>
            <h1 className="mt-3 max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">Your first steps, one task at a time.</h1>
            <p className="mt-5 max-w-xl text-lg text-slate-200">
              FirstSteps turns arrival paperwork and practical setup into a personal plan, with sources you can check and mentors who help.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" asChild className="bg-teal-400 text-teal-950 hover:bg-teal-300">
                <Link href="/register">Create a student account</Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white">
                <Link href="/sign-in">Sign in</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="mx-auto grid w-full max-w-5xl gap-4 px-4 py-14 sm:grid-cols-2 sm:px-6">
          {features.map(({ icon: Icon, title, text }) => (
            <article key={title} className="rounded-xl bg-card p-6 ring-1 ring-foreground/10">
              <Icon className="size-5 text-primary" aria-hidden />
              <h2 className="mt-3 text-lg font-semibold">{title}</h2>
              <p className="mt-2 text-muted-foreground">{text}</p>
            </article>
          ))}
        </section>
        <p className="mx-auto max-w-5xl px-4 pb-10 text-xs text-muted-foreground sm:px-6">
          FirstSteps is an independent student project and is not affiliated with or endorsed by any university. Guidance is informational,
          not legal advice.
        </p>
      </main>
    </div>
  );
}
