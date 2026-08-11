import type { ReviewTopic } from "@/lib/api";

/** Short study coach lines from quiz weak spots. */
export function araCoachLine(topics: ReviewTopic[]): string | null {
  const top = topics[0];
  if (!top?.topic) return null;

  const topic = top.topic.trim();
  const subject = (top.subject || "").trim();
  const lines = subject
    ? [
        `Focus area: ${topic} in ${subject}.`,
        `${topic} (${subject}) still needs more practice.`,
        `Recommended review: ${topic} — ${subject}.`,
      ]
    : [
        `Focus area: ${topic}.`,
        `${topic} still needs more practice.`,
        `Recommended review: ${topic}.`,
      ];

  const seed = topic.length + (top.miss_count || 0) * 7;
  return lines[seed % lines.length];
}
