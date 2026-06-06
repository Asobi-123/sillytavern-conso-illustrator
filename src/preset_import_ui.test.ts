import {beforeEach, describe, expect, it, vi} from 'vitest';

import {UI_ELEMENT_IDS} from './constants';

vi.mock('./logger', () => ({
  createLogger: () => ({
    trace: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('./services/independent_llm', () => ({
  callIndependentLlmApi: vi.fn(),
}));

function flushPromises(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

async function loadPresetImportModule() {
  vi.resetModules();
  return import('./preset_import_ui');
}

function setSourceText(text: string): void {
  const textarea = document.getElementById(
    UI_ELEMENT_IDS.PRESET_IMPORT_JSON
  ) as HTMLTextAreaElement;
  textarea.value = text;
}

function setTarget(target: 'independent' | 'shared' | 'both'): void {
  const select = document.getElementById(
    UI_ELEMENT_IDS.PRESET_IMPORT_TARGET
  ) as HTMLSelectElement;
  select.value = target;
}

function clickGenerate(): void {
  document.getElementById(UI_ELEMENT_IDS.PRESET_IMPORT_GENERATE)?.click();
}

describe('preset import UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  it('uses SillyTavern generateRaw for shared target even when independent LLM is enabled', async () => {
    const presetImport = await loadPresetImportModule();
    const independentLlm = await import('./services/independent_llm');
    const context = {
      generateRaw: vi.fn().mockResolvedValue(
        JSON.stringify({
          name: 'Shared Adapted',
          promptWritingGuidelines:
            'Use compact tag prompts and keep multi-character roles separate.',
        })
      ),
    } as unknown as SillyTavernContext;
    const settings = {
      useIndependentLlmApi: true,
      customPresets: [],
      customIndependentLlmPresets: [],
    } as unknown as AutoIllustratorSettings;

    document.body.innerHTML = presetImport.createPresetImportContent();
    setTarget('shared');
    setSourceText(
      JSON.stringify({
        name: 'External',
        rules:
          'Use compact tag prompts and keep multi-character roles separate.',
      })
    );

    presetImport.initializePresetImport(context, settings, vi.fn(), vi.fn());
    clickGenerate();
    await flushPromises();

    expect(context.generateRaw).toHaveBeenCalledOnce();
    expect(independentLlm.callIndependentLlmApi).not.toHaveBeenCalled();
  });

  it('does not prepend the built-in independent guidelines to adapted drafts', async () => {
    const presetImport = await loadPresetImportModule();

    const guidelines =
      presetImport.presetImportTestHooks.composeIndependentGuidelines(
        'Use precise NovelAI tags.'
      );

    expect(guidelines).toContain('Use precise NovelAI tags.');
    expect(guidelines).toContain('Conso Prompt Baseline Guard');
    expect(guidelines).toContain('Conso Standalone Output Guard');
    expect(guidelines).toContain(
      'Start each prompt with the correct subject count'
    );
    expect(guidelines).toContain('1girl');
    expect(guidelines).toContain('1boy');
    expect(guidelines).toContain('no humans');
    expect(guidelines).toContain("bind each character's visible action");
    expect(guidelines).toContain('do not force a fixed left/right layout');
    expect(guidelines).toContain('foreground/background');
    expect(guidelines).toContain('diagonal action');
    expect(guidelines).toContain(
      'Include positive quality/detail tags in every prompt'
    );
    expect(guidelines).toContain('real negative/UC/negative-weight channel');
    expect(guidelines).toContain(
      'Do not use bracketed lists like "[low quality, jeans:1.3]"'
    );
    expect(guidelines).not.toContain('Universal Image Prompt Generation Guide');
    expect(guidelines).not.toContain('Tag-based prompts work universally');
  });

  it('adds standalone multi-character and negative handling guard to independent drafts', async () => {
    const presetImport = await loadPresetImportModule();
    const draft = presetImport.presetImportTestHooks.buildDraft({
      name: 'Independent Guarded',
      independentPromptWritingGuidelines:
        'Use the requested visual style and model-ready tags.',
    });

    expect(draft.promptWritingGuidelines).toContain(
      'Conso Standalone Output Guard'
    );
    expect(draft.promptWritingGuidelines).toContain(
      'Conso Prompt Baseline Guard'
    );
    expect(draft.promptWritingGuidelines).toContain(
      'Start each prompt with the correct subject count'
    );
    expect(draft.promptWritingGuidelines).toContain('1girl, 1boy');
    expect(draft.promptWritingGuidelines).toContain(
      'Do not default to flat left/right staging'
    );
    expect(draft.promptWritingGuidelines).toContain('diagonal motion');
    expect(draft.promptWritingGuidelines).toContain(
      'TEXT is the final prompt sent to image generation'
    );
    expect(draft.promptWritingGuidelines).toContain(
      'Do not instruct the later LLM to put a separate "Negative:"'
    );
    expect(draft.promptWritingGuidelines).toContain(
      'raw forbidden-word list inside TEXT'
    );
    expect(draft.promptWritingGuidelines).toContain(
      'N=2: keep both characters distinct'
    );
    expect(draft.promptWritingGuidelines).toContain(
      'N=3: keep each character distinct'
    );
    expect(draft.promptWritingGuidelines).toContain(
      'N>=4: use group or crowd composition'
    );
    expect(draft.promptWritingGuidelines).toContain(
      'Never collapse a secondary character'
    );
  });

  it('does not prepend the built-in shared meta prompt to adapted shared drafts', async () => {
    const presetImport = await loadPresetImportModule();

    const draft = presetImport.presetImportTestHooks.composeSharedMetaPrompt(
      'Use NovelAI 4.5 brace weights and strict UC isolation.'
    );

    expect(draft).toContain('Conso Shared API Image Prompt Meta Prompt');
    expect(draft).toContain('Use NovelAI 4.5 brace weights');
    expect(draft).toContain('Conso Prompt Baseline Guard');
    expect(draft).toContain('Start each prompt with the correct subject count');
    expect(draft).toContain('1girl');
    expect(draft).toContain('1boy');
    expect(draft).toContain('no humans');
    expect(draft).toContain("bind each character's visible action");
    expect(draft).toContain('do not force a fixed left/right layout');
    expect(draft).toContain('foreground/background');
    expect(draft).toContain('positive quality/detail tags');
    expect(draft).toContain('real negative/UC/negative-weight channel');
    expect(draft).toContain(
      'Do not use bracketed lists like "[low quality, jeans:1.3]"'
    );
    expect(draft).toContain('<!--img-prompt="...">');
    expect(draft).not.toContain('Universal Image Prompt Generation Guide');
    expect(draft).not.toContain('Tag-based prompts work universally');
  });

  it('falls back to generateRaw for independent target if the independent LLM call fails', async () => {
    const presetImport = await loadPresetImportModule();
    const independentLlm = await import('./services/independent_llm');
    vi.mocked(independentLlm.callIndependentLlmApi).mockRejectedValue(
      new Error('Invalid response from independent LLM API')
    );
    const context = {
      generateRaw: vi.fn().mockResolvedValue(
        JSON.stringify({
          name: 'Independent Adapted',
          promptWritingGuidelines:
            'Use only prompt writing rules for independent API presets.',
        })
      ),
    } as unknown as SillyTavernContext;
    const settings = {
      useIndependentLlmApi: true,
      customPresets: [],
      customIndependentLlmPresets: [],
    } as unknown as AutoIllustratorSettings;

    document.body.innerHTML = presetImport.createPresetImportContent();
    setTarget('independent');
    setSourceText(
      JSON.stringify({
        name: 'External',
        rules: 'Use only prompt writing rules for independent API presets.',
      })
    );

    presetImport.initializePresetImport(context, settings, vi.fn(), vi.fn());
    clickGenerate();
    await flushPromises();

    expect(independentLlm.callIndependentLlmApi).toHaveBeenCalledOnce();
    expect(context.generateRaw).toHaveBeenCalledOnce();
    expect(document.body.textContent).not.toContain(
      '# Image Prompt Writing Guidelines'
    );
  });

  it('clears the current draft when the save target changes', async () => {
    const presetImport = await loadPresetImportModule();
    const context = {
      generateRaw: vi.fn().mockResolvedValue(
        JSON.stringify({
          name: 'Shared Adapted',
          promptWritingGuidelines: 'Use compact tag prompts.',
        })
      ),
    } as unknown as SillyTavernContext;
    const settings = {
      useIndependentLlmApi: false,
      customPresets: [],
      customIndependentLlmPresets: [],
    } as unknown as AutoIllustratorSettings;

    document.body.innerHTML = presetImport.createPresetImportContent();
    setTarget('shared');
    setSourceText(
      JSON.stringify({
        name: 'External',
        rules: 'Use compact tag prompts with clear visual priorities.',
      })
    );

    presetImport.initializePresetImport(context, settings, vi.fn(), vi.fn());
    clickGenerate();
    await flushPromises();

    const saveButton = document.getElementById(
      UI_ELEMENT_IDS.PRESET_IMPORT_SAVE
    ) as HTMLButtonElement;
    expect(saveButton.disabled).toBe(false);

    const targetSelect = document.getElementById(
      UI_ELEMENT_IDS.PRESET_IMPORT_TARGET
    ) as HTMLSelectElement;
    targetSelect.value = 'independent';
    targetSelect.dispatchEvent(new Event('change', {bubbles: true}));

    expect(saveButton.disabled).toBe(true);
    expect(document.body.textContent).not.toContain('Use compact tag prompts.');
  });

  it('does not truncate long source text before adapter generation', async () => {
    const presetImport = await loadPresetImportModule();
    const source = [
      'A'.repeat(9000),
      'Useful middle section with no examples.',
      'B'.repeat(9000),
      `Output Structure:
Scene Composition: {best quality}, {single frame}, {duo},;
Character 1 Prompt: 1girl, Alice, {on left},;
Character 1 UC: lowres, bad anatomy, 1.3::black hair::,;
Character 2 Prompt: 1boy, Bob, {on right},;
Character 2 UC: lowres, bad anatomy, 1.3::red hair::,;`,
      'C'.repeat(9000),
      'TAIL_MARKER',
    ].join('\n');

    const excerpt =
      presetImport.presetImportTestHooks.buildSourceExcerpt(source);

    expect(excerpt).toContain('A'.repeat(9000));
    expect(excerpt).toContain('Scene Composition');
    expect(excerpt).toContain('Character 1 Prompt');
    expect(excerpt).toContain('Character 1 UC');
    expect(excerpt).toContain('TAIL_MARKER');
  });

  it('does not truncate the analysis preview', async () => {
    const presetImport = await loadPresetImportModule();
    document.body.innerHTML = presetImport.createPresetImportContent();
    setSourceText(`${'A'.repeat(7000)}TAIL_MARKER`);

    presetImport.presetImportTestHooks.renderAnalysis();

    expect(
      document.querySelector('.preset-import-result pre')?.textContent
    ).toContain('TAIL_MARKER');
  });

  it('collects every non-empty JSON string field', async () => {
    const presetImport = await loadPresetImportModule();
    document.body.innerHTML = presetImport.createPresetImportContent();
    setSourceText(
      JSON.stringify({
        name: 'External',
        entries: Array.from({length: 45}, (_, index) => ({
          content:
            index === 44
              ? 'TAIL_MARKER'
              : `Rule ${index}: preserve prompt logic.`,
        })),
      })
    );

    const source = presetImport.presetImportTestHooks.sourceText();

    expect(source.text).toContain('entries[44].content');
    expect(source.text).toContain('TAIL_MARKER');
  });

  it('builds adapter prompts for executable Conso guidelines rather than summaries', async () => {
    const presetImport = await loadPresetImportModule();
    const prompts = presetImport.presetImportTestHooks.buildAdapterPrompts({
      requestedName: 'Imported',
      selectedTarget: 'independent',
      requirement: 'Preserve multi-character UC isolation.',
      sourceText:
        'Scene Composition: {best quality},;\nCharacter 1 Prompt: 1girl,;\nCharacter 1 UC: bad anatomy,;',
    });

    expect(prompts.systemPrompt).toContain('not a summary');
    expect(prompts.systemPrompt).toContain('Scene Composition');
    expect(prompts.systemPrompt).toContain('Character 1 UC');
    expect(prompts.systemPrompt).toContain('TEXT may be multi-line');
    expect(prompts.systemPrompt).toContain('Do not generate Conso frequency');
    expect(prompts.userPrompt).toContain(
      'Preserve multi-character UC isolation'
    );
    expect(prompts.userPrompt).toContain('Scene Composition');
  });

  it('builds complete Conso-native profile instructions when only requirements are provided', async () => {
    const presetImport = await loadPresetImportModule();
    const prompts = presetImport.presetImportTestHooks.buildAdapterPrompts({
      requestedName: 'Guofeng',
      selectedTarget: 'independent',
      requirement: '偏古风，发型和服装严格，禁止出现西方异世界元素。',
      sourceText: '',
    });

    expect(prompts.systemPrompt).toContain(
      'When no external source text is provided'
    );
    expect(prompts.systemPrompt).toContain('Conso-native custom');
    expect(prompts.systemPrompt).toContain(
      'complete enough to replace the default prompt-writing guidelines'
    );
    expect(prompts.systemPrompt).toContain(
      'requested hair/clothing/body rules'
    );
    expect(prompts.systemPrompt).toContain(
      'subject-count tags at the start of every prompt'
    );
    expect(prompts.systemPrompt).toContain(
      'quality control tags in every prompt'
    );
    expect(prompts.systemPrompt).toContain('dedicated subject-count section');
    expect(prompts.systemPrompt).toContain('dedicated quality control section');
    expect(prompts.systemPrompt).toContain('forbidden-element handling');
    expect(prompts.systemPrompt).toContain(
      'at least two concrete examples tailored to the user'
    );
    expect(prompts.systemPrompt).toContain(
      'do not include the full ---PROMPT--- delimiter specification'
    );
    expect(prompts.systemPrompt).toContain(
      'dedicated multi-character handling section'
    );
    expect(prompts.systemPrompt).toContain('N=1, N=2, N=3, and N>=4');
    expect(prompts.systemPrompt).toContain(
      'distinct scene-driven spatial relationships'
    );
    expect(prompts.systemPrompt).toContain(
      'character clauses anchored by exact count tokens'
    );
    expect(prompts.systemPrompt).toContain('scene-driven composition');
    expect(prompts.systemPrompt).toContain('foreground/background');
    expect(prompts.systemPrompt).toContain(
      'no secondary character may be dropped'
    );
    expect(prompts.systemPrompt).toContain(
      'at least one multi-character interaction prompt'
    );
    expect(prompts.systemPrompt).toContain(
      'TEXT should not contain a standalone "Negative:" block'
    );
    expect(prompts.systemPrompt).toContain('bracketed raw negative list');
    expect(prompts.systemPrompt).toContain(
      'Do not return placeholder-only templates'
    );
    expect(prompts.userPrompt).toContain(
      'No external source text was provided'
    );
  });

  it('builds complete shared profile instructions when only requirements are provided', async () => {
    const presetImport = await loadPresetImportModule();
    const prompts = presetImport.presetImportTestHooks.buildAdapterPrompts({
      requestedName: 'Guofeng',
      selectedTarget: 'shared',
      requirement: '偏古风，发型和服装严格，禁止出现西方异世界元素。',
      sourceText: '',
    });

    expect(prompts.systemPrompt).toContain('sharedPromptProfile');
    expect(prompts.systemPrompt).toContain('single-line');
    expect(prompts.systemPrompt).toContain('<!--img-prompt="...">');
    expect(prompts.systemPrompt).toContain('generation timing rules');
    expect(prompts.systemPrompt).toContain(
      'begin with explicit subject-count tags'
    );
    expect(prompts.systemPrompt).toContain('scene-driven composition');
    expect(prompts.systemPrompt).toContain('motion arcs');
    expect(prompts.systemPrompt).toContain('bracketed raw negative lists');
    expect(prompts.systemPrompt).toContain('1girl');
    expect(prompts.systemPrompt).toContain('1boy');
    expect(prompts.systemPrompt).toContain('no humans');
    expect(prompts.systemPrompt).toContain('positive quality tags');
    expect(prompts.systemPrompt).toContain(
      'quality/anatomy/artifact exclusion control'
    );
    expect(prompts.systemPrompt).toContain('visible action');
    expect(prompts.systemPrompt).toContain('camera/framing');
    expect(prompts.systemPrompt).toContain('multi-character positioning');
    expect(prompts.systemPrompt).toContain('interaction reciprocity');
    expect(prompts.systemPrompt).not.toContain(
      'independentPromptWritingGuidelines'
    );
  });

  it('requires separate shared and independent profiles for requirement-only both target', async () => {
    const presetImport = await loadPresetImportModule();
    const prompts = presetImport.presetImportTestHooks.buildAdapterPrompts({
      requestedName: 'Guofeng',
      selectedTarget: 'both',
      requirement: '偏古风，发型和服装严格，禁止出现西方异世界元素。',
      sourceText: '',
    });

    expect(prompts.systemPrompt).toContain(
      'name, sharedPromptProfile, independentPromptWritingGuidelines'
    );
    expect(prompts.systemPrompt).toContain(
      'They must not be copied from each other'
    );
    expect(prompts.systemPrompt).toContain('shared inline insertion');
    expect(prompts.systemPrompt).toContain('independent standalone generation');
    expect(prompts.systemPrompt).toContain('camera/framing/shot scale');
    expect(prompts.systemPrompt).toContain('multi-character handling');
    expect(prompts.systemPrompt).toContain('N=1, N=2, N=3, and N>=4');
    expect(prompts.systemPrompt).toContain(
      'at least one multi-character interaction prompt'
    );
  });

  it('keeps shared and independent adapter targets separate', async () => {
    const presetImport = await loadPresetImportModule();

    const sharedPrompts =
      presetImport.presetImportTestHooks.buildAdapterPrompts({
        requestedName: 'Imported',
        selectedTarget: 'shared',
        requirement: '',
        sourceText: 'Scene Composition: {best quality},;',
      });

    expect(sharedPrompts.systemPrompt).toContain('sharedPromptProfile');
    expect(sharedPrompts.systemPrompt).toContain('one line inside');
    expect(sharedPrompts.systemPrompt).not.toContain(
      'independentPromptWritingGuidelines'
    );
    expect(sharedPrompts.systemPrompt).not.toContain(
      'Independent API delimiter'
    );

    const draft = presetImport.presetImportTestHooks.buildDraft({
      name: 'Split Draft',
      sharedPromptProfile: 'Shared profile must stay single-line.',
      independentPromptWritingGuidelines:
        'Independent profile may use Scene Composition and Character UC lines.',
    });

    expect(draft.sharedMetaPrompt).toContain(
      'Shared profile must stay single-line.'
    );
    expect(draft.sharedMetaPrompt).not.toContain(
      'Independent profile may use Scene Composition'
    );
    expect(draft.promptWritingGuidelines).toContain(
      'Independent profile may use Scene Composition'
    );
    expect(draft.promptWritingGuidelines).not.toContain(
      'Shared profile must stay single-line.'
    );
  });

  it('does not keep imported long reasoning requirements as prompt output rules', async () => {
    const presetImport = await loadPresetImportModule();
    const sourceProfile = `You are an image prompt generator for a tag-based model.
OUTPUT FORMAT:
---PROMPT---
TEXT: [Scene and character tags]
REASONING: [Complete detailed visual analysis process in Chinese, minimum 400 characters]
---END---
Before output, perform a detailed self-check for subject, composition, character continuity, and negative tags.`;

    const sanitized = presetImport.presetImportTestHooks.sanitizeAdaptedProfile(
      sourceProfile,
      'independent'
    );

    expect(sanitized).toContain('REASONING: brief one-line UI note only');
    expect(sanitized).not.toContain(
      'Complete detailed visual analysis process'
    );
    expect(sanitized).not.toContain('minimum 400 characters');
  });

  it('normalizes shared and independent drafts so imported analysis is not a visible output requirement', async () => {
    const presetImport = await loadPresetImportModule();
    const draft = presetImport.presetImportTestHooks.buildDraft({
      name: 'External Adapted',
      sharedPromptProfile:
        'Use tag prompts. REASONING: Complete detailed visual analysis process in Chinese, minimum 400 characters.',
      independentPromptWritingGuidelines:
        'Use Scene Composition and Character UC. REASONING: [Complete detailed visual analysis process in Chinese, minimum 400 characters]',
    });

    expect(draft.sharedMetaPrompt).toContain(
      'Do not output REASONING, analysis, private checks'
    );
    expect(draft.promptWritingGuidelines).toContain(
      'REASONING: brief one-line UI note only'
    );
    expect(draft.sharedMetaPrompt).not.toContain('minimum 400 characters');
    expect(draft.promptWritingGuidelines).not.toContain(
      'Complete detailed visual analysis process'
    );
  });

  it('removes positive and negative prompt placeholders from generated drafts', async () => {
    const presetImport = await loadPresetImportModule();
    const draft = presetImport.presetImportTestHooks.buildDraft({
      name: 'External Adapted',
      independentPromptWritingGuidelines:
        'TEXT:\nPositive Prompt: [Detailed scene tags]\nNegative Prompt: [bad anatomy, low quality]',
    });

    expect(draft.promptWritingGuidelines).toContain(
      'write concrete model-ready tags directly'
    );
    expect(draft.promptWritingGuidelines).toContain('Exclusion handling');
    expect(draft.promptWritingGuidelines).not.toContain(
      'Positive Prompt: [Detailed scene tags]'
    );
    expect(draft.promptWritingGuidelines).not.toContain(
      'Negative Prompt: [bad anatomy, low quality]'
    );
  });
});
