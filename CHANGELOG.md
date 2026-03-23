# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.6.0] - 2026-03-24

### Added

- **Floating panel UI** - Added a new floating workbench with four top-level pages: Main, Prompt Settings, Gallery, and Standalone Generation. The panel reuses the extension's existing controls instead of duplicating settings logic.
- **Panel themes** - Added multiple built-in panel theme presets, including both dark and light palettes, with live switching from the main dashboard.
- **Fullscreen text editor** - Added fullscreen editing/preview for long text areas used by meta prompts, independent API guideline text, and standalone prompt cards.
- **Drawer fallback entry** - Added a settings-page button to reopen the floating panel even when the floating launcher icon is hidden.

### Changed

- **Version and tutorial moved to main dashboard** - Version status and tutorial link now live in the floating panel's main dashboard instead of the old drawer header.
- **Launcher behavior** - The floating panel now starts closed by default. The launcher icon is smaller, draggable, and can be hidden entirely via settings.
- **Prompt settings layout** - Independent API mode is now split into clearer submodules (base parameters, context injection, world info injection, guideline presets, and independent LLM API) to reduce visual clutter.
- **Standalone page layout** - Standalone generation now uses a more workbench-like structure with clearer action groups and inline result previews.

### Fixed

- **Character Fixed Tags participant refresh** - Switching from one character chat to another no longer leaves the previous persona name in the auto-detected Character Fixed Tags list. The panel now retries participant refreshes after chat changes to pick up late-updating `name1` values.
- **Standalone injection toggle semantics** - The standalone page's context/world toggles now control standalone-specific include options instead of incorrectly mutating the independent API mode's global injection toggles.
- **Theme consistency in overlays** - Light themes now correctly apply to overlay panels, secondary cards, switches, and text fields instead of leaving dark hardcoded surfaces behind.

## [1.5.2] - 2026-03-22

### Fixed

- **Multi-line TEXT parsing** — Independent LLM prompt parser now supports multi-line TEXT fields. Complex prompt structures (e.g. Scene/Character/UC sections on separate lines) are now correctly captured instead of only the first line. Falls back to single-line capture for backward compatibility.

## [1.5.1] - 2026-03-21

### Changed

- **README restructured** — Beginner-friendly layout with usage flow, feature overview tables, and two-mode comparison. Separated into English (README.md) and Chinese (README_CN.md) versions
- **Beginner tutorial added** — New `docs/QUICKSTART_CN.md`: step-by-step guide from configuring NovelAI in SillyTavern to generating images, with recommended parameters and screenshots
- **Tutorial link in settings panel** — Added a "Tutorial" button next to the version display that links to the quickstart guide

## [1.5.0] - 2026-03-21

### Added

- **Standalone Generation Workbench** - New independent image generation panel, available as the first feature in the settings drawer list. Two modes:
  - **AI Generation Mode**: Enter a scene description → LLM generates multiple prompt suggestions → edit and generate images individually or in batch ("Auto Generate" one-click flow)
  - **Manual Input Mode**: Directly enter NovelAI prompts and generate images without LLM involvement
  - Configurable prompt count (1-10), character info injection toggle, world info injection toggle
  - Dedicated storage folder (`/images/auto_illustrator_standalone/` or `/images/auto_illustrator_standalone_{label}/`) — completely separate from per-chat character folders
  - Character fixed tags and common style tags are automatically applied to all standalone prompts
  - Works in both Shared API mode (via `generateRaw`) and Independent API mode (via configured LLM)

### Fixed

