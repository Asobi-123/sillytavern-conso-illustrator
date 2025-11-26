/**
 * Streaming Image Queue Module
 * Manages a queue of image prompts detected during streaming
 */
import type { PromptState, QueuedPrompt } from './types';
/**
 * Queue for managing image generation prompts during streaming
 */
export declare class ImageGenerationQueue {
    private prompts;
    /**
     * Adds a new prompt to the queue
     * @param prompt - Prompt text
     * @param fullMatch - The full matched tag string
     * @param startIndex - Start position in message
     * @param endIndex - End position in message
     * @param regenerationMetadata - Optional metadata for regeneration requests
     * @param promptId - Optional ID from PromptManager (for linking images to prompts)
     * @returns The queued prompt, or null if already exists
     */
    addPrompt(prompt: string, fullMatch: string, startIndex: number, endIndex: number, regenerationMetadata?: {
        targetImageUrl?: string;
        targetPromptId?: string;
        insertionMode?: import('./types').ImageInsertionMode;
    }, promptId?: string): QueuedPrompt | null;
    /**
     * Checks if a prompt already exists in the queue
     * @param prompt - Prompt text
     * @param startIndex - Start position
     * @returns True if prompt exists
     */
    hasPrompt(prompt: string, startIndex: number): boolean;
    /**
     * Checks if a prompt with this text exists anywhere in the queue
     * (ignores position - useful for detecting duplicates after text shifts)
     * @param prompt - Prompt text
     * @returns True if a prompt with this text exists
     */
    hasPromptByText(prompt: string): boolean;
    /**
     * Gets the next pending prompt (QUEUED state)
     * @returns Next prompt to process, or null if none available
     */
    getNextPending(): QueuedPrompt | null;
    /**
     * Updates the state of a prompt
     * @param id - Prompt ID
     * @param state - New state
     * @param data - Additional data (imageUrl, error)
     */
    updateState(id: string, state: PromptState, data?: {
        imageUrl?: string;
        error?: string;
    }): void;
    /**
     * Gets a prompt by ID
     * @param id - Prompt ID
     * @returns The prompt, or undefined if not found
     */
    getPrompt(id: string): QueuedPrompt | undefined;
    /**
     * Gets all prompts in the queue
     * @returns Array of all prompts
     */
    getAllPrompts(): QueuedPrompt[];
    /**
     * Gets prompts by state
     * @param state - State to filter by
     * @returns Array of prompts in the given state
     */
    getPromptsByState(state: PromptState): QueuedPrompt[];
    /**
     * Gets count of prompts by state
     * @returns Object with counts for each state
     */
    getStats(): Record<PromptState, number>;
    /**
     * Clears all prompts from the queue
     */
    clear(): void;
    /**
     * Gets the size of the queue
     * @returns Number of prompts in queue
     */
    size(): number;
    /**
     * Adjusts positions of all queued prompts after a text insertion
     * Call this after inserting an image to update positions of remaining prompts
     * @param insertionPoint - Position where text was inserted
     * @param insertedLength - Length of inserted text (including newlines and img tag)
     * @param insertionTime - Timestamp when insertion happened
     */
    adjustPositionsAfterInsertion(insertionPoint: number, insertedLength: number, insertionTime?: number): void;
}
