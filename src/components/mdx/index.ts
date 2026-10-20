// Passed to MDX as <Content components={mdxComponents} />, so MDX files never import these.
import Aside from './Aside.astro';
import Decision from './Decision.astro';
import Figure from './Figure.astro';
import Metric from './Metric.astro';

export const mdxComponents = { Figure, Metric, Decision, Aside };
