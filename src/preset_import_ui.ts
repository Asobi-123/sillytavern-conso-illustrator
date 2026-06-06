/**
 * External preset adapter UI.
 *
 * Imported JSON is parsed locally and converted into Conso's own preset fields.
 * The original external output format is not used directly for generation.
 */

import {DEFAULT_LLM_FREQUENCY_GUIDELINES, UI_ELEMENT_IDS} from './constants';
import {t} from './i18n';
import {createLogger} from './logger';
import {callIndependentLlmApi} from './services/independent_llm';
import {htmlEncode} from './utils/dom_utils';
import {extractErrorMessage} from './utils/error_utils';
import {isIndependentLlmPredefinedPresetName} from './independent_llm_presets';
import {isPredefinedPresetName} from './meta_prompt_presets';

const logger = createLogger('PresetImport');

type ImportTarget = 'independent' | 'shared' | 'both';

type Draft = {
  name: string;
  sharedMetaPrompt: string;
  promptWritingGuidelines: string;
};

type AdapterResponse = {
  name: string;
  promptWritingGuidelines?: string;
  sharedPromptProfile?: string;
  independentPromptWritingGuidelines?: string;
};

type SourceText = {name?: string; text: string; count: number};
type AdapterPrompts = {systemPrompt: string; userPrompt: string};

const CONSO_PROMPT_BASELINE_GUARD = `## Conso Prompt Baseline Guard

- Start each prompt with the correct subject count: "1girl", "1boy", "1other", combined counts such as "1girl, 1boy" or "2girls", "group" for crowds, or "no humans" when applicable.
- In multi-character prompts, bind each character's visible action, clothing, and distinguishing traits to that character's own count token. Reuse tokens like "1girl" and "1boy" as compact anchors when needed, but do not force a fixed left/right layout.
- Choose spatial layout from the scene and action. Use foreground/background, crossing paths, over-the-shoulder, diagonal action, circle composition, high/low angle, or left/right only when the scene naturally calls for it.
- Include positive quality/detail tags in every prompt.
- Handle quality/anatomy/artifact exclusions only through a real negative/UC/negative-weight channel when supported. If unsupported, avoid raw forbidden-word lists in positive TEXT and strengthen the desired positive details instead.
- Do not use bracketed lists like "[low quality, jeans:1.3]" as a universal negative prompt.`;

const CONSO_STANDALONE_OUTPUT_GUARD = `## Conso Standalone Output Guard

- Conso supplies the outer ---PROMPT---, TEXT, REASONING, and ---END--- wrapper. This profile only controls what the later LLM writes inside TEXT and the brief REASONING note.
- TEXT is the final prompt sent to image generation. Do not instruct the later LLM to put a separate "Negative:", "Negative Prompt:", placeholder bracket section, or raw forbidden-word list inside TEXT. Express exclusions with the target model's true inline negative/UC syntax only when supported; otherwise replace forbidden concepts with stronger affirmative target descriptions.
- Multi-character scenes are mandatory. When 2+ visible characters are present, TEXT must describe every visible character, not only the main subject.
- N=1: write one complete subject clause with identity, appearance, clothing, action, expression, scene, lighting, and camera.
- N=2: keep both characters distinct with count-token anchors and scene-appropriate spatial/action relationships. Do not default to flat left/right staging; use the composition implied by movement, gaze, distance, height, depth, or interaction.
- N=3: keep each character distinct and choose a camera/framing wide enough for clothing and poses. Use varied staging such as triangle composition, foreground/midground/background, diagonal motion, or side positions only when appropriate.
- N>=4: use group or crowd composition with wide shot framing, identify the focal character or focal pair, group secondary figures by role/location, and avoid close-up framing that would erase participants.
- Never collapse a secondary character into a background detail when the scene text makes that character visually present. Never merge two characters' hair, clothing colors, accessories, or actions into one person.
- Include action, pose, expression, shot scale, camera angle, composition, lighting, and environment for every generated prompt. Widen the shot as character count increases.`;

let contextRef: SillyTavernContext | null = null;
let settingsRef: AutoIllustratorSettings | null = null;
let saveSettingsFn: (() => void) | null = null;
let refreshUiFn: (() => void) | null = null;
let initialized = false;
let currentDraft: Draft | null = null;

function showToast(
  message: string,
  type: 'info' | 'success' | 'error' | 'warning' = 'info'
): void {
  const toastr = (window as unknown as Record<string, unknown>)['toastr'] as
    | Record<string, (msg: string) => void>
    | undefined;
  if (toastr && typeof toastr[type] === 'function') {
    toastr[type](message);
  } else {
    logger.info(`[Toast/${type}] ${message}`);
  }
}

