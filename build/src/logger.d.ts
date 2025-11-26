/**
 * Logger Module
 * Centralized logging using loglevel library
 */
import log from 'loglevel';
/**
 * Sets the global log level
 * @param level - Log level ('trace' | 'debug' | 'info' | 'warn' | 'error' | 'silent')
 */
export declare function setLogLevel(level: log.LogLevelDesc): void;
/**
 * Gets the current log level
 * @returns Current log level
 */
export declare function getLogLevel(): log.LogLevelDesc;
/**
 * Logs a trace message (lowest priority, most verbose)
 * @param message - Trace message
 * @param args - Additional arguments
 */
export declare function trace(message: string, ...args: unknown[]): void;
/**
 * Logs a debug message
 * @param message - Debug message
 * @param args - Additional arguments
 */
export declare function debug(message: string, ...args: unknown[]): void;
/**
 * Logs an info message
 * @param message - Info message
 * @param args - Additional arguments
 */
export declare function info(message: string, ...args: unknown[]): void;
/**
 * Logs a warning message
 * @param message - Warning message
 * @param args - Additional arguments
 */
export declare function warn(message: string, ...args: unknown[]): void;
/**
 * Logs an error message
 * @param message - Error message
 * @param args - Additional arguments
 */
export declare function error(message: string, ...args: unknown[]): void;
/**
 * Creates a contextual logger with a specific module prefix
 * @param context - Context name (e.g., 'Queue', 'Monitor', 'Generator')
 * @returns Contextual logger object
 */
export declare function createLogger(context: string): {
    trace: (message: string, ...args: unknown[]) => void;
    debug: (message: string, ...args: unknown[]) => void;
    info: (message: string, ...args: unknown[]) => void;
    warn: (message: string, ...args: unknown[]) => void;
    error: (message: string, ...args: unknown[]) => void;
};
export { log };
