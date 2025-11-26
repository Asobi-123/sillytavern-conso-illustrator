/**
 * Prompt Manager Module
 * Manages prompt nodes, refinement history, and image associations
 *
 * This module provides a content-addressed prompt management system that:
 * - Tracks prompts by hash(text + messageId + promptIndex) - survives message edits
 * - Maintains tree structure for prompt refinement history
 * - Links images to prompts for regeneration and tracking
 * - Provides O(1) lookups for all common queries
 *
 * Design principles:
 * - All mutation functions are async and automatically save to disk
 * - All functions accept metadata directly (no internal context calls)
 * - Auto-save ensures metadata changes are persisted immediately
 *
 * ============================================================================
 * IMPORTANT USAGE PATTERNS
 * ============================================================================
 *
 * 1. DETECTING PROMPTS:
 *    ```typescript
 *    const metadata = getMetadata();
 *    const patterns = settings.promptDetectionPatterns;
 *    const nodes = await detectPromptsInMessage(msgId, text, patterns, metadata);
 *    // Auto-saved!
 *    ```
 *
 * 2. UPDATING A PROMPT (creates child node):
 *    ```typescript
 *    // Step 1: Create refined child node (auto-saves)
 *    const child = await refinePrompt(
 *      parentId,
 *      newText,
 *      feedback,
 *      'manual-refined',
 *      metadata
 *    );
 *
 *    // Step 2: Replace text in message (at parent's position)
 *    const patterns = settings.promptDetectionPatterns;
 *    const updatedText = replacePromptTextInMessage(
 *      parentId,      // Replace at parent's position
 *      message.mes,
 *      child.text,    // Use child's text
 *      patterns,
 *      metadata
 *    );
 *    message.mes = updatedText;
 *    await renderMessageUpdate(messageId);
 *    ```
 *
 * 3. NODE.TEXT IS READONLY:
 *    ✅ Correct: Create child with new text via refinePrompt()
 *    ❌ Wrong:   node.text = newText (TypeScript will prevent this)
 *
 * 4. AUTO-SAVE BEHAVIOR:
 *    All mutation functions (registerPrompt, linkImageToPrompt, deletePromptNode, etc.)
 *    automatically save metadata to disk. No need to call saveMetadata() manually.
 */
import type { AutoIllustratorChatMetadata } from './types';
/**
 * Source of a prompt node
 * - 'ai-message': Initial prompt detected from AI's message
 * - 'ai-refined': User provided feedback, AI generated refined prompt
 * - 'manual-refined': User manually edited the prompt text
 */
export type PromptSource = 'ai-message' | 'ai-refined' | 'manual-refined';
/**
 * A node in the prompt refinement tree
 *
 * Each node represents a specific version of a prompt at a specific location
 * in a message. Nodes can have children representing refined versions.
 */
export interface PromptNode {
    /** Unique ID: hash(promptText + messageId + promptIndex) */
    id: string;
    /** Message ID this prompt belongs to */
    messageId: number;
    /** Index of this prompt in the message (0-based) */
    promptIndex: number;
    /** The actual prompt text (READONLY - create child node for updates) */
    readonly text: string;
    /** ID of parent node (null for root prompts) */
    parentId: string | null;
    /** IDs of child nodes (refined versions) */
    childIds: string[];
    /** URLs of images generated using this prompt */
    generatedImages: string[];
    /** Metadata */
    metadata: {
        /** When this node was created (Unix timestamp) */
        createdAt: number;
        /** When this node was last used for generation (Unix timestamp) */
        lastUsedAt: number;
        /** User feedback that led to this refinement (if refined) */
        feedback?: string;
        /** How this prompt was created */
        source: PromptSource;
    };
}
/**
 * Registry of all prompt nodes and indices
 */
export interface PromptRegistry {
    /** All prompt nodes, keyed by prompt ID */
    nodes: Record<string, PromptNode>;
    /** Index: image URL → prompt ID for fast lookup */
    imageToPromptId: Record<string, string>;
    /** Array of root prompt IDs (prompts with no parent) */
    rootPromptIds: string[];
}
/**
 * Generates a unique prompt ID from text, message ID, and prompt index
 *
 * Uses hash function to create consistent IDs. Same inputs always produce
 * same ID, enabling deduplication.
 *
 * @param text - The prompt text
 * @param messageId - Message ID this prompt belongs to
 * @param promptIndex - Index of prompt in message (0-based)
 * @returns Prompt ID in format: prompt_<hash36>
 *
 * @example
 * const id = generatePromptId("1girl, red dress", 42, 0);
 * // Returns: "prompt_abc123"
 */
