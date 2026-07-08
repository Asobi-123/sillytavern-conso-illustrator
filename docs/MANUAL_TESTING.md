# Manual Testing Checklist for Feature Branch Merges

This document provides a concise checklist of critical manual tests that must be performed before merging major feature branches to `main`. These tests complement automated unit/integration tests and verify real-world functionality in the SillyTavern environment.

## Pre-Merge Requirements

Before starting manual testing:
- ✅ All automated tests pass (`npm test`)
- ✅ Linter passes (`npm run fix`)
- ✅ Build succeeds (`npm run build`)
- ✅ Extension loaded in SillyTavern without errors

## Core Feature Tests

### 1. Streaming Mode Image Generation

**Purpose**: Verify images generate during AI streaming and insert correctly after completion.

**Steps**:
1. Start a new chat with streaming enabled
2. Send a message that triggers streaming response containing image prompts
3. **Verify**: Progress widget appears and updates in real-time (e.g., 0/2 → 1/2 → 2/2)
4. **Verify**: Images generate during streaming (check console for generation logs)
5. **Verify**: Images insert correctly after `MESSAGE_RECEIVED` event fires
6. **Verify**: No duplicate images or missing images
7. **Verify**: No barrier timeout errors in console

**Expected Behavior**:
- Widget shows accurate progress without resetting (no 0/2 flicker)
- Images appear inline after their respective `img-prompt` tags
- Console shows: "Barrier resolved, inserting deferred images"

**Common Issues**:
- Barrier timeout → Check timeout value (should be 300s)
- Images missing → Check session lifecycle logs
- Progress reset → Check `addMessageProgress()` logic

---

### 2. Manual Generation (Non-Streaming)

**Purpose**: Verify manual image generation works for existing messages.

**Steps**:
1. Find a message with `img-prompt` tags but no images
2. Click the magic wand icon (manual generation button)
3. Select "Replace" or "Append" mode
4. **Verify**: Dialog shows correct prompt count
5. **Verify**: Images generate sequentially (check console)
6. **Verify**: Images insert at correct positions
7. **Verify**: Progress widget updates correctly

**Expected Behavior**:
- Button appears only on messages with prompts
- Generation respects selected mode (replace vs append)
- DOM operations serialized per message (no race conditions)

**Common Issues**:
- Button missing → Check `hasImagePrompts()` logic
- Wrong insertion position → Check index calculation
- Concurrent generation conflicts → Check DOM queue serialization

---

### 3. Image Regeneration (Click to Regenerate)

**Purpose**: Verify clicking an existing image regenerates it correctly.

**Steps**:
1. Click on an AI-generated image
2. Select regeneration mode (replace or append)
3. **Verify**: Dialog appears with correct prompt info
4. **Verify**: New image generates
5. **Verify**: Image inserts correctly based on mode:
   - **Replace**: Old image removed, new image in same position
   - **Append**: Old image kept, new image added with "(Regenerated N)" suffix
6. **Verify**: Multiple regenerations increment counter correctly

**Expected Behavior**:
- Click handler only on images with `title^="AI generated image"`
- Regenerated images have proper titles (e.g., "AI generated image #2 (Regenerated 3)")
- DOM updates are atomic (no partial states visible)

**Common Issues**:
- Click handler missing → Check `addImageClickHandlers()` call
- Wrong image replaced → Check image index calculation
- Counter wrong → Check `countRegeneratedImages()` logic

---

### 4. Concurrency Control

**Purpose**: Verify multiple image generations don't exceed concurrency limit.

**Steps**:
1. Configure `maxConcurrentGenerations` to a low value (e.g., 2)
2. Trigger generation of 5+ images (streaming or manual)
3. **Verify**: Console logs show max 2 concurrent generations
4. **Verify**: Remaining images queue and process sequentially
5. **Verify**: All images eventually complete
6. **Verify**: No duplicate generation attempts

**Expected Behavior**:
- Bottleneck queue limits concurrency
- Console shows: "Waiting for slot in generation queue"
- Progress widget reflects total count, not concurrent count

**Common Issues**:
- Concurrent limit ignored → Check Bottleneck configuration
- Queue stalls → Check processor trigger logic
- Duplicate generations → Check queue deduplication

---

### 5. Session Management & Multiple Concurrent Sessions

**Purpose**: Verify proper session management with multiple concurrent streaming messages.

**Steps**:
1. Start streaming message N with image generation
2. **While message N is streaming**, send message N+2
3. **Verify**: Both sessions run concurrently without interfering
4. **Verify**: Progress widgets show both messages (e.g., "2 messages")
5. **Verify**: Message N completes and inserts its images correctly
6. **Verify**: Message N+2 completes and inserts its images correctly
7. **Verify**: No images from wrong sessions insert
8. **Verify**: Console shows session count increasing/decreasing correctly