export function createPresetImportContent(): string {
  return `
    <div class="preset-import-container">
      <label>
        <span>${t('presetImport.name')}</span>
        <input id="${UI_ELEMENT_IDS.PRESET_IMPORT_NAME}" class="text_pole" type="text"
               placeholder="${t('presetImport.namePlaceholder')}" />
      </label>
      <label>
        <span>${t('presetImport.target')}</span>
        <select id="${UI_ELEMENT_IDS.PRESET_IMPORT_TARGET}" class="text_pole">
          <option value="independent">${t('presetImport.targetIndependent')}</option>
          <option value="shared">${t('presetImport.targetShared')}</option>
          <option value="both">${t('presetImport.targetBoth')}</option>
        </select>
      </label>
      <label class="preset-import-file-picker">
        <input id="${UI_ELEMENT_IDS.PRESET_IMPORT_FILE}" type="file" accept=".json,.txt,.text,application/json,text/plain" />
        <span><i class="fa-solid fa-file-arrow-up"></i> ${t('presetImport.uploadFile')}</span>
      </label>
      <label>
        <span>${t('presetImport.json')}</span>
        <small>${t('presetImport.jsonDesc')}</small>
        <textarea id="${UI_ELEMENT_IDS.PRESET_IMPORT_JSON}" class="text_pole textarea_compact" rows="8"
                  placeholder="${t('presetImport.jsonPlaceholder')}"></textarea>
      </label>
      <label>
        <span>${t('presetImport.requirement')}</span>
        <small>${t('presetImport.requirementDesc')}</small>
        <textarea id="${UI_ELEMENT_IDS.PRESET_IMPORT_REQUIREMENT}" class="text_pole textarea_compact" rows="4"
                  placeholder="${t('presetImport.requirementPlaceholder')}"></textarea>
      </label>
      <div class="preset-import-actions">
        <button id="${UI_ELEMENT_IDS.PRESET_IMPORT_ANALYZE}" class="menu_button" type="button">
          <i class="fa-solid fa-magnifying-glass"></i> ${t('presetImport.analyze')}
        </button>
        <button id="${UI_ELEMENT_IDS.PRESET_IMPORT_GENERATE}" class="menu_button" type="button">
          <i class="fa-solid fa-wand-magic-sparkles"></i> ${t('presetImport.generate')}
        </button>
        <button id="${UI_ELEMENT_IDS.PRESET_IMPORT_SAVE}" class="menu_button" type="button" disabled>
          <i class="fa-solid fa-floppy-disk"></i> ${t('presetImport.save')}
        </button>
      </div>
      <div id="${UI_ELEMENT_IDS.PRESET_IMPORT_RESULT}" class="preset-import-result">
        ${htmlEncode(t('presetImport.emptyResult'))}
      </div>
    </div>
  `;
}

function getInput(id: string): HTMLInputElement | null {
  return document.getElementById(id) as HTMLInputElement | null;
}

function getTextarea(id: string): HTMLTextAreaElement | null {
  return document.getElementById(id) as HTMLTextAreaElement | null;
}

function setSaveEnabled(enabled: boolean): void {
  const saveButton = document.getElementById(
    UI_ELEMENT_IDS.PRESET_IMPORT_SAVE
  ) as HTMLButtonElement | null;
  if (saveButton) saveButton.disabled = !enabled;
}

function clearDraftState(): void {
  currentDraft = null;
  setSaveEnabled(false);
}

function readTextFile(file: File): Promise<string> {
  if (typeof file.text === 'function') {
    return file.text();
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Read failed'));
    reader.readAsText(file);
  });
}

function target(): ImportTarget {
  const select = document.getElementById(
    UI_ELEMENT_IDS.PRESET_IMPORT_TARGET
  ) as HTMLSelectElement | null;
  return (select?.value as ImportTarget) || 'independent';
}

function recursiveStrings(
  value: unknown,
  path = '',
  out: string[] = []
): string[] {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed) {
      out.push(`${path || 'root'}:\n${trimmed}`);
    }
    return out;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      recursiveStrings(item, `${path}[${index}]`, out)
    );
    return out;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      recursiveStrings(child, path ? `${path}.${key}` : key, out);
    }
  }
  return out;
}

function sourceText(): SourceText {
  const raw =
    getTextarea(UI_ELEMENT_IDS.PRESET_IMPORT_JSON)?.value.trim() || '';
  if (!raw) return {text: '', count: 0};

  try {
    const parsed = JSON.parse(raw);
    const strings = recursiveStrings(parsed);
    const name =
      typeof parsed?.name === 'string'
        ? parsed.name
        : typeof parsed?.title === 'string'
          ? parsed.title
          : undefined;
    return {
      name,
      text: strings.join('\n\n---\n\n'),
      count: strings.length,
    };
  } catch {
    return {text: raw, count: raw ? 1 : 0};
  }
}