export declare function generatePromptId(text: string, messageId: number, promptIndex: number): string;
/**
 * Gets or initializes the prompt registry from auto-illustrator metadata
 *
 * If registry doesn't exist, creates a new empty one and stores it in metadata.
 * This function mutates the metadata object.
 *
 * @param metadata - Auto-illustrator chat metadata object
 * @returns The prompt registry
 *
 * @example
 * const context = SillyTavern.getContext();
 * const metadata = context.chat_metadata?.auto_illustrator;
 * if (metadata) {
 *   const registry = getRegistry(metadata);
 * }
 */
export declare function getRegistry(metadata: AutoIllustratorChatMetadata): PromptRegistry;
/**
 * Creates a new prompt node
 *
 * Does NOT add to registry - use registerPrompt() for that.
 * This is a low-level function for internal use.
 *
 * @param text - Prompt text
 * @param messageId - Message ID
 * @param promptIndex - Index in message
 * @param source - How this prompt was created
 * @returns New prompt node
 */
export declare function createPromptNode(text: string, messageId: number, promptIndex: number, source: PromptSource): PromptNode;
/**
 * Gets a prompt node by ID
 *
 * @param promptId - The prompt ID to look up
 * @param metadata - Chat metadata
 * @returns The prompt node, or null if not found
 *
 * @example
 * const node = getPromptNode("prompt_abc123", metadata);
 * if (node) {
 *   console.log(node.text);
 * }
 */
export declare function getPromptNode(promptId: string, metadata: AutoIllustratorChatMetadata): PromptNode | null;
/**
 * Deletes a prompt node from the registry (with auto-save)
 *
 * Removes the node and cleans up all references:
 * - Removes from parent's childIds
 * - Removes from rootPromptIds if it's a root
 * - Removes all image associations
 * - Promotes children to roots (sets parentId=null, adds to rootPromptIds)
 *
 * @param promptId - ID of node to delete
 * @param metadata - Chat metadata
 *
 * @example
 * await deletePromptNode("prompt_abc123", metadata);
 */
export declare function deletePromptNode(promptId: string, metadata: AutoIllustratorChatMetadata): Promise<void>;
/**
 * Updates the lastUsedAt timestamp for a prompt node (with auto-save)
 *
 * @param promptId - ID of node to update
 * @param metadata - Chat metadata
 *
 * @example
 * await updatePromptLastUsed("prompt_abc123", metadata);
 */
export declare function updatePromptLastUsed(promptId: string, metadata: AutoIllustratorChatMetadata): Promise<void>;
/**
 * Registers a prompt in the registry (with auto-save)
 *
 * If a prompt with the same (text, messageId, promptIndex) already exists,
 * returns the existing node and updates its lastUsedAt timestamp.
 * Otherwise, creates a new node and adds it to the registry.
 *
 * @param text - Prompt text
 * @param messageId - Message ID
 * @param promptIndex - Index in message (0-based)
 * @param source - How this prompt was created
 * @param metadata - Chat metadata
 * @returns The prompt node (existing or newly created)
 *
 * @example
 * const node = await registerPrompt("1girl, red dress", 42, 0, 'ai-message', metadata);
 * console.log(node.id); // "prompt_abc123"
 */
export declare function registerPrompt(text: string, messageId: number, promptIndex: number, source: PromptSource, metadata: AutoIllustratorChatMetadata): Promise<PromptNode>;
/**
 * Links an image URL to a prompt (with auto-save)
 *
 * Adds the image URL to the prompt's generatedImages array and updates
 * the imageToPromptId index for fast reverse lookup.
 * Automatically normalizes URLs to pathname for consistency.
 *
 * @param promptId - Prompt ID
 * @param imageUrl - Image URL to link (absolute or relative, will be normalized)
 * @param metadata - Chat metadata
 *
 * @example
 * await linkImageToPrompt("prompt_abc123", "https://example.com/image.jpg", metadata);
 * // Stores as: "/image.jpg" -> "prompt_abc123"
 */
export declare function linkImageToPrompt(promptId: string, imageUrl: string, metadata: AutoIllustratorChatMetadata): Promise<void>;
/**
 * Unlinks an image URL from its prompt (with auto-save)
 *
 * Removes the image from the prompt's generatedImages array and removes
 * the imageToPromptId index entry.
 *
 * @param imageUrl - Image URL to unlink
 * @param metadata - Chat metadata
 * @returns True if image was found and unlinked, false otherwise
 *
 * @example
 * const unlinked = await unlinkImageFromPrompt("https://example.com/image.jpg", metadata);
 * if (unlinked) {
 *   console.log("Image unlinked successfully");
 * }
 */
