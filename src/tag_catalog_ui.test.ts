import {describe, expect, it} from 'vitest';
import {UI_ELEMENT_IDS} from './constants';
import {createTagCatalogContent} from './tag_catalog_ui';

describe('tag_catalog_ui', () => {
  it('should wrap assist settings in one outer details panel', () => {
    const root = document.createElement('div');
    root.innerHTML = createTagCatalogContent();

    const toolbar = root.querySelector('.tag-catalog-toolbar');
    const assistPanel = root.querySelector('.tag-catalog-assist-panel');
    const nestedSettings = assistPanel?.querySelectorAll(
      '.tag-catalog-settings'
    );

    expect(toolbar).not.toBeNull();
    expect(assistPanel).not.toBeNull();
    expect(toolbar?.contains(assistPanel)).toBe(false);
    expect(nestedSettings).toHaveLength(4);
    expect(
      assistPanel?.querySelector(`#${UI_ELEMENT_IDS.TAG_CATALOG_CUSTOM_TAG}`)
    ).not.toBeNull();
  });
});
