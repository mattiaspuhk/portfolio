import getReadingTime from 'reading-time';
import { toString } from 'mdast-util-to-string';

/** Adds `minutesRead` (whole minutes, at least 1) to `remarkPluginFrontmatter`. */
export function remarkReadingTime() {
  return function (tree, { data }) {
    const { minutes } = getReadingTime(toString(tree));
    data.astro.frontmatter.minutesRead = Math.max(1, Math.round(minutes));
  };
}
