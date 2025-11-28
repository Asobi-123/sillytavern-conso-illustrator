/**
 * Image Cleaner Module
 * Handles cleanup of expired AI-generated images from chat messages
 */

import { createLogger } from './logger';
import { getRegistry, getPromptNode, deletePromptNode } from './prompt_manager';
import { saveMetadata } from './metadata';
import type { AutoIllustratorChatMetadata } from './types';

const logger = createLogger('ImageCleaner');

/**
 * Image retention period configuration
 */
export const IMAGE_RETENTION_DAYS = {
  DEFAULT: 1,
  MIN: 1,
  MAX: 7,
  STEP: 1,
} as const;

/**
 * Result of a cleanup operation
 */
export interface CleanupResult {
  removedFromChat: number;
  removedFromRegistry: number;
  removedImageUrls: string[];
  messagesModified: number;
}

/**
 * Regex pattern to match a complete image block
 */
const IMAGE_BLOCK_PATTERN = /<!--img-prompt="[^"]*"-->\s*<!-- auto-illustrator:promptId=[^,]+,imageUrl=[^\s]+\s*-->\s*<img[^>]*src="([^"]*)"[^>]*\/?>/g;

/**
 * Alternative pattern for images without the prompt tag (legacy format)
 */
const LEGACY_IMAGE_PATTERN = /<!-- auto-illustrator:promptId=[^,]+,imageUrl=[^\s]+\s*-->\s*<img[^>]*src="([^"]*)"[^>]*\/?>/g;

/**
 * Extracts timestamp from image URL
 * Expected format: /user/images/CharName/CharName_2025-11-26@23h33m48s.png
 */
export function extractImageTimestamp(imageUrl: string): Date | null {
  const match = imageUrl.match(/(\d{4})-(\d{2})-(\d{2})@(\d{2})h(\d{2})m(\d{2})s/);
  
  if (!match) {
    logger.trace(`Could not extract timestamp from URL: ${imageUrl}`);
    return null;
  }
  
  const [, year, month, day, hour, minute, second] = match;
  
  try {
    return new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hour),
      parseInt(minute),
      parseInt(second)
    );
  } catch (error) {
    logger.warn(`Failed to parse date from URL: ${imageUrl}`, error);
    return null;
  }
}

/**
 * Checks if an image is expired based on retention period
 */
export function isImageExpired(imageUrl: string, retentionDays: number): boolean {
  const imageDate = extractImageTimestamp(imageUrl);
  
  if (!imageDate) {
    return false;
  }
  
  const now = new Date();
  const cutoffDate = new Date(now.getTime() - (retentionDays * 24 * 60 * 60 * 1000));
  
  return imageDate < cutoffDate;
}

/**
 * Removes expired image blocks from a message text
 */
export function removeExpiredImagesFromText(
  messageText: string,
  retentionDays: number
): { cleanedText: string; removedUrls: string[] } {
  const removedUrls: string[] = [];
  
  // Process main pattern (with prompt tag)
  let cleanedText = messageText.replace(IMAGE_BLOCK_PATTERN, (match, imageUrl) => {
    if (isImageExpired(imageUrl, retentionDays)) {
      removedUrls.push(imageUrl);
      logger.debug(`Removing expired image block: ${imageUrl}`);
      return '';
    }
    return match;
  });
  
  // Process legacy pattern (without prompt tag)
  cleanedText = cleanedText.replace(LEGACY_IMAGE_PATTERN, (match, imageUrl) => {
    if (isImageExpired(imageUrl, retentionDays)) {
      if (!removedUrls.includes(imageUrl)) {
        removedUrls.push(imageUrl);
      }
      logger.debug(`Removing expired legacy image: ${imageUrl}`);
      return '';
    }
    return match;
  });
  
  // Clean up any leftover empty lines
  cleanedText = cleanedText.replace(/\n{3,}/g, '\n\n');
  
  return { cleanedText, removedUrls };
}

/**
 * Cleans up the PromptRegistry by removing references to deleted images
 */
