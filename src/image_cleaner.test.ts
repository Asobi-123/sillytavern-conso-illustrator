import {describe, expect, it} from 'vitest';

import {cleanupRegistry, removeExpiredImagesFromText} from './image_cleaner';
import type {AutoIllustratorChatMetadata} from './types';

describe('image_cleaner', () => {
  it('should normalize encoded removed URLs during text cleanup', () => {
    const encodedUrl =
      '/user/images/%E5%B0%8F%E8%AF%B4%E5%AE%B6/test_2000-01-01@00h00m00s.png';
    const messageText = `Before <!--img-prompt="test"--> <!-- auto-illustrator:promptId=prompt-1,imageUrl=${encodedUrl} --> <img src="${encodedUrl}"> After`;

    const result = removeExpiredImagesFromText(messageText, 1);

    expect(result.cleanedText).not.toContain(encodedUrl);
    expect(result.removedUrls).toEqual([
      '/user/images/小说家/test_2000-01-01@00h00m00s.png',
    ]);
  });

  it('should clean registry entries when removed URLs are encoded', async () => {
    const metadata = {
      promptRegistry: {
        nodes: {
          'prompt-1': {
            id: 'prompt-1',
            text: 'test prompt',
            messageId: 0,
            promptIndex: 0,
            source: 'ai-message',
            metadata: {},
            parentId: null,
            childIds: [],
            generatedImages: [
              '/user/images/小说家/test_2000-01-01@00h00m00s.png',
            ],
          },
        },
        imageToPromptId: {
          '/user/images/小说家/test_2000-01-01@00h00m00s.png': 'prompt-1',
        },
        rootPromptIds: ['prompt-1'],
      },
    } as unknown as AutoIllustratorChatMetadata;

    const cleanedCount = await cleanupRegistry(
      [
        '/user/images/%E5%B0%8F%E8%AF%B4%E5%AE%B6/test_2000-01-01@00h00m00s.png',
      ],
      metadata
    );

    expect(cleanedCount).toBe(1);
    expect(
      metadata.promptRegistry?.imageToPromptId[
        '/user/images/小说家/test_2000-01-01@00h00m00s.png'
      ]
    ).toBeUndefined();
  });
});