function buildSourceExcerpt(source: string): string {
  return source.trim();
}

function renderAnalysis(): void {
  clearDraftState();
  const result = document.getElementById(UI_ELEMENT_IDS.PRESET_IMPORT_RESULT);
  if (!result) return;
  const source = sourceText();
  if (!source.text) {
    result.textContent = t('presetImport.noSource');
    return;
  }
  if (source.name && !getInput(UI_ELEMENT_IDS.PRESET_IMPORT_NAME)?.value) {
    const input = getInput(UI_ELEMENT_IDS.PRESET_IMPORT_NAME);
    if (input) input.value = source.name;
  }
  result.innerHTML = `
    <div class="preset-import-summary">${htmlEncode(
      t('presetImport.analysisSummary', {count: source.count})
    )}</div>
    <pre>${htmlEncode(source.text)}</pre>
  `;
}

function resetResultToSourcePreview(): void {
  clearDraftState();
  if (sourceText().text) {
    renderAnalysis();
    return;
  }

  const result = document.getElementById(UI_ELEMENT_IDS.PRESET_IMPORT_RESULT);
  if (result) {
    result.textContent = t('presetImport.emptyResult');
  }
}

async function handleFileUpload(event: Event): Promise<void> {
  const input = event.currentTarget as HTMLInputElement | null;
  const file = input?.files?.[0];
  if (!file) return;

  try {
    const text = await readTextFile(file);
    const textarea = getTextarea(UI_ELEMENT_IDS.PRESET_IMPORT_JSON);
    if (textarea) {
      textarea.value = text;
      textarea.dispatchEvent(new Event('input', {bubbles: true}));
    }
    renderAnalysis();
    showToast(t('presetImport.fileLoaded', {name: file.name}), 'success');
  } catch (error) {
    logger.error('Failed to read preset file:', error);
    showToast(t('presetImport.fileReadFailed'), 'error');
  } finally {
    if (input) input.value = '';
  }
}

function stripMarkdownFence(raw: string): string {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return (fenceMatch?.[1] || trimmed).trim();
}

function parseAdapterJson(raw: string): Partial<
  AdapterResponse &
    Draft & {
      writingGuidelines: string;
      guidance: string;
      sharedGuidelines: string;
      sharedPromptWritingGuidelines: string;
      independentGuidelines: string;
    }
> | null {
  const candidates = [raw];
  const objectMatch = raw.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    candidates.push(objectMatch[0]);
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as Partial<
        AdapterResponse &
          Draft & {
            writingGuidelines: string;
            guidance: string;
            sharedGuidelines: string;
            sharedPromptWritingGuidelines: string;
            independentGuidelines: string;
          }
      >;
    } catch {
      // Try the next parse candidate.
    }
  }

  return null;
}

function firstText(...values: Array<unknown>): string {
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return '';
}

function parseAdapterResponse(
  raw: string,
  fallbackName = 'Imported Preset'
): AdapterResponse {
  const cleaned = stripMarkdownFence(raw);
  const parsed = parseAdapterJson(cleaned);

  if (!parsed) {
    if (!cleaned) {
      throw new Error('Adapter response is empty');
    }
    return {
      name: fallbackName,
      promptWritingGuidelines: cleaned,
      sharedPromptProfile: cleaned,
      independentPromptWritingGuidelines: cleaned,
    };
  }

  const commonGuidelines = firstText(
    parsed.promptWritingGuidelines,
    parsed.writingGuidelines,
    parsed.guidance
  );
  const sharedPromptProfile = firstText(
    parsed.sharedPromptProfile,
    parsed.sharedPromptWritingGuidelines,
    parsed.sharedGuidelines,
    parsed.sharedMetaPrompt,
    commonGuidelines
  );
  const independentPromptWritingGuidelines = firstText(
    parsed.independentPromptWritingGuidelines,
    parsed.independentGuidelines,
    commonGuidelines,
    sharedPromptProfile
  );
  const promptWritingGuidelines = firstText(
    commonGuidelines,
    independentPromptWritingGuidelines,
    sharedPromptProfile
  );

  if (!promptWritingGuidelines) {
    throw new Error('Adapter response missing prompt-writing guidance');
  }

  return {
    name: parsed.name?.trim() || fallbackName,
    promptWritingGuidelines,
    sharedPromptProfile,
    independentPromptWritingGuidelines,
  };
}

