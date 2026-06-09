# UX Issue Assessment and Product Requirements

Date: 2026-06-09

## Summary

Recent product usage exposed several experience gaps across calendar editing, reminder workflow states, CLI readability, notification settings, long-title handling, authentication messaging, avatar reliability, and privacy consent behavior.

The highest-priority items are:

- Fix calendar time save consistency and make default event duration behavior predictable.
- Replace incorrect unauthenticated error copy with a clear login prompt.
- Add an `in_progress` reminder state so work items can represent staged progress.
- Standardize notification settings as global preferences instead of per-surface behavior.
- Improve CLI output readability and make all human-facing CLI output English-only.

## Current Assessment

### 1. Calendar time save behavior

Observed issue:

- When setting a calendar event time, it is unclear whether the user must tap save.
- After saving, the stored/displayed time may differ from the selected time.
- The desired default behavior is: start time defaults to the current moment, and end time defaults to one hour after the start time.

Assessment:

- If the saved time differs from the selected time, treat it as a bug.
- The current miniapp create page initializes `startTime` from the account day service and derives end time from content preferences. The existing default preference allows events without an end time, which conflicts with the desired default one-hour event behavior.
- Timezone conversion, picker precision, and post-save rendering should be checked together because the symptom can come from any of those layers.

Requirement:

- Calendar create/edit must persist exactly the date and time selected by the user, interpreted in the user's account timezone.
- New calendar events must default to:
  - `startAt`: current account-local time.
  - `endAt`: `startAt + 60 minutes`.
- If the start date or start time changes while the end time is still untouched by the user, automatically shift the end time to remain one hour after the new start time.
- If the user has manually edited the end time, do not overwrite it automatically.
- The save action must show a clear success or failure result.

Acceptance criteria:

- Creating an event at 10:00 saves and displays 10:00 after returning to the calendar.
- Creating an event without modifying end time saves an end time of 11:00 when start time is 10:00.
- Changing start time from 10:00 to 13:30 before editing end time updates end time to 14:30.
- Editing end time manually prevents automatic end-time shifting.
- Calendar create and edit behavior is covered by unit or integration tests for timezone-sensitive values.

Suggested scope:

- Miniapp calendar create/edit pages.
- Shared date/time formatting helpers.
- API calendar create/update tests.

### 2. Reminder work states

Observed issue:

- Some work items progress in phases, not just incomplete or complete.
- Desired states: `not_completed`, `in_progress`, `completed`.

Assessment:

- The backend currently uses a reminder `status` string, and existing product behavior appears centered around pending and completed lists.
- This is a model and UX change, not only a label change.

Requirement:

- Add a three-state reminder workflow:
  - `not_completed`: the item has not started.
  - `in_progress`: the item is actively being worked on.
  - `completed`: the item is done.
- Provide UI controls to move a reminder between these states.
- Preserve existing completed behavior, including completion timestamp semantics.
- Define migration behavior for existing reminders:
  - Existing `pending` reminders become `not_completed`.
  - Existing `completed` reminders remain `completed`.
  - Existing `cancelled` behavior must either remain supported internally or be explicitly replaced by delete/archive behavior.

Acceptance criteria:

- Reminder list can filter or segment by all three states.
- A user can mark an item as in progress without completing it.
- CLI and API both accept the new state values.
- Existing reminders continue to display correctly after migration.

Suggested scope:

- Database enum/string validation and migration.
- API schemas and reminder service update logic.
- Miniapp reminder list and edit/create flows.
- CLI reminder list/update commands.
- Shared TypeScript types.

### 3. CLI readability and English-only output

Observed issue:

- CLI display quality is poor and hard to read.
- All CLI output should be in English, with no Chinese copy.

Assessment:

- The CLI currently contains Chinese empty states and labels in list rendering.
- Some output is visually sparse and lacks consistent alignment.

Requirement:

- Replace all human-facing CLI copy with English.
- Improve list rendering for reminders, calendar events, contacts, and tokens.
- Provide readable defaults for terminal users:
  - Clear section headers.
  - Aligned fields where helpful.
  - Truncated long titles with full detail available in `show` commands or JSON mode.
  - Stable status labels.
  - Consistent empty states.
- Preserve `--json` behavior as machine-readable output and avoid decorative formatting in JSON mode.

Acceptance criteria:

- Searching the CLI source for Chinese characters returns no human-facing CLI strings.
- `ai-todo reminder list`, `ai-todo calendar today`, and `ai-todo contact list` produce clear English output.
- Long titles do not make list output hard to scan.
- JSON output remains unchanged except where status values intentionally change.

Suggested scope:

- CLI render helpers.
- CLI command help text.
- README or CLI usage examples if they are user-facing.

### 4. Notification settings should be global and consistent

Observed issue:

- Reminder and calendar settings are different.
- Reminder settings expose WeChat reminders, while calendar settings do not.
- The user expects notification behavior to be a global setting, not configured separately for every surface.

Assessment:

