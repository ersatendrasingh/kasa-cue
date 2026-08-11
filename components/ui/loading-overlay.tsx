import Image from "next/image";

import { cn } from "@/lib/utils";

type LoadingOverlayProps = {
  className?: string;
  description?: string;
  label?: string;
};

export function LoadingOverlay({
  className,
  description,
  label = "Just a moment",
}: LoadingOverlayProps) {
  return (
    <div
      aria-label={label}
      aria-modal="true"
      className={cn(
        "fixed inset-0 z-[100] grid place-items-center bg-slate-950/35 px-5 backdrop-blur-[3px]",
        className
      )}
      role="dialog"
    >
      <div className="flex min-w-44 flex-col items-center rounded-3xl border border-white/80 bg-white/95 px-7 py-6 text-center shadow-[0_24px_70px_rgba(15,23,42,0.24)]">
        <div className="relative grid size-16 place-items-center">
          <span className="absolute inset-0 animate-ping rounded-2xl bg-emerald-300/30 [animation-duration:1.7s] motion-reduce:animate-none" />
          <span className="absolute inset-1 animate-spin rounded-2xl border-2 border-transparent border-r-emerald-500 border-t-slate-900 [animation-duration:1.15s] motion-reduce:animate-none" />
          <Image
            alt=""
            className="relative size-11 rounded-xl shadow-sm"
            height={44}
            priority
            src="/kasa-icon.png"
            width={44}
          />
        </div>
        <p aria-live="polite" className="mt-4 text-sm font-semibold text-slate-950" role="status">
          {label}
        </p>
        {description ? (
          <p className="mt-1 max-w-52 text-xs leading-5 text-slate-500">
            {description}
          </p>
        ) : null}
        <div aria-hidden="true" className="mt-4 flex gap-1.5">
          {[0, 1, 2].map((index) => (
            <span
              className="size-1.5 animate-bounce rounded-full bg-emerald-500 motion-reduce:animate-none"
              key={index}
              style={{ animationDelay: `${index * 140}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
