/**
 * Streaming Monitor Module (v2)
 * Monitors streaming text for new image prompts
 *
 * Updates:
 * - Removed Barrier dependency (uses callback instead)
 * - Uses regex for prompt extraction
 * - Uses prompt_manager for metadata tracking
 * - Updates progress manager with totals
 */
import { ImageGenerationQueue } from './streaming_image_queue';
/**
 * Monitors streaming message text for new image prompts
 */
export declare class StreamingMonitor {
    private messageId;
    private lastSeenText;
    private pollInterval;
    private queue;
    private settings;
    private intervalMs;
    private isRunning;
    private onNewPromptsCallback?;
    private onTextUpdateCallback?;
    private hasSeenFirstToken;
    /**
     * Creates a new streaming monitor
     * @param queue - Image generation queue
     * @param settings - Extension settings
     * @param intervalMs - Polling interval in milliseconds
     * @param onNewPrompts - Optional callback when new prompts are added
     * @param onTextUpdate - Optional callback when streaming text updates
     */
    constructor(queue: ImageGenerationQueue, settings: AutoIllustratorSettings, intervalMs?: number, onNewPrompts?: () => void, onTextUpdate?: (text: string) => void);
    /**
     * Starts monitoring a message for new prompts
     * @param messageId - Index of the message in chat array
     */
    start(messageId: number): Promise<void>;
    /**
     * Stops monitoring
     */
    stop(): void;
    /**
     * Performs a final scan for any remaining prompts
     * Should be called before stopping the monitor to catch any last-moment prompts
     */
    finalScan(): Promise<void>;
    /**
     * Checks for new prompts in the current message text
     * Called by the polling interval
     */
    private checkForNewPrompts;
    /**
     * Extracts prompts that haven't been seen before and registers them in PromptManager
     * Uses regex for pattern matching
     * @param currentText - Current message text
     * @param metadata - Chat metadata for PromptManager
     * @returns Array of objects with match and registered promptId
     */
    private extractAndRegisterNewPrompts;
    /**
     * Gets the current state of the monitor
     * @returns Monitor status information
     */
    getStatus(): {
        isRunning: boolean;
        messageId: number;
        lastTextLength: number;
        intervalMs: number;
    };
    /**
     * Checks if the monitor is currently running
     * @returns True if monitoring is active
     */
    isActive(): boolean;
}