- Current preference naming suggests a global WeChat notification switch plus default reminder behavior, but the UI groups create confusion by separating reminder and calendar preferences.
- The implementation already uses WeChat notification helpers for both reminders and calendar events, so this should be clarified in product settings.

Requirement:

- Create a single global notification preference model for all item types.
- The global notification setting must apply to reminders and calendar events unless a specific item-level override exists.
- Settings page copy and grouping must make this global behavior obvious.
- If item-level notification controls remain, they should be presented as overrides, not as independent global settings.

Acceptance criteria:

- Settings page has one clear notification section for global WeChat notification behavior.
- Calendar create/edit and reminder create/edit use the same global defaults.
- A user does not need to configure WeChat notification separately for reminders and calendar events.
- Existing notification subscriptions and quotas continue to work.

Suggested scope:

- Notification settings page.
- Content preference page.
- Notification preference API naming and docs.
- Miniapp reminder/calendar create/edit defaults.

### 5. Title length and list truncation

Observed issue:

- It is unclear whether titles have a length limit.
- Long titles occupy too much space in list views.
- A one-line display with ellipsis is preferred.

Assessment:

- Backend title columns are currently limited to 255 characters for reminders and calendar events.
- The UI should communicate or enforce a product-level title limit and use one-line truncation in dense list views.

Requirement:

- Define a product title limit for reminders and calendar events.
- Recommended limit: 80 visible characters for user entry guidance, with backend still protecting at 255 characters unless a stricter model migration is desired.
- List views must render titles on one line with ellipsis.
- Detail/edit pages may show the full title.

Acceptance criteria:

- Long reminder and calendar titles do not wrap into multiple lines in list views.
- Title inputs show validation or character guidance before backend rejection.
- API validation errors for excessive title length are clear and localized to the product language policy.
- CLI list output truncates long titles while detail commands show full values.

Suggested scope:

- Miniapp list styles.
- Miniapp create/edit input validation.
- API schema validation messages.
- CLI list rendering.

### 6. Unauthenticated user messaging

Observed issue:

- When the user is not logged in, the product shows a misspelled raw authorization error.
- This message is misspelled and misleading.
- The product should prompt the user to log in.

Assessment:

- Treat this as a bug.
- The error string should not expose raw backend authorization wording in the consumer UI.

Requirement:

- Replace unauthenticated user-facing messages with a clear login prompt.
- Recommended English copy: `Please log in to continue.`
- If the product surface is Chinese, use the approved localized equivalent, but do not show backend error strings directly.
- Fix the spelling of `Authorization` wherever it exists.

Acceptance criteria:

- When no valid session exists, the miniapp shows a login prompt, not raw authorization text.
- The CTA routes the user to the login/profile page.
- Backend and CLI may still use proper technical error codes, but consumer UI maps them to user-friendly copy.
- Searching the codebase finds no misspelled authorization typo.

Suggested scope:

- API error normalization.
- Miniapp request error handling.
- Auth guard and login prompt UI.
- Tests for 401/403 handling.

### 7. Avatar reliability and privacy consent persistence

Observed issue:

- User avatar occasionally disappears.
- After re-login, the user should not be repeatedly prompted for privacy consent unless the privacy policy has changed.

Assessment:

- Avatar loss is likely a data persistence or refresh bug, especially if login/profile update can overwrite an existing avatar with an empty value.
- Privacy consent needs version-aware persistence. Re-login should not reset consent unless the policy version changes or platform rules require re-confirmation.

Requirement:

- Preserve existing avatar unless the user explicitly clears or replaces it.
- WeChat login/profile refresh must not overwrite a stored avatar with an empty or missing avatar value.
- Store privacy consent with a policy version.
- Prompt for privacy consent only when:
  - The user has never agreed.
  - The privacy policy version has changed.
  - The platform requires a new authorization event.

Acceptance criteria:

- Re-login does not remove an existing avatar.
- If WeChat returns no avatar, the existing avatar remains unchanged.
- User privacy consent survives logout and re-login for the same policy version.
- Updating the policy version triggers a new consent prompt.
- Tests cover login refresh with missing avatar and privacy version checks.

Suggested scope:

- WeChat auth service.
- Profile update API.
- Miniapp privacy authorization wrapper.
- Local or server-side privacy consent persistence.
- Avatar fallback rendering.

## Proposed Priority

### P0

- Fix incorrect unauthenticated copy and the misspelled authorization typo.
- Fix calendar selected-time persistence mismatch.

### P1

- Add `in_progress` reminder state.
- Make notification settings global and consistent.
- Preserve avatar across re-login and make privacy consent version-aware.

### P2

- Improve CLI readability and English-only output.
- Add title limit guidance and one-line ellipsis behavior.

## Open Product Decisions

- Should reminder status values be stored as `not_completed/in_progress/completed`, or should the API preserve `pending` internally while displaying `not_completed` in product UI?
- Should title length be strictly capped at 80 characters, or should 80 be guidance while 255 remains the hard backend limit?
- Should item-level notification overrides exist, or should all notifications be purely global for the MVP?
- Should calendar events always require an end time, or only default to one while allowing users to remove it?