function composeIndependentGuidelines(adaptedGuidelines: string): string {
  const trimmed = adaptedGuidelines.trim();
  const guards = [
    CONSO_PROMPT_BASELINE_GUARD.trim(),
    CONSO_STANDALONE_OUTPUT_GUARD.trim(),
  ].filter(guard => !trimmed.includes(guard.split('\n')[0]));
  if (!trimmed) return guards.join('\n\n');
  if (!guards.length) return trimmed;
  return `${trimmed}\n\n${guards.join('\n\n')}`;
}

function composeSharedMetaPrompt(adaptedGuidelines: string): string {
  return `# Conso Shared API Image Prompt Meta Prompt

You are writing the normal chat response. When a visual moment should be illustrated, insert an image prompt HTML comment into the response.

## Generation Frequency

- Insert image prompts approximately every 250 words or at major scene changes.
- Prioritize clear visual moments: scene transitions, character introductions, important actions, visible emotion with pose/expression, location changes, and scenes with strong atmosphere.
- Skip pure dialogue, abstract thoughts, summaries, and text with no clear visual content.
- Do not interrupt a sentence. Put the image prompt on its own line at a natural boundary.

## Required Output Format

- Use exactly: \`<!--img-prompt="...">\`.
- Put each image prompt comment on its own line.
- Keep the prompt content inside the quotes on a single line.
- Do not wrap prompts in code blocks.
- Do not output JSON, worldbook fields, activation keys, depth/scan metadata, or any external preset structure.

## Prompt Writing Profile

${adaptedGuidelines.trim()}

${CONSO_PROMPT_BASELINE_GUARD.trim()}

## Conflict Rules

- Treat the Prompt Writing Profile above as the active style/model profile.
- If the imported profile conflicts with generic tag advice, follow the imported profile.
- Keep Conso's HTML comment format even if the imported preset used another format.`;
}

function normalizeVisibleReasoningRules(
  text: string,
  target: 'shared' | 'independent'
): string {
  let result = text;
  const replacement =
    target === 'shared'
      ? 'Do not output REASONING, analysis, private checks, or any non-Conso wrapper text.'
      : 'REASONING: brief one-line UI note only; never output long analysis here.';

  result = result.replace(
    /^#{1,6}\s*(?:\d+\.\s*)?(?:REASONING|Reasoning)[^\n]*(?:thinking|analysis|process|推理|思考|分析)[^\n]*$/gim,
    replacement
  );
  result = result.replace(
    /REASONING:\s*\[[^\]\n]*(?:thinking|analysis|process|推理|思考|分析)[^\]\n]*\]/gi,
    replacement
  );
  result = result.replace(
    /REASONING:\s*(?:Complete|Write|Output|Include)[^\n]*(?:thinking|analysis|process|推理|思考|分析)[^\n]*/gi,
    replacement
  );
  result = result.replace(
    /在\s*`?REASONING`?\s*[^。\n]*(?:逐步|完整|详细|推理|思考|分析|自检)[^。\n]*[。\n]/g,
    target === 'shared'
      ? '不要输出 REASONING、分析过程、自检过程或任何非 Conso 包装文本。\n'
      : 'REASONING 只写一行给界面看的选择理由，不输出长分析。\n'
  );
  result = result.replace(
    /minimum\s+\d+\s*(?:characters|Chinese characters|中文字|中文字符)/gi,
    'brief one-line'
  );
  result = result.replace(
    /(?:complete|full|rigorous|detailed)\s+(?:visual\s+)?(?:thinking|analysis)\s+process/gi,
    'private source check'
  );
  result = result.replace(
    /(?:chain-of-thought|hidden thinking blocks?)/gi,
    'private source checks'
  );

  return result.trim();
}

function normalizePromptPlaceholderRules(text: string): string {
  let result = text;

  result = result.replace(
    /\bPositive Prompt\s*:\s*\[[^\]\n]*\]/gi,
    'Positive prompt content: write concrete model-ready tags directly; do not output placeholder labels.'
  );
  result = result.replace(
    /\bNegative Prompt\s*:\s*\[[^\]\n]*\]/gi,
    'Exclusion handling: express forbidden elements with model-native inline exclusions or Conso-compatible UC rules; do not output a literal placeholder label.'
  );

  return result.trim();
}

function sanitizeAdaptedProfile(
  profile: string,
  target: 'shared' | 'independent'
): string {
  return normalizePromptPlaceholderRules(
    normalizeVisibleReasoningRules(profile, target)
  );
}

