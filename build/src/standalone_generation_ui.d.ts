/**
 * Standalone Generation UI Module
 * Provides a workbench for generating images independently of chat messages
 */
import type { AutoIllustratorChatMetadata } from './types';
/**
 * Creates the HTML content for the standalone generation drawer.
 */
export declare function createStandaloneGenerationContent(): string;
/**
 * Initializes all event listeners for the standalone generation panel.
 */
export declare function initializeStandaloneGeneration(context: SillyTavernContext, settings: AutoIllustratorSettings, metadata: AutoIllustratorChatMetadata | undefined): void;