**Additional Test - Session Cleanup**:
1. Start streaming with active sessions
2. Change chat or trigger CHAT_CHANGED event
3. **Verify**: All active sessions cancel cleanly
4. **Verify**: Console shows: "Cancelling N active streaming sessions"
5. **Verify**: No orphaned sessions remain

**Expected Behavior**:
- Multiple sessions can run concurrently (one per message)
- Each session has independent queue, monitor, processor, and barrier
- Sessions identified by messageId
- Image generation globally rate-limited via Bottleneck
- Chat changes cancel all sessions

**Common Issues**:
- Sessions interfere with each other → Check session isolation
- Images insert in wrong message → Check messageId validation
- Memory leak with many sessions → Check session cleanup
- Duplicate session for same message → Check startSession() logic

---

### 6. Error Handling & Recovery

**Purpose**: Verify graceful degradation when generation fails.

**Steps**:
1. **Simulate SD command failure** (disconnect image gen backend)
2. Trigger image generation
3. **Verify**: Error toast appears with clear message
4. **Verify**: Progress widget shows partial completion
5. **Verify**: Extension remains functional
6. **Verify**: Prompt tags remain in text (not removed)
7. **Verify**: Subsequent generations work after backend reconnects

**Expected Behavior**:
- Failed generations logged as warnings, not crashes
- User sees informative error messages
- Extension doesn't enter broken state

**Common Issues**:
- Extension crashes → Check error boundaries
- No error feedback → Check toast notifications
- Prompt tags removed → Check error handling in processor

---

### 7. Settings Persistence & UI

**Purpose**: Verify settings save/load correctly and UI updates properly.

**Steps**:
1. Open extension settings
2. In a fresh profile or after clearing extension settings, **Verify**: the streaming preview widget setting is disabled by default
3. Enable the streaming preview widget manually
4. Change multiple settings (timeouts, concurrency, patterns, etc.)
5. Click "Save"
6. **Verify**: Toast confirms save
7. Reload page
8. **Verify**: Settings persist across reload
9. **Verify**: Changed settings take effect immediately

**Expected Behavior**:
- All settings have change event listeners
- Settings stored in chat metadata
- UI reflects current values on load
- New installs do not show the streaming preview widget until the user enables it

**Common Issues**:
- Settings don't persist → Check event listener registration
- UI doesn't update → Check input value binding
- Changes not applied → Check settings reload in components

---

### 8. Progress Widget Behavior

**Purpose**: Verify global progress widget displays and updates correctly.