export declare function unlinkImageFromPrompt(imageUrl: string, metadata: AutoIllustratorChatMetadata): Promise<boolean>;
/**
 * Gets the prompt node for an image URL
 *
 * Fast O(1) lookup using the imageToPromptId index.
 *
 * @param imageUrl - Image URL to look up
 * @param metadata - Chat metadata
 * @returns The prompt node, or null if image not linked to any prompt
 *
 * @example
 * const node = getPromptForImage("https://example.com/image.jpg", metadata);
 * if (node) {
 *   console.log(`Image generated from prompt: ${node.text}`);
 * }
 */
export declare function getPromptForImage(imageUrl: string, metadata: AutoIllustratorChatMetadata): PromptNode | null;
/**
 * Refines a prompt by creating a child node (with auto-save)
 *
 * Creates a new prompt node as a child of the parent, inheriting the same
 * messageId and promptIndex. This represents a refined version of the prompt.
 *
 * The child node is NOT added to rootPromptIds (only roots are in that array).
 *
 * @param parentId - ID of the parent prompt to refine
 * @param newText - The refined prompt text
 * @param feedback - User feedback that led to this refinement
 * @param source - Source type ('ai-refined' or 'manual-refined')
 * @param metadata - Chat metadata
 * @returns The new child prompt node
 *
 * @example
 * const refined = await refinePrompt(
 *   "prompt_abc123",
 *   "1girl, long hair, detailed hands",
 *   "fix the hands",
 *   'ai-refined',
 *   metadata
 * );
 */
export declare function refinePrompt(parentId: string, newText: string, feedback: string, source: 'ai-refined' | 'manual-refined', metadata: AutoIllustratorChatMetadata): Promise<PromptNode>;
/**
 * Gets the root prompt of a tree
 *
 * Walks up the parent chain until finding a node with no parent.
 * Handles cycles defensively (shouldn't happen, but defensive programming).
 *
 * @param promptId - ID of any node in the tree
 * @param metadata - Chat metadata
 * @returns The root node, or null if promptId not found
 *
 * @example
 * const root = getRootPrompt("prompt_child123", metadata);
 * console.log(root?.text); // Original prompt text
 */
export declare function getRootPrompt(promptId: string, metadata: AutoIllustratorChatMetadata): PromptNode | null;
/**
 * Gets the full chain from root to current prompt
 *
 * Returns an array of prompts ordered from root to the specified prompt.
 *
 * @param promptId - ID of the prompt to get chain for
 * @param metadata - Chat metadata
 * @returns Array of prompts [root, ..., current], or empty array if not found
 *
 * @example
 * const chain = getPromptChain("prompt_child123", metadata);
 * chain.forEach((node, i) => {
 *   console.log(`Version ${i}: ${node.text}`);
 * });
 */
export declare function getPromptChain(promptId: string, metadata: AutoIllustratorChatMetadata): PromptNode[];
/**
 * Gets the direct children of a prompt
 *
 * @param promptId - ID of the parent prompt
 * @param metadata - Chat metadata
 * @returns Array of child prompts, or empty array if no children
 *
 * @example
 * const children = getChildPrompts("prompt_abc123", metadata);
 * console.log(`Prompt has ${children.length} refinements`);
 */
export declare function getChildPrompts(promptId: string, metadata: AutoIllustratorChatMetadata): PromptNode[];
/**
 * Gets the entire subtree rooted at a prompt (DFS)
 *
 * Returns all descendants of the prompt, including the prompt itself.
 *
 * @param promptId - ID of the root of the subtree
 * @param metadata - Chat metadata
 * @returns Array of all nodes in subtree (DFS order), or empty if not found
 *
 * @example
 * const tree = getPromptTree("prompt_root", metadata);
 * console.log(`Tree has ${tree.length} total versions`);
 */
export declare function getPromptTree(promptId: string, metadata: AutoIllustratorChatMetadata): PromptNode[];
/**
 * Gets all prompt nodes for a message
 *
 * Returns prompts sorted by promptIndex.
 *
 * @param messageId - Message ID to query
 * @param metadata - Chat metadata
 * @returns Array of prompt nodes, sorted by promptIndex
 *
 * @example
 * const prompts = getPromptsForMessage(42, metadata);
 * prompts.forEach(p => console.log(`[${p.promptIndex}] ${p.text}`));
 */
