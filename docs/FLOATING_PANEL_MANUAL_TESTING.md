# Floating Panel Manual Testing

This checklist covers the floating panel UI and later tool overlays mounted inside the floating panel.

## Preconditions

- Extension is built successfully with `npm run build`
- Extension is loaded in a live SillyTavern environment
- At least one chat is open
- Image generation is configured and working

## 1. Panel Shell

- Open the floating panel
  - Expected: panel appears without console errors
- Close the floating panel
  - Expected: panel hides and launcher remains available
- Reopen the floating panel
  - Expected: panel restores correctly
- Refresh the page after closing/opening
  - Expected: open state persists

## 2. Theme Switching

- Switch between multiple panel themes
  - Expected: panel colors update immediately
- Test one dark theme and one light theme
  - Expected: text, inputs, overlays, and nested cards remain readable
- Open `Context Injection Settings` in a light theme
  - Expected: overlay and fields are also light-themed
- Open `World Book Manager` in a light theme
  - Expected: book cards and entry rows are also light-themed

## 3. Main Dashboard

- Toggle `Enable Auto Illustrator`
  - Expected: underlying setting changes and survives refresh
- Switch prompt generation mode between shared/independent
  - Expected: prompt settings page shows the correct mode section
- Edit per-chat image folder label
  - Expected: value updates and survives chat reload for current chat

## 4. Prompt Settings

### Shared API Mode

- Switch to shared API mode
  - Expected: `Shared API Mode` section is visible
  - Expected: `Independent API Mode` section is hidden
- Change meta prompt preset
  - Expected: preview updates
- Enter preset edit mode
  - Expected: editor opens and save buttons behave correctly

### Independent API Mode

- Switch to independent API mode
  - Expected: `Independent API Mode` section is visible
  - Expected: `Shared API Mode` section is hidden
- Edit base parameters
  - Expected: values update and persist
- Toggle context injection from panel
  - Expected: underlying context injection checkboxes sync
- Toggle world info injection from panel
  - Expected: underlying world info checkbox syncs
- Expand/collapse `Guidelines Preset`
  - Expected: works independently
- Expand/collapse `Independent LLM API`
  - Expected: works independently

### Shared Between Modes

- Open `Tag Catalog`
  - Expected: opens as a separate overlay, not crowded into the prompt settings content flow
  - Expected: total catalog count, built-in/custom counts, and category stats are visible
  - Expected: search, category filter, source filter, pagination, and page size controls work
  - Expected: list area scrolls and large catalogs do not expand the panel indefinitely
  - Expected: action buttons stay horizontal; narrow layouts may wrap, but text must not become vertical
- Test `Tag Catalog` custom tags
  - Expected: custom tags can be batch-added under the existing category taxonomy
  - Expected: duplicate tags are skipped and do not create duplicate entries
  - Expected: the Custom source filter shows user-added tags
  - Expected: custom tags can be deleted from the full catalog list and via selected batch actions
  - Expected: selected tags are only a temporary basket for copy/add-to-common/delete-custom actions and are not automatically sent as AI candidates
- Test `Tag Catalog` Chinese triggers
  - Expected: the No zh triggers filter exposes bridge gaps
  - Expected: trigger editing can be opened directly from a tag card
  - Expected: saved user triggers appear on the tag card
  - Expected: user triggers supplement local settings and do not overwrite the built-in bridge
- Test `Tag Catalog` candidate transparency
  - Expected: per-category AI candidate limits can be edited and persist after reload
  - Expected: help text explains matched pools, random sampling, and that the full catalog is not sent
  - Expected: after one independent prompt generation run, Last AI candidates shows the full source text and exact sent tags
- Open `Preset Adapter`
  - Expected: opens as a separate overlay, not crowded into prompt settings
  - Expected: JSON/text file upload fills the source field, and manual paste still works
  - Expected: save target can switch between Shared API, Independent API, and Both
  - Expected: text analysis does not fail because long source text is truncated too early
  - Expected: generated drafts require explicit save and do not overwrite the current preset automatically
  - Expected: switching targets does not accidentally inject a built-in preset into the draft area
  - Expected: Shared API drafts preserve Conso HTML comment format and generation frequency rules; Independent API drafts only generate independent prompt-writing guidance
- Open `Character Fixed Tags`
  - Expected: overlay opens and existing character editor is usable
  - Expected: injection mode can be changed and persists
  - Expected: legacy prepend mode still works
  - Expected: structure-aware mode handles recognizable character sections
  - Expected: conservative multi-character mode skips injection when a flat multi-character prompt cannot be safely matched
- Use `Prompt Detection & Style`
  - Expected: fields are editable and existing reset controls still work

## 5. Standalone Generation

- Open the standalone page
  - Expected: standalone content renders in panel
- Toggle standalone context injection
  - Expected: standalone include-character-info checkbox syncs
- Toggle standalone world info injection
  - Expected: standalone include-world-info checkbox syncs
- Generate prompts in AI mode
  - Expected: prompt cards appear
- Use fullscreen text editor on a generated prompt card
  - Expected: overlay opens, text can be edited, applying updates the original card
- Use fullscreen text editor on manual prompt input
  - Expected: overlay opens, applying updates the manual prompt textarea
- Generate an image from a prompt card
  - Expected: image preview appears in card

## 6. World Book Manager

- Open `World Book Manager`
  - Expected: overlay opens
- Search world books
  - Expected: filtering works
- Expand/collapse a world book
  - Expected: entry list toggles correctly
- Enable/disable individual entries
  - Expected: changes persist for current chat

## 7. Gallery

- Open gallery page
  - Expected: existing gallery widget renders inside panel instead of floating globally
- Expand/collapse message groups
  - Expected: behaves normally
- Open image modal from gallery
  - Expected: original image viewer still works

## 8. Fullscreen Text Editor

- Open fullscreen editor for meta prompt preview/editor
  - Expected: overlay opens
- Open fullscreen editor for LLM frequency guidelines
  - Expected: overlay opens
- Open fullscreen editor for LLM prompt writing guidelines
  - Expected: overlay opens
- Open fullscreen editor for standalone prompt card
  - Expected: overlay opens
- Open fullscreen editor for Preset Adapter source text, requirements, and draft fields
  - Expected: overlay opens and textarea fills the available height without requiring manual resize
- Apply changes to editable target
  - Expected: original field updates
- Open fullscreen editor for read-only preview target
  - Expected: overlay opens in read-only mode, apply button hidden
- Check fullscreen dialog footer buttons
  - Expected: buttons remain horizontal; narrow layouts may wrap, but button text must not become vertical

## 9. Regression Checks

- Click an AI-generated image in chat
  - Expected: original image action dialog still appears
  - Expected: floating panel does not intercept or replace it
- Switch chats
  - Expected: panel remains stable
  - Expected: per-chat world info and subfolder state refresh correctly
- Generate images during streaming
  - Expected: existing progress and streaming preview systems still behave normally
- Open every overlay in one light and one dark panel theme
  - Expected: plugin-owned fields and dialogs use panel theme colors and remain readable
