# Android setup and validation boundary

The native folder is retained because it contains the existing app identity and resources. Regenerating a new Android project could lose those settings.

1. Install the npm dependencies using `npm ci`.
2. Run `npm run check` and `npm run android:sync`.
3. Run `npm run android:open` and allow Android Studio to configure your local SDK path.
4. Select an emulator or physical device and run the app.

The project currently declares SDK 24 minimum / 36 target, Android Gradle Plugin 9.3.2, and Gradle 9.7.1. Configure an appropriate JDK in Android Studio (the original local environment used Java 21). These versions were retained, not upgraded or certified by the publication cleanup.

The machine-generated Gradle daemon download configuration is excluded. Supply Java through your own Android Studio/Gradle settings. `local.properties`, signing material, generated Capacitor files, and build output must stay private or untracked. The small Gradle wrapper JAR is retained as a required build bootstrap input; it is not a packaged game binary.

Before any store release, validate a signed build on devices, save/restore behavior, offline operation, enlarged text, Android back navigation, and the complete gameplay loop. Review the application ID and versioning, asset rights, store copy and privacy disclosures separately. This source publication does not perform a store submission or certify current store-policy compliance.

The Android manifest currently enables OS backup and includes the INTERNET permission. Although the game's web source contains no external API or analytics calls, do not turn that observation into an absolute privacy promise about the operating system or a future packaged release.