function buildAdapterPrompts(input: {
  requestedName: string;
  selectedTarget: ImportTarget;
  requirement: string;
  sourceText: string;
}): AdapterPrompts {
  const sourceExcerpt = buildSourceExcerpt(input.sourceText);
  const hasSourceText = !!sourceExcerpt;
  const requestedFields =
    input.selectedTarget === 'shared'
      ? 'name, sharedPromptProfile'
      : input.selectedTarget === 'independent'
        ? 'name, independentPromptWritingGuidelines'
        : 'name, sharedPromptProfile, independentPromptWritingGuidelines';
  const sharedRules =
    input.selectedTarget === 'shared' || input.selectedTarget === 'both'
      ? `- For sharedPromptProfile: write a complete shared API meta-prompt profile. It must teach the main chat LLM when and how to insert single-line \`<!--img-prompt="...">\` comments inside normal chat replies.
- Shared prompt content must fit on one line inside the HTML comment. Do not instruct the later LLM to output multi-line Scene/Character/UC labels, TEXT, REASONING, Positive Prompt labels, Negative Prompt labels, JSON, or code blocks.
- Shared profile prompts must begin with explicit subject-count tags such as 1girl, 1boy, 1girl, 1boy, 2girls, group, or no humans. Include positive quality tags and quality/anatomy/artifact exclusion control in every prompt.
- In shared multi-character prompts, bind each visible character's action, clothing, and distinguishing traits to that character's own count token, such as 1girl or 1boy. Do not use only "the woman", "the man", "scholar", or pronouns for character-specific action, clothing, and appearance clauses.
- Shared profiles must encourage scene-driven composition, not fixed left/right staging. Use depth, diagonals, foreground/background, over-the-shoulder, motion arcs, or other layouts when the scene calls for them.
- Shared profiles must not recommend bracketed raw negative lists inside the positive prompt. If the backend does not support true inline negative weights, handle forbidden concepts by strengthening wanted positive details instead of writing forbidden words such as jeans or western armor.
- Shared profiles must include generation timing rules for inline insertion: visual scene changes, character introductions, visible action, pose/expression shifts, location changes, strong atmosphere, and skip pure dialogue/abstract thoughts.
- Shared profiles must include action/pose extraction, camera/framing, composition, lighting, scene/background, character count, multi-character positioning, character differentiation, interaction reciprocity, requested style constraints, and explicit forbidden-element handling.
- If the source uses Scene/Character/UC, compress Scene + Character Prompt rules into a single-line tag prompt. Convert UC isolation into positive-prompt negative weights where the model supports them, or into concise anti-bleed instructions, because shared prompt content has no separate per-character UC field. If the source has visible self-check, analysis, or reasoning-output requirements, preserve only the useful constraints as private prompt-construction rules and never as printed REASONING.`
      : '';
  const independentRules =
    input.selectedTarget === 'independent' || input.selectedTarget === 'both'
      ? `- For independentPromptWritingGuidelines: all image prompt content goes inside TEXT. TEXT may be multi-line when the selected profile requires structured Scene/Character/UC sections.
- Independent TEXT prompts must begin with explicit subject-count tags such as 1girl, 1boy, 1girl, 1boy, 2girls, group, or no humans. Include positive quality tags and quality/anatomy/artifact exclusion control in every prompt.
- In independent multi-character TEXT prompts, bind each visible character's action, clothing, and distinguishing traits to that character's own count token, such as 1girl or 1boy. Do not use only "the woman", "the man", "scholar", or pronouns for character-specific action, clothing, and appearance clauses.
- Independent profiles must encourage scene-driven composition, not fixed left/right staging. Use depth, diagonals, foreground/background, over-the-shoulder, motion arcs, or other layouts when the scene calls for them.
- Independent profiles must teach the standalone prompt LLM how to construct both solo and multi-character TEXT prompts. When 2+ characters are visible, TEXT must cover every visible character, not only the main subject.
- Independent TEXT is the final prompt sent to image generation. Do not create or recommend a separate "Negative:" / "Negative Prompt:" label, bracketed raw negative list, or unsupported forbidden-word list inside TEXT. Prefer true inline negative weights or model-native UC syntax only when the target backend explicitly supports them; otherwise handle forbidden concepts by strengthening wanted positive details.
- Convert visible self-check, analysis, or reasoning-output requirements into private prompt-construction rules. Do not require the later LLM to print a long reasoning block. REASONING should be a brief one-line UI note only.
- Independent API delimiter remains exactly:
---PROMPT---
TEXT: ...
REASONING: ...
---END---`
      : '';
  const customIndependentRules =
    input.selectedTarget === 'independent' || input.selectedTarget === 'both'
      ? `- For independent target output created from requirement-only input, do not include the full ---PROMPT--- delimiter specification; Conso supplies that outside the preset. Explain only what the later LLM should put inside TEXT and the brief REASONING note.
- For requirement-only independent profiles, define standalone TEXT construction rules, not just style tags. The profile must include a dedicated multi-character handling section.
- The independent profile must include a dedicated subject-count section. It must require 1girl/1boy/1other/no humans for solo or non-human scenes and combined counts such as 1girl, 1boy, 2girls, 2boys, 3girls, group for multi-character scenes.
- The independent profile must include a dedicated quality control section. It must require positive quality/detail tags and negative quality/anatomy/artifact controls in every generated TEXT prompt.
- The independent multi-character section must cover N=1, N=2, N=3, and N>=4 behavior: subject/count tags, safe shot scale, distinct scene-driven spatial relationships, character clauses anchored by exact count tokens such as 1girl and 1boy, per-character identity/appearance/clothing clauses, action/pose/expression for each visible character, reciprocal interaction pairs, anti-bleed or exclusion handling, and a rule that no secondary character may be dropped or merged into the main character.
- The generated independent profile examples must include at least one multi-character interaction prompt and one action/camera prompt tailored to the user's requirement.
- The independent profile must explicitly state that TEXT should not contain a standalone "Negative:" block or bracketed raw negative list because Conso standalone generation passes TEXT as the prompt text. Negative control must be represented with true inline exclusions, weighted negative tags, or UC clauses only when the target backend supports them; otherwise it must be represented by affirmative positive constraints that exclude the unwanted concept without naming it.
- For requirement-only independent profiles, prefer model-ready tags with inline exclusion/negative-weight rules. Use structured UC lines only if the user explicitly asks for per-character UC handling.`
      : '';
  const customProfileRules = !hasSourceText
    ? `When no external source text is provided:
- Create a Conso-native custom prompt-writing profile from the user's requirement. Do not pretend to adapt an external preset.
- The profile must be complete enough to replace the default prompt-writing guidelines, not a short style list.
- Required coverage for every target: scope and target aesthetic, prompt structure, subject/count rules, style/model syntax, character identity and appearance source, requested hair/clothing/body rules, scene/background rules, action and pose extraction from current text, camera/framing/shot scale, composition and spatial layout, lighting/atmosphere, forbidden-element handling, multi-character handling, interaction reciprocity, quality/detail tags, fallback behavior when context is vague, and at least two concrete examples tailored to the user's requirement.
- The generated profile must explicitly require subject-count tags at the start of every prompt and quality control tags in every prompt.
- Include both positive requirements and explicit exclusions from the user's requirement.
- Do not invent or name any community preset, author preset, or external workflow.
- Do not return placeholder-only templates such as "Positive Prompt: [ ... ]" or "Negative Prompt: [ ... ]".
${customIndependentRules}`
    : '';
  const structuredRules =
    input.selectedTarget === 'shared'
      ? '- Shared must keep structured source intent without Scene/Character/UC labels, using one single-line prompt.'
      : input.selectedTarget === 'independent'
        ? '- Independent can keep explicit lines such as Scene Composition, Character 1 Prompt, Character 1 UC, Character 2 Prompt, Character 2 UC.'
        : `- Independent can keep explicit lines such as Scene Composition, Character 1 Prompt, Character 1 UC, Character 2 Prompt, Character 2 UC.
- Shared must keep the same intent without those labels, using one single-line prompt.`;
  const bothRules =
    input.selectedTarget === 'both'
      ? '- For target "both", generate sharedPromptProfile and independentPromptWritingGuidelines separately. They must not be copied from each other because shared inline insertion and independent standalone generation have different output contracts.'
      : '';
  const systemPrompt = `You convert external image-prompt presets into an executable Conso Illustrator prompt-writing profile.
The result must be a usable prompt-writing specification, not a summary.

Preserve useful image-generation logic:
- model/tag syntax, weights, negative prompt/UC rules, quality tags, camera, lighting, scene layering, subject priority, action/expression extraction, character consistency, multi-character composition, and safety/rating rules.
- detect the source's actual structure when source text exists. Some presets use Scene/Character/UC sections, some use NAI pipe segments, some use positive/negative prompt pairs, and some are only model/style rules. Convert the useful prompt logic into the requested Conso target format.
${customProfileRules}

Remove external runtime mechanics:
- worldbook JSON fields, activation keys, depth/scan metadata, vectorization flags, roleplay/story pacing rules, chain-of-thought requirements, hidden thinking blocks, image count mandates, and any external wrapper format.
- Preserve useful self-check logic from source analysis sections only as concise private constraints. Do not turn them into printed reasoning, long analysis, or minimum-character REASONING requirements.

Conso constraints:
- Return only JSON with keys: ${requestedFields}.
- Each returned profile must be written as direct instructions for the later prompt-generation LLM.
- Do not generate Conso frequency guidelines.
- Do not output or require <image>, image###, worldbook wrappers, JSON entries, activation keys, depth, scan, or roleplay control text in generated image prompts.
${[bothRules, sharedRules, independentRules].filter(Boolean).join('\n')}

When preserving structured logic:
${structuredRules}
- Keep UC/negative-prompt rules attached to the relevant character or scene when the target supports it.
- Never copy the external example wrapper itself.`;

  const userPrompt = `Preset name request: ${input.requestedName}
Target: ${input.selectedTarget}

Target-specific save rules:
- shared: Conso saves one complete shared meta prompt locally.
- independent: Conso saves promptWritingGuidelines only; frequency selection stays outside the preset.
- both: write two target-aware profiles. Do not reuse the independent multi-line profile as the shared profile.

User requirement:
${input.requirement || '(none)'}

${
  hasSourceText
    ? `Full extracted source text:\n${sourceExcerpt}`
    : 'No external source text was provided. Generate from the user requirement only.'
}`;

  return {systemPrompt, userPrompt};
}