- **Standalone injection independence** - Standalone generation's "Include Character Info" and "Include World Info" checkboxes now work independently of the Independent API mode's injection toggles. Previously, world info injection silently failed in Shared API mode because `settings.injectWorldInfo` defaulted to `false`.
- **API routing respects prompt generation mode** - Standalone generation now correctly uses `context.generateRaw()` (SillyTavern's main API) when in Shared API mode. Previously it always used the independent LLM API if configured, regardless of the user's mode selection.

### Changed

- **Settings drawer order** - Reorganized second-level drawer order for better workflow: Prompt Generation Mode → Meta Prompt & Display → Prompt Detection & Style → Standalone Generation → Character Fixed Tags → Generation Performance → Image Cleanup → Widget Visibility → Log Level

## [1.4.0] - 2026-03-21

### Added

- **Character Fixed Tag Injection** - Lock visual appearance tags per character. Each character's tags are wrapped in `{}` for multi-character scene isolation (e.g. `{lu zhiwei, girl, orange long hair}, {shen geye, boy, yellow short hair}`). Smart injection only triggers when the character's name appears in the story text and the prompt contains person-indicator tags. Supports name aliases (case-insensitive), auto-detection of chat participants, manual NPC addition (per-chat), and per-character enable/disable toggle. Settings panel available under "Character Fixed Tags" drawer in Independent API mode.

### Fixed

- **Common tags breaking character tag groups** - Fixed `applyCommonTags()` splitting `{}`-wrapped character tag groups by comma. Character groups are now extracted and preserved intact before common tag processing.

## [1.3.1] - 2026-03-20

### Added

- **API Profile Save/Switch** - Save and switch between independent LLM API configurations (URL, key, model, max tokens). Profiles can be created, selected, and deleted from a dropdown in the independent LLM settings section.
- **Collapsible Settings Sections** - Settings panel now organized into collapsible accordion sections (Meta Prompt & Display, Generation Performance, Prompt Detection & Style, Prompt Generation Mode, Image Cleanup, Widget Visibility, Log Level) for a cleaner UI.
- **Version Display & Update Check** - Version number displayed at the top of the settings panel with automatic GitHub release check. Shows "Latest" or a link to the new version when an update is available.

### Changed

- **Independent API Call** label no longer shows experimental/warning icon.

## [1.3.0] - 2026-03-20

### Added

- **World Info Injection** - Inject selected world book entries into independent LLM context. Features include: plugin-independent toggle (does not affect SillyTavern's world info), per-chat configuration, cross-character world book selection, search & filter for books and entries, auto-initialization with character-bound world book, and select all/deselect all bulk actions.

## [1.2.0] - 2026-03-19

### Added

- **Independent LLM Guidelines Preset Management** - Preset system for frequency guidelines and prompt writing guidelines in independent API mode. Save, switch, and manage custom presets just like meta prompt presets in shared API mode.

### Fixed

- **Streaming Preview Checkbox** - Fixed first untick of streaming preview checkbox not persisting on page refresh. Root cause: default settings were not written to extensionSettings on fresh install.
- **Main API Error Triggering Independent LLM** - Fixed independent LLM still running when main API errors produce empty messages. Empty/whitespace-only messages are now skipped.

## [1.1.0] - 2026-03-19

### Added

- **Character Card Context Injection** - Three new checkboxes (all enabled by default) to inject character description/personality, user persona, and scenario from SillyTavern character cards into the independent LLM prompt. The LLM now has direct access to character appearance details, user persona, and scene setting for more accurate image prompts.
- **Content Filter Tags** - New textarea setting allowing users to specify HTML tags to strip from messages before sending to the LLM (default: `style`, `script`). Enter one tag name per line; the plugin automatically removes matching tag blocks (e.g., `<status>...</status>`).
- **Enhanced CSS Noise Cleaning** - Built-in automatic removal of `@keyframes`, `@media` query blocks, and CSS selector rule blocks from message text, reducing token waste in LLM context.

### Changed

- **System Prompt Updated** - The independent LLM system prompt now references the new `=== CHARACTER INFO ===` section as the primary source for character appearances.

### Fixed

- **Character Name Display** - Fixed character name showing "SillyTavern System" in injected context by reading fresh context state instead of stale cached values.

## [1.0.1] - 2026-03-19

### Added

- **Independent LLM Request Viewer** - New "View Last Request" button in independent LLM settings that shows a read-only snapshot of the most recent API request, including final URL, model, messages (system/user), temperature, max tokens, and whether an Authorization header was present. Useful for verifying that character definitions, world info, and context actually reached the independent LLM.

### Fixed

- **Prompt Update Fallback** - Fixed prompt update (AI refinement) crashing when the independent LLM toggle was enabled but URL or model was not configured. Now gracefully falls back to SillyTavern's shared API when independent LLM config is incomplete, and only errors when both paths are unavailable.
- **Append Mode After Prompt Update** - Fixed "Update Prompt → regenerate" always forcing replace mode. The post-update regeneration dialog now correctly asks the user to choose between Replace and Append, preserving existing images when Append is selected. Cancelling the dialog keeps the updated prompt without triggering any regeneration.

### Fixed

- **Image Click Handlers (Race Condition + Selector Bug + HTML Encoding)** - Fixed critical bug where click handlers failed to attach to images, especially failed generation placeholders
  - Root cause #1: Race condition between `renderMessageUpdate()` and `attachRegenerationHandlers()` - handlers were attached before DOM was ready
  - Root cause #2: CSS selector failure with data URIs containing `#` fragment identifiers - `querySelector('img[src="data:...#promptId=..."]')` fails due to invalid CSS syntax
  - Root cause #3: HTML entity encoding mismatch - message text has `&amp;` but browser's `img.src` has decoded `&`, causing comparison to fail
  - Symptom #1: `querySelector('.mes[mesid="..."]')` returned `null` because DOM update hadn't completed yet, causing all handler attachment to fail
  - Symptom #2: Failed placeholder images (data URIs with fragments) could not be found in DOM even when present
  - Symptom #3: Even after finding images, comparison failed due to `&amp;` vs `&` mismatch
  - Affected scenarios: Direct image insertion, reconciled images, failed placeholders, image deletion, and prompt updates
  - Solution #1: Use event-driven approach - listen for MESSAGE_UPDATED event before attaching handlers, guaranteeing DOM is ready
  - Solution #2: Replace CSS selector with iteration - query all images and compare `src` attributes directly instead of using CSS selector
  - Solution #3: HTML-decode src before comparison - decode `&amp;` → `&`, `&lt;` → `<`, etc. to match browser's decoded version
  - Implementation #1: `context.eventSource.once(MESSAGE_UPDATED, () => attachRegenerationHandlers(...))` before calling `renderMessageUpdate()`
  - Implementation #2: `messageEl.querySelectorAll('img')` → iterate → compare `candidate.src === imgSrc`
  - Implementation #3: Centralized HTML encode/decode utilities in `src/utils/dom_utils.ts` - `htmlEncode()` and `htmlDecode()` functions
  - Refactored: Replaced scattered inline HTML encoding/decoding with centralized utilities
  - Fixed in: `image_generator.ts`, `message_handler.ts`, `session_manager.ts`, `manual_generation.ts`, `reconciliation.ts`, `utils/dom_utils.ts`
  - Impact: ALL images now reliably receive click handlers, including reconciled and failed placeholder images
  - Code quality: Eliminated code duplication, consistent HTML handling across codebase
- **Image Regeneration Failed to Insert** - Fixed bug where regenerated images couldn't be inserted/replaced in message text
  - Root cause: Same HTML encoding mismatch - `targetUrl` (decoded `&`) didn't match message text (encoded `&amp;`)
  - The regex pattern for finding/replacing images never matched because URLs weren't HTML-encoded before pattern creation
  - Solution: HTML-encode `targetUrl` with `htmlEncode()` before creating regex pattern
  - Fixed in: `image_generator.ts` lines 375-438 (both `replace-image` and `append-after-image` modes)
  - Added enhanced debug logging to diagnose URL matching issues
  - Impact: Regenerated images (including retry of failed placeholders) now successfully replace/append to messages
- **Image Deletion Failed** - Fixed bug where images (especially failed placeholders) couldn't be deleted
  - Root cause: Same HTML encoding mismatch - deletion logic used raw URL but message text has HTML-encoded version
  - The `includes()` check and regex replacement both failed due to encoding mismatch
  - Solution: HTML-encode normalized URL before searching message text
  - Fixed in: `manual_generation.ts` `deleteImage()` function (lines 497-549)
  - Added debug logging for deletion failures
  - Impact: All images can now be successfully deleted, including failed placeholders with data URIs
- **Failed Placeholder Size Too Large** - Fixed bug where failed generation placeholder images displayed at full width (100% or user's imageDisplayWidth setting) instead of remaining small error indicators
  - Root cause: `createImageTag()` in reconciliation.ts applied `displayWidth` to ALL images including failed placeholders
  - Secondary issue: `applyImageWidthToAllImages()` in index.ts updated ALL images when settings changed, overriding placeholder width
  - Solution #1: Set `effectiveWidth = isFailed ? 10 : displayWidth` to use 10% width for failed placeholders
  - Solution #2: Skip failed placeholders in `applyImageWidthToAllImages()` by checking for `data-failed-placeholder="true"` attribute
  - Fixed in: `reconciliation.ts` createImageTag() (lines 441-442), `index.ts` applyImageWidthToAllImages() (lines 404-407)
  - Impact: Failed placeholders now display as small (10% width) error indicators and maintain this size even when user changes imageDisplayWidth setting

### Changed

- **Gallery Widget** - Gallery widget now starts minimized by default for new chats to reduce distraction
  - Gallery will no longer auto-expand during image generation
  - User must manually click the FAB (floating action button) to expand and view images
  - Once expanded in a chat, the expanded state persists for that specific chat
  - Switching to a new/different chat will show the gallery minimized again
  - Gallery still auto-updates when expanded (new images appear automatically)

### Fixed

- **Duplicate Image Generation** - Fixed critical bug where 4 prompts generated 8 images (duplicate generation)
  - Root cause #1: Race condition in session creation - multiple concurrent `startStreamingSession()` calls created separate sessions for the same message
  - Root cause #2: Event handlers registered multiple times without cleanup - duplicate event listeners caused duplicate processing
  - Solution #1: Add session to map IMMEDIATELY (before async operations) to prevent race condition
  - Solution #2: Add registration flag to prevent duplicate event listener registration
  - Added comprehensive test for concurrent session creation to prevent regression
  - Each prompt now generates exactly one image as expected
- **Image Click Handlers** - Fixed bug where clicking images stopped working after adjusting image display width
  - Root cause: Manual DOM manipulation with `printMessages()` doesn't trigger proper event flow for handler attachment
  - Solution: Use `context.reloadCurrentChat()` to reload chat after saving width changes, which triggers the full MESSAGE_UPDATED event flow
  - Implementation: `applyImageWidthToAllImages()` → `saveChat()` → `reloadCurrentChat()`
  - Critical: Must save chat BEFORE reloading, otherwise reload loads old HTML without width changes
  - Images are now clickable immediately after width changes (chat reloads automatically)
  - Applies to both modal viewer and click-to-regenerate functionality
- **Image Alignment** - Fixed visual alignment issue where smaller images appeared in bottom-left position
  - Root cause: No centering styles applied to generated images
  - Solution: Added inline centering styles (`margin: 8px auto; display: block;`) during image generation
  - Styles applied in `reconciliation.ts` when generating image HTML
  - Small images (e.g., 50% width) now centered in message container
  - Large images (100% width) continue to take full width as before
- **Progress Widget** - Fixed bug where progress widget would appear prematurely for existing messages (issue #76)
  - Root cause: `progress:started` event was emitted immediately when `registerTask(messageId, 0)` was called during streaming initialization, even before any actual image prompts were detected
  - Solution: Defer `progress:started` emission until first actual tasks are registered (when `total > 0`)
  - Modified `ProgressManager.registerTask()` to skip event emission when `incrementBy=0`
  - Modified `ProgressManager.updateTotal()` to emit `progress:started` when transitioning from `total=0` to `total>0`
  - Progress widget now only appears when image generation actually begins, not on chat/character entry

### Added

- **Image Display Width Control** - Added global setting to control display width of generated images in chat (10-100%)
  - Configurable via slider in extension settings (default: 100%)
  - Changes apply retroactively to all existing images in chat
  - Maintains responsive behavior with `max-width: 100%` to prevent overflow on small screens
  - Smooth CSS transitions for width changes
  - Only affects inline images in chat (modal viewer remains full-size)

### Fixed

- **Placeholder Images** - Fixed bug where only one placeholder image would be inserted when multiple image generations failed
  - Root cause: Idempotency check was incorrectly deduplicating placeholders by shared URL
  - Solution: Generate unique placeholder URLs by appending prompt ID and timestamp as fragment identifier
  - Each failed generation now gets its own placeholder that users can click to retry
  - Supports multiple regeneration attempts for same prompt (each failure gets separate placeholder)
  - Backward compatible: detection logic handles both old (shared URL) and new (unique URL) formats

### Changed

- **Architecture** - Centralized CHAT_CHANGED event handling to prevent race conditions and ensure proper execution order
  - Created dedicated `chat_changed_handler` module that owns single CHAT_CHANGED event listener
  - Extracted chat change operations into `chat_change_operations` module to avoid circular dependencies
  - Removed 4 duplicate CHAT_CHANGED handlers (were in `index.ts` x2, `gallery_widget.ts`, `metadata.ts`)
  - Unified metadata access through `getMetadata()` singleton pattern across all modules including gallery widget
  - Execution order now guaranteed: 1) reload metadata → 2) cancel sessions → 3) clear state/reload settings → 4) reload gallery