export async function cleanupRegistry(
  removedUrls: string[],
  metadata: AutoIllustratorChatMetadata
): Promise<number> {
  const registry = getRegistry(metadata);
  let cleanedCount = 0;
  
  for (const imageUrl of removedUrls) {
    const promptId = registry.imageToPromptId[imageUrl];
    
    if (promptId) {
      delete registry.imageToPromptId[imageUrl];
      
      const node = getPromptNode(promptId, metadata);
      if (node) {
        const imageIndex = node.generatedImages.indexOf(imageUrl);
        if (imageIndex > -1) {
          node.generatedImages.splice(imageIndex, 1);
          cleanedCount++;
          
          if (node.generatedImages.length === 0 && node.childIds.length === 0) {
            await deletePromptNode(promptId, metadata);
            logger.debug(`Deleted orphaned prompt node: ${promptId}`);
          }
        }
      }
    }
  }
  
  if (cleanedCount > 0) {
    await saveMetadata();
  }
  
  return cleanedCount;
}

/**
 * Runs cleanup on all messages in the current chat
 */
export async function cleanupCurrentChat(
  context: SillyTavernContext,
  metadata: AutoIllustratorChatMetadata,
  retentionDays: number
): Promise<CleanupResult> {
  const result: CleanupResult = {
    removedFromChat: 0,
    removedFromRegistry: 0,
    removedImageUrls: [],
    messagesModified: 0,
  };
  
  if (!context.chat || context.chat.length === 0) {
    logger.debug('No chat to clean');
    return result;
  }
  
  logger.info(`Starting cleanup with ${retentionDays} day retention period`);
  
  for (let i = 0; i < context.chat.length; i++) {
    const message = context.chat[i];
    
    if (!message.mes) {
      continue;
    }
    
    const { cleanedText, removedUrls } = removeExpiredImagesFromText(
      message.mes,
      retentionDays
    );
    
    if (removedUrls.length > 0) {
      message.mes = cleanedText;
      result.messagesModified++;
      result.removedFromChat += removedUrls.length;
      result.removedImageUrls.push(...removedUrls);
      
      logger.debug(`Cleaned ${removedUrls.length} images from message ${i}`);
    }
  }
  
  if (result.removedImageUrls.length > 0) {
    result.removedFromRegistry = await cleanupRegistry(
      result.removedImageUrls,
      metadata
    );
    
    await context.saveChat();
    
    logger.info(
      `Cleanup complete: ${result.removedFromChat} images removed from ${result.messagesModified} messages`
    );
  } else {
    logger.info('No expired images found');
  }
  
  return result;
}

/**
 * Exports the list of removed image URLs to localStorage
 * This is read by the cleanup.js script to delete actual files
 */
export function exportRemovedUrls(removedUrls: string[]): void {
  if (removedUrls.length === 0) {
    return;
  }
  
  const existing = localStorage.getItem('auto_illustrator_cleanup_queue') || '[]';
  const queue = JSON.parse(existing);
  queue.push(...removedUrls);
  localStorage.setItem('auto_illustrator_cleanup_queue', JSON.stringify(queue));
  
  logger.info(`Exported ${removedUrls.length} URLs to cleanup queue`);
}

/**
 * Main entry point for image cleanup
 * Called on extension initialization
 */
export async function runStartupCleanup(
  context: SillyTavernContext,
  metadata: AutoIllustratorChatMetadata,
  settings: AutoIllustratorSettings
): Promise<void> {
  const retentionDays = settings.imageRetentionDays ?? IMAGE_RETENTION_DAYS.DEFAULT;
  
  logger.info(`Running startup cleanup (retention: ${retentionDays} days)`);
  
  try {
    const result = await cleanupCurrentChat(context, metadata, retentionDays);
    
    if (result.removedImageUrls.length > 0) {
      exportRemovedUrls(result.removedImageUrls);
      
      if (typeof toastr !== 'undefined') {
        toastr.info(
          `已清理 ${result.removedFromChat} 张过期图片`,
          'Auto Illustrator',
          { timeOut: 3000 }
        );
      }
    }
  } catch (error) {
    logger.error('Startup cleanup failed:', error);
  }
}