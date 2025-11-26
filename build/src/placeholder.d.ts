/**
 * Placeholder Module
 * Handles failed image generation placeholder logic
 */
/**
 * Base placeholder image for failed image generation
 * Simple SVG warning icon with red/orange error theme
 */
export declare const PLACEHOLDER_IMAGE_URL = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgdmlld0JveD0iMCAwIDEyOCAxMjgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CiAgPHJlY3Qgd2lkdGg9IjEyOCIgaGVpZ2h0PSIxMjgiIGZpbGw9IiNmZmVkZWQiLz4KICA8Y2lyY2xlIGN4PSI2NCIgY3k9IjY0IiByPSI1MCIgZmlsbD0iI2RjMzU0NSIgc3Ryb2tlPSIjYzgyMzMzIiBzdHJva2Utd2lkdGg9IjIiLz4KICA8dGV4dCB4PSI2NCIgeT0iNzQiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSI2MCIgZm9udC13ZWlnaHQ9ImJvbGQiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj7imqDvuI88L3RleHQ+Cjwvc3ZnPg==";
/**
 * Creates a unique placeholder URL by appending a fragment identifier with the promptId and timestamp
 * This ensures each failed generation gets its own placeholder that won't be deduplicated
 * by idempotency checks, while maintaining the same visual appearance.
 *
 * The timestamp ensures that multiple regeneration attempts for the same prompt ID
 * each get their own placeholder, allowing users to see how many times generation failed.
 *
 * @param promptId - Unique identifier for the prompt
 * @returns Unique placeholder URL (data URI with fragment)
 */
export declare function createPlaceholderUrl(promptId: string): string;
/**
 * Checks if a URL is a placeholder image (with or without fragment identifier)
 *
 * @param url - URL to check
 * @returns True if the URL is a placeholder image
 */
export declare function isPlaceholderUrl(url: string): boolean;