export declare function getPromptsForMessage(messageId: number, metadata: AutoIllustratorChatMetadata): PromptNode[];
/**
 * Deletes all prompt nodes for a message (with auto-save)
 *
 * Removes all prompts belonging to the specified message, including:
 * - The nodes themselves
 * - All image associations
 * - Parent/child relationships
 * - Entries in rootPromptIds
 *
 * @param messageId - Message ID whose prompts to delete
 * @param metadata - Chat metadata
 * @returns Number of nodes deleted
 *
 * @example
 * const deleted = await deleteMessagePrompts(42, metadata);
 * console.log(`Deleted ${deleted} prompts`);
 */
export declare function deleteMessagePrompts(messageId: number, metadata: AutoIllustratorChatMetadata): Promise<number>;
/**
 * Prunes orphaned nodes (with auto-save)
 *
 * Removes nodes that have:
 * - Zero generated images AND
 * - Zero child nodes
 *
 * These are considered orphaned/unused and can be safely removed.
 *
 * @param metadata - Chat metadata
 * @returns Number of nodes pruned
 *
 * @example
 * const pruned = await pruneOrphanedNodes(metadata);
 * console.log(`Pruned ${pruned} orphaned nodes`);
 */
export declare function pruneOrphanedNodes(metadata: AutoIllustratorChatMetadata): Promise<number>;
/**
 * Gets all root prompts
 *
 * Returns all prompts that have no parent (roots of refinement trees).
 *
 * @param metadata - Chat metadata
 * @returns Array of root prompt nodes
 *
 * @example
 * const roots = getAllRootPrompts(metadata);
 * console.log(`${roots.length} root prompts`);
 */
export declare function getAllRootPrompts(metadata: AutoIllustratorChatMetadata): PromptNode[];
/**
 * Gets statistics about the prompt registry
 *
 * @param metadata - Chat metadata
 * @returns Statistics object
 *
 * @example
 * const stats = getPromptStats(metadata);
 * console.log(`${stats.totalNodes} nodes, ${stats.totalImages} images`);
 */
export declare function getPromptStats(metadata: AutoIllustratorChatMetadata): {
    totalNodes: number;
    totalImages: number;
    totalTrees: number;
};
/**
 * Detects and registers prompts in a message
 *
 * Uses regex patterns from regex.ts to extract prompts from message text,
 * then registers each detected prompt in the registry.
 *
 * @param messageId - Message ID
 * @param messageText - The message text to scan
 * @param patterns - Array of regex patterns to detect prompts (e.g., settings.promptDetectionPatterns)
 * @param metadata - Chat metadata
 * @returns Array of prompt nodes (newly created or existing)
 *
 * @example
 * const patterns = settings.promptDetectionPatterns;
 * const prompts = detectPromptsInMessage(
 *   42,
 *   'Text <!--img-prompt="1girl"--> more text',
 *   patterns,
 *   metadata
 * );
 * console.log(`Detected ${prompts.length} prompts`);
 */
export declare function detectPromptsInMessage(messageId: number, messageText: string, patterns: string[], metadata: AutoIllustratorChatMetadata): Promise<PromptNode[]>;
/**
 * Replaces prompt text in a message WITHOUT modifying the prompt node
 *
 * This is a low-level utility for message text manipulation.
 * To update a prompt semantically, use refinePrompt() to create a child node instead.
 *
 * Replaces the Nth occurrence of a prompt tag in the message text with new text.
 * The prompt node itself is NOT modified (node.text is readonly).
 *
 * This function does NOT save the message - caller is responsible for that.
 *
 * @param promptId - ID of the prompt whose position to replace in message
 * @param messageText - Current message text
 * @param newText - New prompt text to insert
 * @param patterns - Array of regex patterns to detect prompts (e.g., settings.promptDetectionPatterns)
 * @param metadata - Chat metadata (used to get promptIndex)
 * @returns Updated message text (caller must save it)
 * @throws Error if prompt node not found
 *
 * @example
 * // Create child node with new text
 * const child = refinePrompt(parentId, newText, feedback, 'manual-refined', metadata);
 *
 * // Replace text in message at parent's position
 * const patterns = settings.promptDetectionPatterns;
 * const updatedText = replacePromptTextInMessage(
 *   parentId,  // Replace at parent's position
 *   message.mes,
 *   child.text,  // Use child's text
 *   patterns,
 *   metadata
 * );
 * message.mes = updatedText;
 * await renderMessageUpdate(messageId);
 */
export declare function replacePromptTextInMessage(promptId: string, messageText: string, newText: string, patterns: string[], metadata: AutoIllustratorChatMetadata): string;
