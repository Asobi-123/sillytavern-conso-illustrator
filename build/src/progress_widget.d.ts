/**
 * Progress Widget Module (简化版 - 使用顶部 toast 提示)
 * 用简单的顶部提示条替代原来的悬浮 widget
 */
import type { ProgressManager } from './progress_manager';
/**
 * 初始化进度 widget
 */
export declare function initializeProgressWidget(manager: ProgressManager): void;
/**
 * 清除进度 widget 状态
 */
export declare function clearProgressWidgetState(): void;