function buildDraft(adapterResponse: AdapterResponse): Draft {
  const sharedProfile =
    adapterResponse.sharedPromptProfile ||
    adapterResponse.promptWritingGuidelines ||
    adapterResponse.independentPromptWritingGuidelines ||
    '';
  const independentGuidelines =
    adapterResponse.independentPromptWritingGuidelines ||
    adapterResponse.promptWritingGuidelines ||
    adapterResponse.sharedPromptProfile ||
    '';
  return {
    name: adapterResponse.name,
    sharedMetaPrompt: composeSharedMetaPrompt(
      sanitizeAdaptedProfile(sharedProfile, 'shared')
    ),
    promptWritingGuidelines: composeIndependentGuidelines(
      sanitizeAdaptedProfile(independentGuidelines, 'independent')
    ),
  };
}

async function callSharedAdapterLlm(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  if (!contextRef?.generateRaw) {
    throw new Error(t('presetImport.llmUnavailable'));
  }
  return contextRef.generateRaw({systemPrompt, prompt: userPrompt});
}

async function callIndependentAdapterLlm(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  if (!settingsRef) {
    throw new Error('Preset import is not initialized');
  }
  return callIndependentLlmApi(systemPrompt, userPrompt, settingsRef);
}

async function callAdapterLlm(
  systemPrompt: string,
  userPrompt: string,
  selectedTarget: ImportTarget
): Promise<string> {
  if (!contextRef || !settingsRef) {
    throw new Error('Preset import is not initialized');
  }

  if (selectedTarget === 'shared' || selectedTarget === 'both') {
    return callSharedAdapterLlm(systemPrompt, userPrompt);
  }

  if (settingsRef.useIndependentLlmApi) {
    try {
      return await callIndependentAdapterLlm(systemPrompt, userPrompt);
    } catch (error) {
      if (!contextRef.generateRaw) {
        throw error;
      }
      logger.warn(
        'Independent LLM adapter call failed; falling back to generateRaw:',
        extractErrorMessage(error),
        error
      );
    }
  }

  return callSharedAdapterLlm(systemPrompt, userPrompt);
}

