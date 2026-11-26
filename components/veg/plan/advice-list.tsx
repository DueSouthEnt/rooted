import type { AdviceNotice } from "@/lib/veg/advice";

const TONE = {
  bad: "bg-warning text-warning-foreground",
  good: "bg-success text-success-foreground",
  info: "bg-muted text-foreground",
} as const;

export function AdviceList({ notices }: { notices: AdviceNotice[] }) {
  if (notices.length === 0) return null;
  return (
    <ul className="grid gap-2" data-testid="bed-advice">
      {notices.map((notice) => (
        <li key={notice.message} data-testid={`advice-${notice.tone}`} className={`rounded-lg px-3 py-2 text-sm leading-5 ${TONE[notice.tone]}`}>
          {notice.message}
        </li>
      ))}
    </ul>
  );
}
