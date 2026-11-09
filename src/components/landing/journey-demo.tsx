"use client";

import { CheckIcon, CircleCheckIcon, CircleDotIcon, LockIcon, RotateCcwIcon, Undo2Icon } from "lucide-react";
import { useRef, useState } from "react";
import { gsap, MOTION, useGSAP } from "@/components/motion/gsap";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";

/*
  Self-contained demonstration of the dependency rule. State lives only in this component: nothing
  is sent to the server or stored. It mirrors the real rules of the task engine:
  - a task can be completed only when its prerequisite is completed;
  - a completed task cannot be reopened while a task that depends on it is completed.
*/

type TaskId = "enrol" | "documents" | "residence";
const TASKS: { id: TaskId; requires: TaskId | null }[] = [
  { id: "enrol", requires: null },
  { id: "documents", requires: "enrol" },
  { id: "residence", requires: "documents" },
];

type Event = { kind: "done" | "undo"; id: TaskId } | null;

export function JourneyDemo() {
  const { t } = useI18n();
  const root = useRef<HTMLDivElement>(null);
  const [done, setDone] = useState<ReadonlySet<TaskId>>(new Set());
  const [message, setMessage] = useState("");
  const event = useRef<Event>(null);

  const title = (id: TaskId) => t(`landing.demo.tasks.${id}.title`);
  const isAvailable = (id: TaskId) => {
    const requires = TASKS.find((task) => task.id === id)?.requires;
    return !requires || done.has(requires);
  };
  const dependentDone = (id: TaskId) => TASKS.some((task) => task.requires === id && done.has(task.id));

  function toggle(id: TaskId) {
    const next = new Set(done);
    if (done.has(id)) {
      if (dependentDone(id)) return;
      next.delete(id);
      event.current = { kind: "undo", id };
      setMessage(t("landing.demo.announceUndo", { task: title(id) }));
    } else {
      if (!isAvailable(id)) return;
      next.add(id);
      event.current = { kind: "done", id };
      const unlocked = TASKS.find((task) => task.requires === id);
      const parts = [t("landing.demo.announceDone", { task: title(id) })];
      if (unlocked) parts.push(t("landing.demo.announceUnlocked", { task: title(unlocked.id) }));
      if (next.size === TASKS.length) parts.push(t("landing.demo.announceAll"));
      setMessage(parts.join(" "));
    }
    setDone(next);
  }

  function reset() {
    event.current = null;
    setDone(new Set());
    setMessage(t("landing.demo.announceReset"));
  }

  // After each change: the completed card's mark pops, the connector to the next task draws, and the
  // task that just unlocked lifts slightly. Transforms and opacity only; nothing moves with reduced motion.
  useGSAP(
    () => {
      const change = event.current;
      if (!change) return;
      const mm = gsap.matchMedia();
      mm.add(MOTION.ok, () => {
        if (change.kind === "done") {
          const tl = gsap.timeline();
          tl.fromTo(`[data-mark="${change.id}"]`, { scale: 0.4, rotate: -20 }, { scale: 1, rotate: 0, duration: 0.6, ease: "back.out(2.4)", clearProps: "transform" });
          tl.fromTo(`[data-connector="${change.id}"]`, { scaleY: 0 }, { scaleY: 1, duration: 0.6, ease: "power2.inOut", clearProps: "transform" }, 0.1);
          const unlocked = TASKS.find((task) => task.requires === change.id);
          if (unlocked) tl.fromTo(`[data-card="${unlocked.id}"]`, { y: 10 }, { y: 0, duration: 0.8, ease: "elastic.out(1, 0.6)", clearProps: "transform" }, 0.45);
        }
      });
    },
    { scope: root, dependencies: [done] },
  );

  const progress = done.size;

  return (
    <div ref={root} className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-10">
      <div className="flex flex-col gap-6 lg:col-span-5">
        <div className="grid gap-2">
          <div className="flex items-baseline justify-between gap-4">
            <p className="text-sm text-foreground-soft" aria-hidden>
              {t("landing.demo.progress", { done: progress, total: TASKS.length })}
            </p>
            <Button type="button" variant="ghost" size="sm" onClick={reset} disabled={progress === 0}>
              <RotateCcwIcon aria-hidden />
              {t("landing.demo.reset")}
            </Button>
          </div>
          <div className="flex gap-1" aria-hidden>
            {TASKS.map((task) => (
              <span key={task.id} className="h-1.5 flex-1 overflow-hidden rounded-[1px] bg-hairline">
                <span className={cn("block h-full origin-left bg-ochre transition-transform duration-700 ease-editorial", done.has(task.id) ? "scale-x-100" : "scale-x-0")} />
              </span>
            ))}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{t("landing.demo.note")}</p>
        <p className="sr-only" aria-live="polite" role="status">
          {message}
        </p>
      </div>

      <ol aria-label={t("landing.demo.listLabel")} className="grid lg:col-span-7">
        {TASKS.map((task, index) => {
          const completed = done.has(task.id);
          const available = isAvailable(task.id);
          const locked = !completed && !available;
          const undoBlocked = completed && dependentDone(task.id);
          const status = completed ? "done" : available ? "available" : "locked";
          const StatusIcon = completed ? CircleCheckIcon : available ? CircleDotIcon : LockIcon;
          return (
            <li key={task.id} className="grid grid-cols-[2.5rem_1fr] gap-x-4 sm:gap-x-6">
              {/* Rail: mark and connector to the next task */}
              <div className="flex flex-col items-center">
                <span
                  data-mark={task.id}
                  aria-hidden
                  className={cn(
                    "grid size-10 shrink-0 place-items-center rounded-full border transition-colors duration-500",
                    completed ? "border-ochre bg-ochre text-hero" : available ? "border-ochre text-gold" : "border-hairline text-muted-foreground",
                  )}
                >
                  {completed ? <CheckIcon className="size-5" /> : <span className="font-mono text-sm">{String(index + 1).padStart(2, "0")}</span>}
                </span>
                {index < TASKS.length - 1 && (
                  <span aria-hidden className="relative my-2 w-px flex-1 bg-hairline">
                    <span data-connector={task.id} className={cn("absolute inset-0 origin-top bg-ochre", completed ? "scale-y-100" : "scale-y-0")} />
                  </span>
                )}
              </div>

              <div
                data-card={task.id}
                className={cn(
                  "shape-cut-sm mb-4 grid gap-4 border p-5 transition-[background-color,border-color] duration-500 sm:p-6",
                  completed ? "border-hairline bg-transparent" : available ? "border-ochre/60 bg-card" : "border-dashed border-hairline bg-transparent",
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className={cn("flex items-center gap-1.5 font-mono text-[0.7rem] tracking-wide uppercase", completed ? "text-forest" : available ? "text-gold" : "text-muted-foreground")}>
                    <StatusIcon className="size-3.5" aria-hidden />
                    {t(`landing.demo.${status === "done" ? "done" : status === "available" ? "available" : "locked"}`)}
                  </p>
                  {locked && task.requires && <p className="text-xs text-muted-foreground">{t("landing.demo.waitsFor", { task: title(task.requires) })}</p>}
                </div>
                <div>
                  <h3 className={cn("font-heading text-xl font-normal tracking-[-0.02em] sm:text-2xl", completed && "text-foreground-soft")}>{title(task.id)}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{t(`landing.demo.tasks.${task.id}.text`)}</p>
                </div>
                <div>
                  <Button
                    type="button"
                    size="sm"
                    variant={completed ? "ghost" : "default"}
                    disabled={locked || undoBlocked}
                    onClick={() => toggle(task.id)}
                    aria-describedby={locked ? undefined : `demo-${task.id}-title`}
                  >
                    {completed ? <Undo2Icon aria-hidden /> : <CheckIcon aria-hidden />}
                    {completed ? t("landing.demo.undo") : t("landing.demo.markDone")}
                  </Button>
                  <span id={`demo-${task.id}-title`} className="sr-only">
                    {title(task.id)}
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