function renderDraft(draft: Draft): void {
  const result = document.getElementById(UI_ELEMENT_IDS.PRESET_IMPORT_RESULT);
  setSaveEnabled(true);
  if (!result) return;
  const selectedTarget = target();
  const sharedDraft =
    selectedTarget === 'shared' || selectedTarget === 'both'
      ? `<label>${htmlEncode(t('presetImport.sharedDraft'))}
          <textarea class="text_pole textarea_compact" data-draft-field="sharedMetaPrompt" rows="12">${htmlEncode(
            draft.sharedMetaPrompt
          )}</textarea>
        </label>`
      : '';
  const independentDraft =
    selectedTarget === 'independent' || selectedTarget === 'both'
      ? `<label>${htmlEncode(t('presetImport.writingDraft'))}
          <textarea class="text_pole textarea_compact" data-draft-field="promptWritingGuidelines" rows="12">${htmlEncode(
            draft.promptWritingGuidelines
          )}</textarea>
        </label>`
      : '';
  result.innerHTML = `
    <div class="preset-import-summary">${htmlEncode(t('presetImport.draftReady'))}</div>
    ${sharedDraft}
    ${independentDraft}
  `;
}

async function generateDraft(): Promise<void> {
  const source = sourceText();
  const requirement =
    getTextarea(UI_ELEMENT_IDS.PRESET_IMPORT_REQUIREMENT)?.value.trim() || '';
  const requestedName =
    getInput(UI_ELEMENT_IDS.PRESET_IMPORT_NAME)?.value.trim() ||
    source.name ||
    'Imported Preset';

  if (!source.text && !requirement) {
    showToast(t('presetImport.noSource'), 'warning');
    return;
  }

  const selectedTarget = target();
  const {systemPrompt, userPrompt} = buildAdapterPrompts({
    requestedName,
    selectedTarget,
    requirement,
    sourceText: source.text,
  });

  const button = document.getElementById(
    UI_ELEMENT_IDS.PRESET_IMPORT_GENERATE
  ) as HTMLButtonElement | null;
  if (button) button.disabled = true;
  setSaveEnabled(false);
  try {
    const response = await callAdapterLlm(
      systemPrompt,
      userPrompt,
      selectedTarget
    );
    currentDraft = buildDraft(parseAdapterResponse(response, requestedName));
    if (getInput(UI_ELEMENT_IDS.PRESET_IMPORT_NAME) && currentDraft.name) {
      getInput(UI_ELEMENT_IDS.PRESET_IMPORT_NAME)!.value = currentDraft.name;
    }
    renderDraft(currentDraft);
  } catch (error) {
    clearDraftState();
    logger.error('Preset import generation failed:', error);
    showToast(
      t('presetImport.generateFailed', {error: extractErrorMessage(error)}),
      'error'
    );
  } finally {
    if (button) button.disabled = false;
  }
}