- **Metadata Management** - Implemented cached metadata pattern with automatic invalidation on CHAT_CHANGED event
- **Prompt Manager** - All mutation functions now async with automatic metadata saving (breaks API compatibility)
  - `registerPrompt()`, `linkImageToPrompt()`, `deletePromptNode()`, `refinePrompt()`, etc. now require `await`
  - Eliminates manual `saveMetadata()` calls and prevents data loss
  - See `docs/AUTO_SAVE_MIGRATION_GUIDE.md` for migration steps

### Added

- **Module** - New `chat_changed_handler.ts` for centralized CHAT_CHANGED event orchestration
- **Module** - New `chat_change_operations.ts` for UI/settings operations on chat change (decoupled from main module)
- **Type** - Added `GalleryWidgetState` interface and `messageOrder` property for gallery widget metadata
- **Documentation** - Comprehensive guide to chatMetadata lifecycle (`docs/CHAT_METADATA_LIFECYCLE.md`)
- **Documentation** - Auto-save migration guide (`docs/AUTO_SAVE_MIGRATION_GUIDE.md`)

### Fixed

- **Race Conditions** - Gallery widget no longer directly accesses `context.chatMetadata`, uses `getMetadata()` to avoid stale references
- **Event Handler Order** - Chat change operations now execute in guaranteed sequential order, preventing inconsistent state
- **Meta-prompt Injection Logic** - Reverted explicit generation type requirement, restoring default to 'normal' for better compatibility with various generation modes

