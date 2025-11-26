/**
 * Progress Widget Module (简化版 - 使用顶部 toast 提示)
 * 用简单的顶部提示条替代原来的悬浮 widget
 */

import {createLogger} from './logger';
import type {
  ProgressManager,
  ProgressStartedEventDetail,
  ProgressUpdatedEventDetail,
  ProgressClearedEventDetail,
} from './progress_manager';

const logger = createLogger('ProgressWidget');

// 声明 toastr (SillyTavern 全局变量)
declare const toastr: any;

// 跟踪当前显示的 toast
let currentToast: any = null;

// 跟踪所有消息的进度状态
const messageProgress = new Map<number, {
  current: number;
  total: number;
}>();

/**
 * Progress Widget - 简化版视图层
 * 使用 toastr 顶部提示替代复杂的悬浮 widget
 */
class ProgressWidgetView {
  private readonly progressManager: ProgressManager;

  constructor(manager: ProgressManager) {
    this.progressManager = manager;
    
    // 订阅进度事件
    manager.addEventListener('progress:started', event => {
      const detail = (event as CustomEvent<ProgressStartedEventDetail>).detail;
      this.handleStarted(detail);
    });

    manager.addEventListener('progress:updated', event => {
      const detail = (event as CustomEvent<ProgressUpdatedEventDetail>).detail;
      this.handleUpdated(detail);
    });

    manager.addEventListener('progress:cleared', event => {
      const detail = (event as CustomEvent<ProgressClearedEventDetail>).detail;
      this.handleCleared(detail);
    });

    logger.info('简化版 ProgressWidget 已初始化 (使用 toastr)');
  }

  private handleStarted(detail: ProgressStartedEventDetail): void {
    logger.debug(`开始跟踪消息 ${detail.messageId}: 0/${detail.total}`);
    
    messageProgress.set(detail.messageId, {
      current: 0,
      total: detail.total,
    });
    
    this.updateToast();
  }

  private handleUpdated(detail: ProgressUpdatedEventDetail): void {
    logger.debug(`更新消息 ${detail.messageId}: ${detail.completed}/${detail.total}`);
    
    messageProgress.set(detail.messageId, {
      current: detail.completed,
      total: detail.total,
    });
    
    this.updateToast();
  }

  private handleCleared(detail: ProgressClearedEventDetail): void {
    logger.debug(`清除消息 ${detail.messageId} 的进度`);
    
    messageProgress.delete(detail.messageId);
    
    // 如果没有任何进行中的任务,显示完成提示
    if (messageProgress.size === 0) {
      this.showCompletionToast();
    } else {
      this.updateToast();
    }
  }

  /**
   * 更新顶部提示条
   */
  private updateToast(): void {
    // 清除旧的 toast
    if (currentToast) {
      toastr.clear(currentToast);
      currentToast = null;
    }

    // 如果没有进行中的任务,不显示
    if (messageProgress.size === 0) {
      return;
    }

    // 计算总进度
    let totalCurrent = 0;
    let totalMax = 0;
    
    for (const progress of messageProgress.values()) {
      totalCurrent += progress.current;
      totalMax += progress.total;
    }

    // 显示进度提示
    const message = `正在生成 ${totalCurrent}/${totalMax} 图片`;
    
    currentToast = toastr.info(message, 'Auto Illustrator', {
      timeOut: 0,              // 不自动消失
      extendedTimeOut: 0,
      positionClass: 'toast-top-center',  // 顶部居中
      preventDuplicates: true,
      closeButton: false,      // 不显示关闭按钮
      progressBar: true,       // 显示进度条
    });

    logger.trace(`更新 toast: ${message}`);
  }

  /**
   * 显示完成提示
   */
  private showCompletionToast(): void {
    // 清除进度提示
    if (currentToast) {
      toastr.clear(currentToast);
      currentToast = null;
    }

    // 显示完成提示 (3秒后自动消失)
    toastr.success('图片生成完成!', 'Auto Illustrator', {
      timeOut: 3000,
      positionClass: 'toast-top-center',
      preventDuplicates: true,
    });

    logger.debug('显示完成提示');
  }

  /**
   * 清除所有状态
   */
  public clearState(): void {
    logger.info('清除进度状态');
    
    messageProgress.clear();
    
    if (currentToast) {
      toastr.clear(currentToast);
      currentToast = null;
    }
  }
}

// 单例实例
let widgetInstance: ProgressWidgetView | null = null;

/**
 * 初始化进度 widget
 */
export function initializeProgressWidget(manager: ProgressManager): void {
  if (widgetInstance) {
    logger.warn('Progress widget 已初始化');
    return;
  }

  widgetInstance = new ProgressWidgetView(manager);
  logger.info('Progress widget 初始化完成');
}

/**
 * 清除进度 widget 状态
 */
export function clearProgressWidgetState(): void {
  if (!widgetInstance) {
    logger.debug('没有 widget 实例需要清除');
    return;
  }

  widgetInstance.clearState();
}
