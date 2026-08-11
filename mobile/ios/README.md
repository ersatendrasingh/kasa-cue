# Kasa Mobile for iOS

This folder contains the isolated iOS companion app. It does not replace or
modify the Next.js web app or the Electron desktop apps.

## Requirements

- macOS with the full Xcode application installed
- iOS 17 or newer
- An iPhone signed in with an Apple Account
- The production Kasa web/API deployment at `https://cue.getkasa.in`

## Run on an iPhone for free

1. Open `KasaMobile.xcodeproj` in Xcode.
2. Select the `KasaMobile` target and open **Signing & Capabilities**.
3. Choose your Apple Account's **Personal Team**.
4. If Xcode reports that the bundle identifier is already used, change
   `in.getkasa.mobile.personal` to another unique value.
5. Connect the iPhone, trust the Mac, enable Developer Mode on the iPhone, and
   choose the iPhone as the run destination.
6. Press Run.

Free Personal Team profiles expire after seven days. Reopen the project and
press Run again to reinstall/re-sign the app.

## Architecture

- SwiftUI owns the app shell, launch experience, native bottom navigation,
  connectivity feedback, safe-area layout, and haptics.
- One persistent `WKWebView` owns the authenticated Kasa session so existing
  NextAuth cookies and all Vercel APIs keep working without exposing server
  secrets in the app.
- The browser surface is restricted to Kasa's production origin. External
  links open in Safari.
- Microphone capture requests from the trusted Kasa origin are bridged through
  the native iOS permission flow.

The next audio milestone is a native recorder bridge for chunked transcription
and interruption recovery. Laptop or Bluetooth playback from another device is
not available to iOS as a capturable input stream.
