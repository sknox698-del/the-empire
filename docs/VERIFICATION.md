# Publication review

Reviewed 2026-09-18; publication checks completed 2026-09-20 on Windows with Node.js 24.19.0.

## Checks

- JavaScript syntax checks passed for data, engine, and UI files.
- The existing `npm run check` smoke suite passed. It covers initial state, save migration, dashboard/map rendering, guided-tour targets, immediate employee-assignment refresh, event-effect names, business data isolation, energy validation, loan repayment totals, and day progression. Some UI checks inspect generated markup rather than a real browser.
- `npm run build` passed and copied the five runtime files into the web output.
- A clean locked install succeeded with `npm ci --ignore-scripts`; The unused `@capacitor/assets` tool was subsequently removed from the manifest and lockfile; the final lockfile describes 92 dependencies. Lifecycle scripts were intentionally disabled.
- `npm run android:sync` passed, regenerating the excluded Capacitor integration files and native web assets.
- Browser checks passed for new game, tutorial dismissal, city map, business purchase, investigation screen, and writing a save. Reload exposed Continue for the saved day. The city map was visually inspected in a desktop browser; native device testing was not performed.
- The final npm audit reported zero known vulnerabilities after removing the unused asset-generation dependency. This is an advisory snapshot, not a security guarantee.

These checks do not establish complete test coverage, native build success, store readiness, or absence of all security defects.

## Existing limitations found during source review

- `getProgressionStage()` checks the stage-2 condition before later stages; a player with a business and employee can remain reported at stage 2 despite later progress.
- `resolveMystery()` changes the shared Harbor Tower definition. Starting another game in the same page session can inherit that changed definition; saving/restoring it also needs review.
- Save loading merges defaults but does not fully validate every nested field. Rendering assumes trusted local game data; hand-edited or corrupted saves are not a supported input format.
- The settings screen offers three save actions but no explicit load-slot picker. Continue selects the latest save; a `loadGame(slot)` method exists internally.
- Some character dialogue and map/location gates need further gameplay review. For example, the negative-relationship branch checks below -10 before below -20, making the latter branch unreachable.
- The Android instrumentation scaffold originally expected Capacitor's template application ID. Its assertion now matches the actual app ID; this native test was not executed.
- Developer mode remains available through the menu. Game-data, package, and Android version metadata differ.

Gameplay code is preserved rather than refactored during repository cleanup. These findings should be resolved before presenting the game as a finished release.

## Cleanup scope

The original local project was left intact. A separate source snapshot was prepared with fresh Git history.

- Retained the five runtime files, three existing scripts, locked dependencies, Capacitor configuration, and native Android source/resources.
- Excluded installed dependencies, web bundles, APK/AAB output, Gradle caches, IDE state, local SDK paths, logs, duplicate web files at the Android root, and generated Capacitor/Cordova files.
- Excluded the machine-generated Gradle daemon JDK download configuration. Developers select their own compatible JDK.
- Retained the Gradle wrapper JAR and Android PNG resources because they are build inputs; no compiled game binaries are published.
- Replaced the workstation-specific README with a project overview, verified feature descriptions, portable setup commands, structure, target platform and candid status.
- Added Git attributes, broader ignore rules, Android notes, third-party notes and this review.
- Removed unused `@capacitor/assets` and its transitive dependencies; runtime Capacitor versions and gameplay code are unchanged.
- Omitted the old store-listing draft and privacy-policy template from the public snapshot. They contained incomplete fields and release/privacy statements that were not verified for a shipped app.
- No secrets were intentionally copied. The selected source scan found no credential or private-key patterns; email matches in the lockfile were public upstream deprecation notices, not the owner's contact data.
- No existing Git history, user save data, or files from the unrelated Unreal project were imported.

No permissive license or development roadmap is imposed by this cleanup.
