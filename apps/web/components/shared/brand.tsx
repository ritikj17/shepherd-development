import { cn } from "@/lib/utils/cn";

export function ShieldMark({
  className,
  tone = "dark",
}: {
  className?: string;
  tone?: "dark" | "light";
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={cn("size-8", className)}
    >
      <path
        d="M16 3.5 26 7v8.2c0 6.3-4.2 11.2-10 13.3-5.8-2.1-10-7-10-13.3V7l10-3.5Z"
        className={tone === "dark" ? "fill-[#dcebe4]" : "fill-[#0f5a4e]"}
      />
      <path
        d="m11.4 15.6 3.2 3.2 6-6.4"
        stroke={tone === "dark" ? "#0f5a4e" : "#f4faf7"}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function BrandLockup({
  tone = "dark",
  subtitle = true,
  className,
}: {
  tone?: "dark" | "light";
  subtitle?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <ShieldMark tone={tone} className="size-8 shrink-0" />
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            "text-[15px] font-semibold tracking-[0.16em]",
            tone === "dark" ? "text-white" : "text-foreground",
          )}
        >
          SHEPHERD
        </span>
        {subtitle ? (
          <span
            className={cn(
              "mt-1 text-[9.5px] font-medium uppercase tracking-[0.2em]",
              tone === "dark" ? "text-sidebar-muted" : "text-muted-foreground",
            )}
          >
            Safety Intelligence
          </span>
        ) : null}
      </span>
    </span>
  );
}