## [1.5.0] - 2025-10-17

### Added

- **Meta Prompt Depth Setting** - New setting to control where the meta prompt is inserted in chat history for shared API mode (depth=0: last position, depth=1: one before last, etc.)
- **Separate LLM Call for Prompt Generation** (#32)
  - New opt-in "Independent API Call" prompt generation mode (default remains "Shared API Call")
  - Prevents prompt generation from influencing main text response quality
  - Context-based insertion using text snippets instead of byte offsets
  - Context awareness: LLM considers previous messages for better understanding of characters, settings, and situations
  - Automatic chat history cleanup (removes prompt tags from future AI calls in Independent API mode)
  - Cost control setting: max prompts per message (default: 5)
  - Customizable guidelines for prompt frequency and writing style
  - Plain text delimiter format for robust LLM output parsing
  - Preserves prompt tags in message HTML for feature compatibility (regeneration, gallery)
  - Clear UI warnings about token cost implications (+1 API call per message in Independent API mode)
  - Debug logging for monitoring LLM prompts and showing what blocks are skipped
  - Comprehensive implementation plan document (`docs/IMPLEMENTATION_PLAN_ISSUE_32.md`)

## [1.4.0] - 2025-10-15

### Added

- **Image Rotation Feature**

  - Rotate button in modal viewer (90° clockwise increments)
  - Rotation persists across modal reopening within same session
  - Rotation-aware fullscreen and image fitting
  - Automatic dimension-swap for portrait↔landscape transitions
  - Works seamlessly with zoom, pan, and fullscreen features

- **Tap Navigation for Mobile**

  - Tap left/right side of image to navigate between images
  - Visual tap indicators with ripple animation
  - Automatically disabled when image is zoomed (panning takes priority)
  - Complements existing swipe navigation

- **View All Images Button**

  - Added to regeneration dialog (alongside Generate/Update Prompt/Delete/Cancel)
  - Opens global image viewer starting from the clicked image
  - Collects all AI-generated images from all messages in chronological order
  - Allows browsing through entire chat's image collection from any starting point
  - Shared utility functions reduce code duplication across modules

- **Fullscreen Enhancements**

  - Tap center of image to toggle fullscreen on mobile devices
  - Immersive fullscreen mode with screen rotation lock support
  - Icon-only action buttons on mobile for maximum screen space
  - Improved visual feedback for fullscreen transitions

- **Gallery Widget Improvements**
  - Message order toggle button (newest-first ⇄ oldest-first)
  - Smart DOM updates prevent duplicate elements and visual disruption
  - Automatically refreshes when images are added/edited (MESSAGE_EDITED event)
  - Reduced code duplication with shared image extraction utilities

### Fixed

- **Modal Viewer Fixes**

  - Keyboard shortcuts no longer trigger unintended SillyTavern actions
  - Text input fields now properly accept keyboard input during modal viewer
  - Correct image fitting and positioning for rotated images in fullscreen
  - Removed conflicting double-click/tap-to-zoom feature (conflicts with tap navigation)
  - Hidden "swipe to navigate" hint text (tap navigation is now primary on mobile)

- **Metadata & Context Management**

  - PromptRegistry now persists correctly after inserting images
  - Image URL normalization ensures consistent prompt lookups
  - Always fetch fresh context from SillyTavern (eliminates stale data issues)

- **Progress Widget Fixes**

  - Widget state properly cleared when switching between chats
  - No more DOM disruption during real-time updates

- **Image Generation**
  - Fixed support for manual image generation when streaming mode is disabled
  - Event-driven session finalization (eliminates race conditions from idle timer)
  - Improved reliability for click-to-regenerate dialog

### Changed

- **Architecture Improvements** (Internal)
  - Unified streaming and regeneration into single generation pipeline
  - Removed \_v2 suffixes from all modules (migration complete)
  - Consolidated prompt tracking via prompt_manager.ts
  - Removed Barrier pattern in favor of explicit await conditions
  - Comprehensive test coverage for all core modules
  - Deleted obsolete files: barrier.ts, old module versions, deprecated metadata functions

## [1.3.0] - 2025-10-13

### Added

- **Permanent Gallery Widget** (#50)

  - Always-available widget for reviewing all generated images in current chat
  - Groups images by assistant message with collapsible headers and message previews
  - Minimizes to floating action button (FAB) with image count badge
  - State persistence: remembers visibility, minimization, and expanded messages per-chat
  - Located at top-right of chat area with modern glassmorphism design
  - Automatically updates when new images complete

- **Widget Visibility Controls**

  - New settings to show/hide Progress Widget and Gallery Widget independently
  - Both widgets default to enabled for backward compatibility
  - Requires page reload to take effect when changed

- **Progress Widget Enhancements**

  - **Close functionality**: Added close button (×) in widget header and for individual completed messages
  - **Two-level collapse**: Widget-level and message-level collapsing for better scalability
  - **Persistent after completion**: Widget remains visible after generation completes with manual close control
  - **Improved visual design**: Modern glassmorphism UI with gradient background and status badges
  - **Better thumbnail layout**: Thumbnails wrap to multiple rows instead of horizontal scrolling
  - **Space efficiency**: 5 messages reduce from ~2000px to ~600px height when collapsed
  - Widget stays expanded after all images finish, showing completion indicator (checkmark) and "Images Generated" title

- **Mobile Image Viewing Experience**

  - **Comprehensive zoom/pan system**: Pinch-to-zoom gesture, one-finger panning when zoomed, double-tap zoom toggle
  - **Zoom indicator**: Shows current zoom level (e.g., "150%") with auto-fade
  - **Touch-optimized controls**: Zoom centers on touch point, momentum scrolling with velocity tracking
  - **iOS-specific improvements**: Safe area support for notch/home indicator, new-tab download with long-press instruction
  - **Gesture coordination**: Swipe navigation only works at 1x zoom, panning takes over when zoomed

- **Desktop Image Viewing Experience**

  - Mouse wheel zoom (progressive 1x-3x), click-and-drag panning, double-click zoom toggle
  - Keyboard shortcuts: `+`/`=` to zoom in, `-` to zoom out, `0` to reset
  - Reset button appears when zoomed >1x to quickly return to fit
  - Hardware accelerated transforms for smooth 60fps performance

- **Image Modal Features**
  - Streaming image preview gallery: shows completed images as thumbnails (100x100px) while streaming continues
  - Click thumbnails to view full-size images with navigation (prev/next), zoom, download
  - Real-time updates: modal automatically reflects new images without needing to close/reopen
  - Navigation buttons enable dynamically as images complete
  - Keyboard navigation: Escape to close, Arrow keys for navigation
  - Displays image index, dimensions, and full prompt text

### Fixed

- **Context Caching Issues** (#34)

  - Eliminated stale context/metadata access after chat switches
  - All code now calls `SillyTavern.getContext()` when accessing chat or chatMetadata
  - Ensures extension always operates on correct chat's data after switching chats
  - Fixed in QueueProcessor, StreamingMonitor, MessageHandler, and ManualGeneration modules

- **Extension Enable/Disable**

  - Extension toggle now properly controls all functionality
  - When disabled: no event handlers registered, no widgets initialized, no automatic processing
  - User notified to reload page when toggling setting
  - Provides true on/off control

- **Gallery Widget Improvements**

  - Now visible by default for new chats (previously hidden)
  - Only appears during active chat sessions (hidden on settings/character management pages)
  - Fixed image extraction by reusing existing `extractImagePrompts()` function
  - State stored per-chat in `chat_metadata` instead of global localStorage
  - State persists with chat backups/exports

- **Progress Widget Improvements**

  - Smart DOM updates: uses differential updates instead of full rebuilds
  - Scroll position preservation: thumbnail gallery positions saved and restored
  - Image viewer state maintained: zoom and pan no longer reset during progress updates
  - Properly clears old thumbnails when regenerating same message
  - Shows cumulative count for sequential regenerations (e.g., "0/3 → 1/3 → 2/3 → 3/3")
  - Widget reappears when new streaming starts after being closed

- **Modal Viewer Refactoring**

  - Progress and gallery widgets now share unified modal implementation
  - Eliminated 597 lines of duplicate code
  - Reduced bundle size by 8 KiB (from 255 KiB to 247 KiB)
  - Both widgets automatically benefit from all mobile UX improvements

- **Desktop UI Fixes**

  - Progress widget no longer overlaps with chat input area
  - Image modal no longer overlaps with prompt area and action buttons
  - Proper flexbox layout replaces hardcoded height calculations
  - Long prompts scroll internally instead of pushing content out of viewport

- **Mobile UI Fixes**
  - Action buttons (zoom, download) now fully visible and not cut off
  - Eliminated auto-scroll when expanding prompt viewer
  - iOS safe area support for devices with notch/home indicator
  - Using dvh (dynamic viewport height) units for better browser chrome handling
  - Toast notification positioning avoids safe area overlap

### Changed

- **Logging Improvements** (#42)
  - INFO level now focuses on user-facing events only (generation complete, errors, user actions)
  - DEBUG level shows development details (40+ logs moved from INFO including session start/stop, queue operations)
  - TRACE level shows very detailed state changes (widget rendering logs moved from INFO)
  - Significantly reduced console verbosity at default INFO level

## [1.2.0] - 2025-10-11

### Added

- Multiple concurrent streaming sessions support (#43)

  - Each message now maintains its own independent streaming session
  - Sessions can run concurrently without interfering with each other
  - No more image loss when sending messages quickly
  - Progress widgets show all active messages simultaneously
  - Image generation remains globally rate-limited via Bottleneck
  - Automatic session cleanup on chat changes
  - Better UX: users see all active generations

- Phase 3: Complete streaming coordination refactor with SessionManager (#41)

  - Replaced 6 scattered module-level state variables with single SessionManager
  - Replaced manual flag-based coordination with explicit Barrier pattern
  - Simplified streaming event handlers (handleFirstStreamToken, handleMessageReceivedForStreaming, handleGenerationEnded)
  - Removed ~60 lines of complex state management code
  - Better encapsulation: all session state now in one place
  - Easier to maintain and extend

- Image loading progress indicators (#19)
  - Real-time progress widget showing "Generating images: X of N"
  - Animated spinner with visual feedback
  - Works for both streaming and manual generation
  - Automatically removed after images are inserted
  - Mobile-responsive design

### Fixed

- HTML attribute escaping for image tags to prevent XSS and rendering issues (#40)
  - Added `escapeHtmlAttr()` function to escape special characters (&, ", ') in HTML attributes
  - Applied escaping to `src`, `title`, and `alt` attributes in generated image tags
  - Prevents XSS attacks and rendering issues from malicious or special characters in image URLs/titles
- Custom prompt detection patterns now passed to `hasImagePrompts()` for consistency (#40)
- Preset deletion confirmation dialog now shows correct "Delete preset" message instead of "Overwrite preset" (#40)
- Image generation now works correctly when LLM streaming is disabled (#26)
  - Extension now auto-detects whether LLM is actually streaming at runtime
  - Automatically falls back to immediate processing when LLM streaming is off
  - Removes reliance on static `streamingEnabled` setting for determining processing mode
- Progress widget no longer shows "Message element not found" errors
  - Redesigned as global fixed-position widget above user input area
  - No longer tied to message DOM elements (eliminates timing issues)
  - Shows progress for all messages with message ID context
  - Always visible and accessible regardless of scroll position
  - Works reliably in all modes (streaming, non-streaming, manual generation)
- Progress widget total count now updates correctly when new prompts are detected during streaming (#19)
  - Widget now shows accurate intermediate states (1/2, 2/3, etc.) instead of just current/current (1/1, 2/2)
  - `insertProgressWidget()` now updates total count when widget already exists instead of failing
- Progress widget now shows during image regeneration (#19)
  - Widget displays "Generating images: 0 of 1" during regeneration
  - Automatically removed after regeneration completes or fails

### Changed

- "Text changed" logging in streaming monitor changed to TRACE level to reduce log verbosity at DEBUG level

## [1.1.0] - 2025-10-09

### Added

- Prompt metadata tracking system for supporting prompt regeneration (#14)
  - Stores prompt history per-position in chat
  - Tracks image-to-prompt associations
  - De-duplicates identical prompts across chat
- AI-powered prompt update dialog (#14)
  - Click on any AI-generated image and select "Update Prompt"
  - Provide feedback on what you want to change
  - LLM automatically updates the prompt based on your feedback
  - Optionally regenerate image with updated prompt
- Minimum generation interval setting to enforce time delay between consecutive image generation requests (helps prevent rate limiting)

### Improved

- Added validation to enforce min/max constraints on all numeric settings (streaming poll interval, max concurrent generations, minimum generation interval)
- Prompt update operations now queued with generation to prevent race conditions (#14)
- Enhanced race condition protection: manual operations (generation, regeneration, prompt update) now blocked when streaming active for the same message, preventing conflicts from simultaneous operations
- Dialog positioning and mobile responsiveness (#14)
  - Regeneration confirmation dialog positioned at 35vh for easier interaction
  - Mobile-optimized layouts with responsive font sizes and spacing
  - Better button layouts with flex-wrap for small screens
  - Improved textarea styling with focus states

### Fixed

- Prompt update and regeneration confirmation dialogs now visible (#14)
  - Added CSS styling for `.auto-illustrator-dialog` class
  - Fixed invisible dialogs that prevented completing the update workflow
  - Refactored dialog CSS to use generic class for all dialogs (DRY approach)
- Defensive check for undefined `chat_metadata` prevents errors in old chats (#14)
- Dialog duplicate prevention for smoother mobile experience (#14)
- Legacy images without metadata automatically initialized on first access (#14)
- LLM prompt updates now use `generateRaw()` instead of `generateQuietPrompt()` to prevent story text generation (#14)
- Prompt IDs no longer written to message text - properly converts IDs to actual prompt text (#14)
- Image regeneration after prompt update now works correctly with separated sequential operations (#14)

### Changed

- Simplified README documentation by removing redundant image captions now that demo images are in place
- Removed REQUIRED_IMAGES.md planning document as all images are completed

## [1.0.0] - 2025-10-09

Initial release of SillyTavern Auto Illustrator extension.

### Added

- **Core Features**

  - Common style tags: Add comma-separated tags to all image prompts with configurable prefix/suffix position and automatic deduplication
  - Automatic inline image generation based on LLM-generated prompts
  - Integration with Stable Diffusion slash command (`/sd`)
  - Regex-based image prompt extraction with multi-pattern support
  - Support for multiple tag formats: HTML comments `<!--img-prompt="..."-->`, hyphenated `<img-prompt>`, and legacy underscore `<img_prompt>` tags
  - Configurable prompt detection patterns in settings UI (one regex pattern per line)

- **Streaming Image Generation**

  - Progressive image generation as streaming text arrives
  - Queue-based architecture detects prompts during LLM streaming
  - Images appear as soon as generated (no waiting for full response)
  - Configurable polling interval (100-1000ms, default 300ms)
  - Configurable max concurrent generations (1-5, default: 1)
  - Two-way handshake coordination for deferred image insertion
  - Batch image insertion using single-write approach
  - Final scan on GENERATION_ENDED to catch prompts added at end of stream
  - Per-message operation queue to serialize manual generation and regeneration operations

- **Manual Image Generation**

  - Manual generation button in message actions menu for messages with image prompts
  - Modal dialog with "Append" and "Replace" modes
  - Replace mode: Remove existing images and regenerate
  - Append mode: Keep existing images and add new ones
  - Configurable default mode in settings UI (default: Append)
  - Purple wand icon for easy identification
  - Image regeneration feature for existing images

- **Meta Prompt Management**

  - Preset management system for meta-prompt templates
  - Two predefined presets: Default and NAI 4.5 Full (optimized for NovelAI Diffusion 4.5)
  - Create, update, and delete custom presets
  - Edit mode with Save and Save As functionality
  - Preset content preview with scrollable display
  - Meta-prompt injection via CHAT_COMPLETION_PROMPT_READY event
  - Generation type filtering (normal, quiet, impersonate)

- **Chat History Pruning**

  - Removes generated `<img>` tags from chat history before sending to LLM
  - Preserves `<img_prompt>` tags so LLM recognizes format
  - Only removes images in assistant messages (preserves user-uploaded images)
  - Does not modify saved chat files, only in-memory chat

- **Validation & Feedback**

  - Real-time validation indicator for prompt detection patterns vs meta prompt
  - Visual feedback with green checkmark for valid patterns
  - Warning indicator when patterns don't match meta prompt format
  - Toastr notifications for image generation feedback

- **Internationalization**

  - Full i18n support with English (en-us) and Simplified Chinese (zh-cn)
  - 76 translation keys covering all UI text
  - Automatic language detection via SillyTavern i18n system
  - Simplified Chinese README translation (README_CN.md)

- **Logging & Debugging**

  - Centralized logging system using loglevel library
  - Contextual loggers for each module (Monitor, Queue, Processor, Generator, etc.)
  - Configurable log level in UI (TRACE, DEBUG, INFO, WARN, ERROR, SILENT)
  - Image generation duration logging
  - Comprehensive logging documentation (docs/LOGGING.md)

- **Settings & Configuration**

  - Enable/disable toggle
  - Meta-prompt template customization via presets
  - Streaming enable/disable toggle
  - Streaming poll interval slider (100-1000ms)
  - Max concurrent generations slider (1-5)
  - Prompt detection patterns configuration
  - Common style tags with prefix/suffix position control
  - Default manual generation mode (Append/Replace)
  - Log level dropdown
  - Reset to defaults button

- **Development & Testing**

  - Comprehensive unit test suite with Vitest (214 tests)
  - Tests for streaming queue, monitor, processor
  - Tests for image extraction, generation, settings
  - Tests for manual generation and regeneration
  - Full TypeScript type definitions for SillyTavern API
  - Google TypeScript Style Guide compliance with `gts`
  - Webpack build system for production bundling
  - Development documentation (docs/DEVELOPMENT.md)

- **Documentation**
  - Comprehensive README with installation, usage, troubleshooting
  - Chinese README translation (README_CN.md)
  - Development guide (docs/DEVELOPMENT.md)
  - Logging documentation (docs/LOGGING.md)
  - Architecture documentation (docs/design_doc.md, docs/silly_tavern_dev_tips.md)
  - GitHub issue template for error handling improvements

### Technical Details

- **Architecture**

  - Event-driven architecture using SillyTavern events (MESSAGE_RECEIVED, MESSAGE_UPDATED, MESSAGE_EDITED, CHAT_COMPLETION_PROMPT_READY, STREAM_TOKEN_RECEIVED, GENERATION_ENDED, CHAT_CHANGED)
  - Queue-based streaming architecture with state management
  - Modular design with single responsibility principle
  - Centralized configuration (constants.ts, types.ts, regex.ts)

- **Code Quality**

  - Built with TypeScript and Webpack
  - Zero lint warnings (Google TypeScript Style Guide)
  - Minimal use of `any` types (full type safety in production code)
  - Proper DOM type definitions in tsconfig
  - `createMockContext()` helper for clean, type-safe test mocks

- **Performance & Reliability**

  - Sequential image generation to prevent rate limiting (NovelAI 429 errors)
  - Smart deduplication prevents duplicate image generation
  - Polling-based prompt detection (300ms intervals during streaming)
  - Progressive image insertion into streaming messages
  - Position-aware image insertion handles growing streaming text
  - Graceful fallback to non-streaming mode if disabled

- **Implementation Details**
  - In-place image prompt replacement preserving text order
  - Chat history interceptor prevents LLM context pollution
  - Helper functions eliminate code duplication (~340 lines reduced)
  - Direct type imports from types.ts (no re-exports)
  - Event type references use eventTypes properties directly
  - Image titles use simple numeric indices (#1, #2, etc.)
  - Generated images persist after chat reload via context.saveChat()
  - MESSAGE_UPDATED and MESSAGE_EDITED events emitted for proper rendering