**Steps**:
1. Trigger generation on multiple messages simultaneously
2. **Verify**: Widget shows combined progress (e.g., "2 messages")
3. **Verify**: Individual message progress updates correctly
4. **Verify**: Widget auto-hides when all complete
5. **Verify**: Widget persists across page sections (doesn't disappear on scroll)
6. **Verify**: Widget doesn't block chat input

**Expected Behavior**:
- Widget shows aggregate progress across all active generations
- Auto-removes messages when complete
- Positioned correctly (bottom-right, not blocking UI)

**Common Issues**:
- Widget flickers → Check update batching
- Wrong count → Check message progress map
- Doesn't hide → Check cleanup logic

---

## Performance Tests

### 9. Long Streaming Messages

**Purpose**: Verify performance with many prompts in single message.

**Steps**:
1. Stream a message with 10+ image prompts
2. **Verify**: Monitor doesn't miss prompts
3. **Verify**: All prompts detected and queued
4. **Verify**: Progress widget updates smoothly
5. **Verify**: Memory usage stays reasonable (check DevTools)
6. **Verify**: No UI freezes or lag

**Expected Behavior**:
- Monitor detects all prompts via polling
- Processor handles queue efficiently
- UI remains responsive

---

### 10. Rapid Message Changes

**Purpose**: Verify session handling with fast message succession.

**Steps**:
1. Rapidly send 5+ messages while previous ones are streaming
2. **Verify**: All sessions run concurrently without errors
3. **Verify**: Each message gets its own progress widget
4. **Verify**: Images insert in correct messages
5. **Verify**: No errors in console
6. **Verify**: All sessions complete successfully
7. **Verify**: Memory usage remains reasonable

**Expected Behavior**:
- SessionManager maintains multiple concurrent sessions
- Each message identified by messageId
- DOM queue prevents race conditions within each message
- No memory leaks from concurrent sessions
- All messages receive their respective images

---

## Edge Cases

### 11. Floating Panel Dashboard and Managed Regex

**Purpose**: Verify the main floating-panel card order and the managed SillyTavern Regex prompt filters.

**Steps**:
1. Open the floating panel and go to the main dashboard
2. **Verify**: tab order is Main → Prompt Settings → Vibe Manager → Gallery → Standalone → Prompt Library
3. **Verify**: card order is Start Illustration → Prompt Generation Mode → Current Chat → Regex → Randomize SD Style → Vibe Transfer → Panel Theme → Info
4. **Verify**: the Regex card is collapsed by default
5. Expand **Regex**
6. **Verify**: the three built-in rules are installed and enabled by default: `img-prompt`, `auto-illustrator`, and `img tag`
7. Toggle the master switch and each individual rule
8. **Verify**: enable/disable state persists after page refresh
9. Click **Sync to ST Regex**
10. Refresh the page and open the native SillyTavern Regex panel
11. **Verify**: the managed rules appear in the native list after refresh
12. **Verify**: managed rules use outgoing-prompt filtering, user/AI output placements, `minDepth: 0`, and do not delete metadata from chat text

**Expected Behavior**:
- Conso manages only its three known Regex scripts by stable IDs
- Manual sync refreshes built-in template fields while preserving current enable/disable state
- Chat text keeps illustration metadata; only prompts sent to the model are filtered
- If the native Regex extension is disabled, the Conso Regex card shows a disabled status instead of silently changing state

---

### 12. Generation SD Style and Vibe Combination

**Purpose**: Verify fixed/random per-generation SD Style and Vibe combination selection.

**Steps**:
1. Open the floating panel main dashboard and expand **Generation SD Style and Vibe combination**
2. Select **Fixed**
3. Pick one SD Style and one saved Vibe combination
4. Generate one chat image and one standalone image
5. **Verify**: both generations use the selected SD Style / Vibe combination and show the selected names in image metadata surfaces
6. Select **Random**
7. Expand the SD Style and Vibe combination pools
8. Tick two or more entries in each pool, then generate several images
9. **Verify**: generation randomly picks from the eligible pools; unticked entries are not picked
10. Clear all pool selections
11. **Verify**: empty pool selection means all available entries are eligible
12. Save a named SD Style + Vibe pairing, then save another with the same name
13. **Verify**: Save As creates a new preset with a unique suffix instead of overwriting

**Expected Behavior**:
- Fixed mode applies one explicit pairing without changing the Vibe Manager selection permanently
- Random mode records which SD Style / Vibe combination was used for each generated image
- SD Style apply/restore remains serialized so concurrent generations do not corrupt SillyTavern SD settings

---

### 13. Vibe Bundle Manager

**Purpose**: Verify Vibe Transfer library management, bundle interoperability, parameter modes, and mobile layout.

**Steps**:
1. Open the floating panel and go to **Vibe Manager**
2. Upload one reference image
3. **Verify**: the library switches to the built-in Pending encoding group and shows the source-image item with preview, name, tags, enable switch, and encoding status; the new item is not enabled automatically
4. Import a `.naiv4vibebundle.json` file
5. **Verify**: encoded-only items are added without overwriting existing items
6. Search by Vibe name and tag
7. **Verify**: filtering and empty-state messaging work
8. Switch between Display mode and Edit mode in Vibe Manager
9. **Verify**: Display mode shows each card's saved Strength / Information values read-only, while Edit mode exposes per-card sliders without changing the selected Vibe set
10. **Verify**: encoded-only items show imported information extraction without offering false re-encoding controls
11. Save the current enabled set with **Save As**
12. **Verify**: a new set is created; existing sets are not overwritten
13. Select a saved set and use **Overwrite set**
14. **Verify**: overwrite requires confirmation and updates only the selected set
15. Generate with one source-image Vibe and one encoded-only Vibe enabled
16. **Verify**: the advanced backend route accepts the mixed payload
17. Generate with one enabled pending source-image Vibe
18. **Verify**: after generation stores the encoding cache, the Pending encoding view and cache details refresh without switching Vibe groups
19. Export a bundle
20. **Verify**: the exported `.naiv4vibebundle.json` contains encoded Vibes only and does not include local source/preview images or local search tags
21. Use a narrow viewport or mobile browser
22. **Verify**: Vibe cards use a single-column readable layout, action buttons wrap horizontally, slider rows stay full-width, and the list scrolls inside the panel

**Expected Behavior**:
- Imported bundle items work without source images
- Existing source-image Vibes keep working and can be mixed with encoded-only items
- Import creates new local items instead of overwriting existing library entries
- Export is interoperable encoded data, not a Conso-private backup of local previews
- Mobile layout does not overlap content or create vertical button text
- Cache status updates immediately after a source-image Vibe is encoded

---

### 14. Prompt Personalization Suite

**Purpose**: Verify Tag Catalog, Preset Adapter, and Character Fixed Tags injection modes work without breaking the base prompt generation flow.

**Steps**:
1. Open the floating panel and go to Prompt Settings
2. Open **Tag Catalog**
3. **Verify**: catalog total/counts render, search/filter/page controls work, and the list scrolls
4. Use a narrow viewport or mobile browser
5. **Verify**: search, category, and source controls stay in one compact row
6. **Verify**: AI candidate count, Last AI candidates, bridge settings, and custom tags are grouped inside one assist panel with visually distinct inner collapsibles
7. Add a custom tag under an existing category
8. **Verify**: duplicate custom tags are skipped, custom tags can be filtered, and custom entries can be deleted
9. Add a Chinese trigger for one catalog tag
10. **Verify**: user trigger appears on the tag card and does not replace built-in triggers
11. Run one independent prompt generation or standalone prompt generation
12. **Verify**: Last AI candidates shows the full source text and exact candidate tags sent
13. Open **Preset Adapter**
14. Upload or paste JSON/text-like preset content, choose Shared API, Independent API, and Both targets
15. **Verify**: generated drafts require explicit save and target switching does not overwrite drafts unexpectedly
16. Open **Character Fixed Tags** and switch injection modes
17. **Verify**: legacy mode remains available, structure-aware mode handles recognizable role sections, and conservative multi-character mode skips unsafe flat prompts
18. **Verify**: buttons stay horizontal and all related overlays remain readable in one light and one dark panel theme

**Expected Behavior**:
- Runtime tag catalog usage does not fetch network resources
- Full catalog is browsable through pagination and filters
- Mobile Tag Catalog leaves most vertical space for tag browsing
- AI candidates are a matched, limited subset, not the full catalog
- User triggers supplement the bridge without overwriting built-in bridge data
- Preset Adapter creates Conso-native drafts for the selected target only
- Character Fixed Tags do not overwrite the wrong character in unsafe multi-character prompts

---

### 14. Empty/Malformed Prompts

**Purpose**: Verify robustness against edge cases.

**Test Cases**:
- Empty prompt: `<!--img-prompt=""-->`
- Special characters: `<!--img-prompt="test \"quoted\" & <tags>"-->`
- Very long prompt: 1000+ character prompt
- Unicode: Emoji and Chinese characters in prompts
- Malformed tags: `<img-prompt="missing close`, `<!--img-prompt=no-quotes-->`

**Expected Behavior**:
- Empty prompts ignored gracefully
- Special chars don't break parsing
- Long prompts truncated with warning
- Unicode handled correctly
- Malformed tags ignored, error logged

---

### 15. Barrier Timeout Scenario

**Purpose**: Verify timeout handling when MESSAGE_RECEIVED is delayed.

**Steps**:
1. Temporarily set barrier timeout to 5s (for testing)
2. Start streaming with image generation
3. **Simulate slow response** (takes >5s)
4. **Verify**: Barrier times out with clear error
5. **Verify**: Session ends gracefully
6. **Verify**: Extension remains functional
7. Restore timeout to 300s

**Expected Behavior**:
- Timeout error logged clearly
- Images not inserted (avoids partial state)
- Extension recovers for next message

---

## Browser Compatibility

### 16. Cross-Browser Check

**Quick smoke test** in each supported browser:
- ✅ Chrome/Edge (Chromium)
- ✅ Firefox
- ✅ Safari (if macOS available)

**Verify**:
- Extension loads without errors
- Basic streaming generation works
- Settings UI renders correctly

---

## Test Completion Checklist

Before merging feature branch to `main`:

- [ ] All 16 test scenarios passed
- [ ] No errors or warnings in browser console
- [ ] Performance acceptable (no freezes/lag)
- [ ] Error messages user-friendly
- [ ] Settings persist correctly
- [ ] All TODO comments addressed or documented
- [ ] CHANGELOG.md updated with user-facing changes
- [ ] Commit messages follow conventional commits format

---

## Reporting Issues

If manual testing reveals issues:

1. **Do not merge** until resolved
2. Document the issue:
   - Steps to reproduce
   - Expected vs actual behavior
   - Browser/environment details
   - Console errors/logs
3. Create GitHub issue or add to existing tracking issue
4. Fix issue on feature branch
5. Re-run affected manual tests

---

## Notes

- **Time estimate**: 30-45 minutes for full manual test suite
- **Priority**: Tests 1-8 and 11 are critical; 9-10 and 12-15 are important but can be quick checks
- **Automation goal**: Eventually automate some of these with E2E tests (Playwright/Puppeteer)
- **Update this doc**: Add new tests when new major features are added
