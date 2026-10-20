import { Channel } from "@/data/channels";

export function SourceBadge({ channel }: { channel: Channel }) {
  if (channel.source !== "aflam4you") return null;
  return (
    <span className="shrink-0 rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-300">
      aflam4you
    </span>
  );
}
