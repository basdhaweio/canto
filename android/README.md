# Canto — Android app

A native shell around the published site (https://basdhaweio.github.io/canto/) plus a **home-screen flashcard widget**
and **long-press shortcuts**. Same pattern as Forge and the Library app: the app loads the live site, so pushes (new
units, fixes) reach it without an APK update, and CI builds the APK.

## Install / update

Newest build, always at the same URL (open it on the phone, allow installs from that source once):

https://github.com/basdhaweio/canto/releases/download/android-latest/canto.apk

Debug builds are signed with the committed `app/debug.keystore` (the standard well-known debug key, the same file as
the Forge and Library apps), so a newer APK installs over an older one. Native changes (widget, shortcuts, icon) need a
new APK; changes to the site do not.

## Your progress

Canto keeps everything in the page's own storage, and the app's WebView is a separate store from Chrome's. Moving over
once: in Chrome, **Settings → Your progress → Export progress**; in the app, the home screen offers **Import progress
file** while it's empty (or Settings → Import). `allowBackup=false`, like Forge, so an export is the way to keep a copy.

## What the shell does

- WebView on the live site; off-site links (meeting link, TVBanywhere) open outside; back walks the page's history.
- `window.CantoAndroid` (MainActivity.Bridge), used by `js/native.js`:
  - `widget(json)`: the widget's deck and summary, sent after every change.
  - `takePending()`: grades made on the widget since last time (JSON array); the page schedules each on the day it
    was made, so XP, quests and the streak count it. Called on load and whenever the app comes back to the front.
  - `saveFile(name, text)`: "Export progress" opens Android's save dialog.
  - `theme(dark)`: the system bars take the page's background.
- File inputs (Import) open Android's file picker.
- Opens on a page URL from the widget or a shortcut (`#/review`, `#/quiz`, …); if the app is already open only the
  hash moves.

## The widget (`CantoWidget`)

Your cards on the home screen, no network needed: due cards first (shuffled, stable for the day), then today's new
cards, from the card types set in Settings. Tap the card or **Show answer** to flip; **Skip** moves on; **Again / Hard
/ Good** grade it and the next card slides in. Grades wait in the widget until Canto next opens, then the page applies
them (a toast says how many). The header shows the streak, freezes, level and XP bar and opens the app. When the deck
runs out it says so and opens Review.

## Shortcuts

Long-press the icon: **Review**, **Quiz**, **Particles** (particles & endings deck), **Dictionary**.

## Building locally

```sh
cd android
./gradlew assembleDebug     # needs ANDROID_HOME or android/local.properties
# → app/build/outputs/apk/debug/app-debug.apk
```

The launcher icon's foreground is rendered by `python tools/android_icons.py`.
