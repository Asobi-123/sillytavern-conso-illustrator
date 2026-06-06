/**
 * Builds a small prompt-writing aid from the bundled tag catalog.
 *
 * Runtime never fetches network data. The full catalog stays local; only a
 * compact, target-text-derived vocabulary subset is sent to the LLM.
 */
import type { TagCatalogCandidateSnapshot } from '../types';
export declare function getLastTagCatalogCandidateSnapshot(): TagCatalogCandidateSnapshot | null;
export declare function normalizePromptTagsWithCatalog(prompt: string, settings?: AutoIllustratorSettings): string;
export declare function buildTagCatalogPromptGuidance(sourceText: string, settings?: AutoIllustratorSettings): string;
