import {beforeEach, describe, expect, it, vi} from 'vitest';

const {metadata, saveMetadataMock} = vi.hoisted(() => ({
  metadata: {
    auto_illustrator: {
      manualCharacterTags: {
        Npc: {names: ['Npc'], tags: 'npc, person', enabled: true},
      },
    },
  },
  saveMetadataMock: vi.fn(),
}));

vi.mock('./metadata', () => ({
  getMetadata: () => metadata.auto_illustrator,
  saveMetadata: saveMetadataMock,
}));

vi.mock('./logger', () => ({
  createLogger: () => ({
    trace: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('character_tags_ui', () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = `
      <input id="auto_illustrator_conso_character_tag_search" />
      <input id="auto_illustrator_conso_character_tag_add_name" />
      <button id="auto_illustrator_conso_character_tag_add_btn"></button>
      <button id="auto_illustrator_conso_character_tag_reset_all"></button>
      <div id="auto_illustrator_conso_character_fixed_tags_list"></div>
    `;
    metadata.auto_illustrator.manualCharacterTags = {
      Npc: {names: ['Npc'], tags: 'npc, person', enabled: true},
    };
    saveMetadataMock.mockReset();
    vi.stubGlobal('SillyTavern', {
      getContext: () =>
        ({
          characterId: 0,
          name1: 'User',
          name2: 'Alice',
          characters: [{name: 'Alice', avatar: 'card-a.png'}],
          chatMetadata: {
            persona: 'persona-a.png',
            auto_illustrator: metadata.auto_illustrator,
          },
          eventSource: {on: vi.fn()},
          eventTypes: {PERSONA_CHANGED: 'PERSONA_CHANGED'},
        }) as unknown as SillyTavernContext,
    });
  });

  it('renders owner scopes and writes edits to the active profile', async () => {
    const {initializeCharacterTagsPanel} = await import('./character_tags_ui');
    const settings = {
      characterFixedTags: {},
      characterFixedTagScopes: {
        schemaVersion: 2,
        characters: {},
        personas: {
          'persona-a.png': {
            names: ['User'],
            tags: 'user, person',
            enabled: true,
          },
        },
        legacy: {
          Old: {names: ['Old'], tags: 'old, person', enabled: true},
        },
      },
    } as unknown as AutoIllustratorSettings;
    const saveSettings = vi.fn();

    initializeCharacterTagsPanel(settings, saveSettings);

    const list = document.getElementById(
      'auto_illustrator_conso_character_fixed_tags_list'
    ) as HTMLElement;
    expect(
      list.querySelector('[data-tag-id="character:card-a.png"]')
    ).not.toBeNull();
    expect(
      list.querySelector('[data-tag-id="persona:persona-a.png"]')
    ).not.toBeNull();
    expect(list.querySelector('[data-tag-id="chat:Npc"]')).not.toBeNull();
    expect(list.textContent).toContain(
      'settings.characterFixedTags.unassigned'
    );

    const card = list.querySelector(
      '[data-tag-id="character:card-a.png"]'
    ) as HTMLElement;
    (
      card.querySelector('[data-action="tags-input"]') as HTMLTextAreaElement
    ).value = 'alice, girl';
    (
      card.querySelector('[data-action="toggle-enabled"]') as HTMLInputElement
    ).checked = true;
    (
      card.querySelector('[data-action="save-tags"]') as HTMLButtonElement
    ).click();

    expect(settings.characterFixedTagScopes.characters['card-a.png']).toEqual({
      names: ['Alice'],
      tags: 'alice, girl',
      enabled: true,
    });
    expect(settings.characterFixedTags).toEqual({});
    expect(saveSettings).toHaveBeenCalled();
  });

  it('assigns legacy records to the current card and removes the flat copy', async () => {
    const {initializeCharacterTagsPanel} = await import('./character_tags_ui');
    const settings = {
      characterFixedTags: {
        Old: {names: ['Old'], tags: 'old, person', enabled: true},
      },
      characterFixedTagScopes: {
        schemaVersion: 2,
        characters: {},
        personas: {},
        legacy: {
          Old: {names: ['Old'], tags: 'old, person', enabled: true},
        },
      },
    } as unknown as AutoIllustratorSettings;

    initializeCharacterTagsPanel(settings, vi.fn());
    const assignButton = document.querySelector(
      '[data-action="assign-legacy"][data-target="character"]'
    ) as HTMLButtonElement;
    assignButton.click();

    expect(settings.characterFixedTagScopes.characters['card-a.png']).toEqual({
      names: ['Old'],
      tags: 'old, person',
      enabled: true,
    });
    expect(settings.characterFixedTagScopes.legacy).toEqual({});
    expect(settings.characterFixedTags).toEqual({});
  });
});
