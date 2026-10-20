import type { MarkdownHeading } from 'astro';

/** The six H2s every case study uses, in this order. Slugs match Astro's heading ids. */
export const BEATS = [
  { label: 'Problem', slug: 'problem' },
  { label: 'Constraints', slug: 'constraints' },
  { label: 'Approach', slug: 'approach' },
  { label: 'Decisions', slug: 'decisions' },
  { label: 'When it broke', slug: 'when-it-broke' },
  { label: 'Next', slug: 'next' },
] as const satisfies readonly { label: string; slug: string }[];

const LABELS: readonly string[] = BEATS.map((beat) => beat.label);

/**
 * Checks a case study's H2s against BEATS: none missing, none extra, none repeated, in order.
 * H3s are ignored. Throws in production builds and warns in dev.
 */
export function assertBeats(headings: MarkdownHeading[], id: string): void {
  const found = headings.filter((heading) => heading.depth === 2).map((heading) => heading.text.trim());
  const problems: string[] = [];

  for (const label of LABELS) {
    const count = found.filter((text) => text === label).length;
    if (count === 0) problems.push(`missing beat "${label}"`);
    if (count > 1) problems.push(`beat "${label}" appears ${count} times`);
  }
  for (const text of found) {
    if (!LABELS.includes(text)) problems.push(`extra H2 "${text}"`);
  }

  if (problems.length === 0) {
    const outOfPlace = found.find((text, index) => text !== LABELS[index]);
    if (outOfPlace) problems.push(`beat "${outOfPlace}" is out of order`);
  }

  if (problems.length === 0) return;

  const message =
    `[beats] ${id}: ${problems.join('; ')}. ` +
    `Case studies need exactly these H2s, in order: ${LABELS.join(' → ')}.`;
  if (import.meta.env.PROD) throw new Error(message);
  console.warn(message);
}
