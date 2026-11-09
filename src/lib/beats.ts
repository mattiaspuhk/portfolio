import type { MarkdownHeading } from 'astro';

type Kind = 'production' | 'sprint' | 'hackathon' | 'concept';

interface Beat {
  label: string;
  slug: string;
  /** Kinds of work that may leave this beat out. A short sprint often has nothing that broke and no real next step. */
  optionalFor?: readonly Kind[];
}

/** The six H2s a case study uses, in this order. Slugs match Astro's heading ids. */
export const BEATS = [
  { label: 'Problem', slug: 'problem' },
  { label: 'Constraints', slug: 'constraints' },
  { label: 'Approach', slug: 'approach' },
  { label: 'Decisions', slug: 'decisions' },
  { label: 'When it broke', slug: 'when-it-broke', optionalFor: ['sprint'] },
  { label: 'Next', slug: 'next', optionalFor: ['sprint'] },
] as const satisfies readonly Beat[];

const LABELS: readonly string[] = BEATS.map((beat) => beat.label);

const isRequired = (beat: Beat, kind?: Kind) => !(kind && beat.optionalFor?.includes(kind));

/**
 * Checks a case study's H2s against BEATS: no required beat missing, none extra, none repeated, in order.
 * H3s are ignored. Throws in production builds and warns in dev.
 * Returns the beats the page has, in order, for BeatNav.
 */
export function assertBeats(headings: MarkdownHeading[], id: string, kind?: Kind): Beat[] {
  const found = headings.filter((heading) => heading.depth === 2).map((heading) => heading.text.trim());
  const problems: string[] = [];

  for (const beat of BEATS) {
    const count = found.filter((text) => text === beat.label).length;
    if (count === 0 && isRequired(beat, kind)) problems.push(`missing beat "${beat.label}"`);
    if (count > 1) problems.push(`beat "${beat.label}" appears ${count} times`);
  }
  for (const text of found) {
    if (!LABELS.includes(text)) problems.push(`extra H2 "${text}"`);
  }

  if (problems.length === 0) {
    const outOfPlace = found.find((text, index) => index > 0 && LABELS.indexOf(text) < LABELS.indexOf(found[index - 1]));
    if (outOfPlace) problems.push(`beat "${outOfPlace}" is out of order`);
  }

  if (problems.length > 0) {
    const required: string[] = BEATS.filter((beat) => isRequired(beat, kind)).map((beat) => beat.label);
    const message =
      `[beats] ${id}: ${problems.join('; ')}. ` +
      `Case studies need these H2s, in order: ${required.join(' → ')}` +
      (required.length < LABELS.length ? `, and may add ${LABELS.filter((l) => !required.includes(l)).join(', ')}.` : '.');
    if (import.meta.env.PROD) throw new Error(message);
    console.warn(message);
  }

  return BEATS.filter((beat) => found.includes(beat.label));
}
