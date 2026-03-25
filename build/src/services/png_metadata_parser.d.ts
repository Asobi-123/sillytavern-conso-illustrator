/**
 * PNG Metadata Parser
 * Extracts NovelAI generation metadata from PNG tEXt/iTXt chunks.
 * Pure browser-side implementation with zero external dependencies.
 */
import type { NovelAiParameters } from '../types';
/** Raw text chunks extracted from PNG */
export interface PngTextChunks {
    [key: string]: string;
}
/** Result of parsing a PNG file for NovelAI metadata */
export interface PngMetadataResult {
    /** Whether NovelAI metadata was found */
    found: boolean;
    /** Positive prompt text */
    positivePrompt: string;
    /** Negative prompt (Undesired Content) */
    negativePrompt: string;
    /** Generation parameters */
    parameters: NovelAiParameters;
    /** Software that generated the image */
    software?: string;
    /** All raw text chunks from the PNG */
    rawChunks: PngTextChunks;
}
/**
 * Extracts all tEXt and iTXt chunks from a PNG ArrayBuffer.
 *
 * PNG chunk structure:
 *   4 bytes: data length
 *   4 bytes: chunk type (ASCII)
 *   N bytes: chunk data
 *   4 bytes: CRC
 *
 * tEXt chunk data: keyword (Latin-1) + null byte + text (Latin-1)
 * iTXt chunk data: keyword + null + compression flag + compression method
 *                  + language tag + null + translated keyword + null + text (UTF-8)
 */
export declare function extractPngTextChunks(buffer: ArrayBuffer): PngTextChunks;
/**
 * Parses NovelAI metadata from a PNG file's text chunks.
 */
export declare function parseNovelAiMetadata(chunks: PngTextChunks): PngMetadataResult;
/**
 * Parses a PNG file and extracts NovelAI metadata.
 */
export declare function parsePngMetadata(file: File): Promise<PngMetadataResult>;
/**
 * Generates a JPEG thumbnail from an image file using Canvas.
 * Returns a base64 data URL string.
 */
export declare function generateThumbnail(file: File, maxSize?: number, quality?: number): Promise<string>;