function syncDraftFromTextareas(): void {
  if (!currentDraft) return;
  document
    .querySelectorAll<HTMLTextAreaElement>('[data-draft-field]')
    .forEach(textarea => {
      const field = textarea.dataset.draftField as keyof Draft;
      if (field && field !== 'name') {
        currentDraft![field] = textarea.value;
      }
    });
}

function saveDraft(): void {
  if (!settingsRef || !currentDraft) return;
  syncDraftFromTextareas();

  const name =
    getInput(UI_ELEMENT_IDS.PRESET_IMPORT_NAME)?.value.trim() ||
    currentDraft.name ||
    'Imported Preset';
  const id = `custom-${Date.now()}`;
  const selectedTarget = target();

  if (
    (selectedTarget === 'shared' || selectedTarget === 'both') &&
    currentDraft.sharedMetaPrompt
  ) {
    if (isPredefinedPresetName(name)) {
      showToast(t('toast.cannotUsePredefinedNames'), 'error');
      return;
    }
    settingsRef.customPresets.push({
      id: `${id}-shared`,
      name,
      template: currentDraft.sharedMetaPrompt,
      predefined: false,
    });
  }

  if (
    (selectedTarget === 'independent' || selectedTarget === 'both') &&
    currentDraft.promptWritingGuidelines
  ) {
    if (isIndependentLlmPredefinedPresetName(name)) {
      showToast(t('toast.cannotUsePredefinedIndependentLlmNames'), 'error');
      return;
    }
    settingsRef.customIndependentLlmPresets.push({
      id: `${id}-independent`,
      name,
      frequencyGuidelines: DEFAULT_LLM_FREQUENCY_GUIDELINES,
      promptWritingGuidelines: currentDraft.promptWritingGuidelines,
      predefined: false,
    });
  }

  saveSettingsFn?.();
  refreshUiFn?.();
  clearDraftState();
  showToast(t('presetImport.saved'), 'success');
}

export const presetImportTestHooks = {
  parseAdapterResponse,
  composeIndependentGuidelines,
  composeSharedMetaPrompt,
  buildSourceExcerpt,
  buildAdapterPrompts,
  buildDraft,
  sanitizeAdaptedProfile,
  renderAnalysis,
  sourceText,
};

export function initializePresetImport(
  context: SillyTavernContext,
  settings: AutoIllustratorSettings,
  saveFn: () => void,
  refreshFn: () => void
): void {
  contextRef = context;
  settingsRef = settings;
  saveSettingsFn = saveFn;
  refreshUiFn = refreshFn;

  if (initialized) return;
  initialized = true;

  document
    .getElementById(UI_ELEMENT_IDS.PRESET_IMPORT_FILE)
    ?.addEventListener('change', event => {
      handleFileUpload(event);
    });
  document
    .getElementById(UI_ELEMENT_IDS.PRESET_IMPORT_ANALYZE)
    ?.addEventListener('click', renderAnalysis);
  document
    .getElementById(UI_ELEMENT_IDS.PRESET_IMPORT_TARGET)
    ?.addEventListener('change', resetResultToSourcePreview);
  document
    .getElementById(UI_ELEMENT_IDS.PRESET_IMPORT_JSON)
    ?.addEventListener('input', resetResultToSourcePreview);
  document
    .getElementById(UI_ELEMENT_IDS.PRESET_IMPORT_REQUIREMENT)
    ?.addEventListener('input', resetResultToSourcePreview);
  document
    .getElementById(UI_ELEMENT_IDS.PRESET_IMPORT_GENERATE)
    ?.addEventListener('click', () => {
      generateDraft();
    });
  document
    .getElementById(UI_ELEMENT_IDS.PRESET_IMPORT_SAVE)
    ?.addEventListener('click', saveDraft);
}
