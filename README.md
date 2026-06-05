# 🏝️ NotchNook Clone for Windows

A sleek, lightweight, and customizable Dynamic Island clone built natively for Windows 11. It sits quietly at the top center of your screen, providing a beautiful glassmorphic hub for your media controls, system telemetry, calendar, clipboard, and quick app shortcuts.

---

## ✨ Features

*   **🎵 Live Media Controller:** Instantly hooks into your active Windows audio (Spotify, Chrome, Apple Music, etc.) with optimistic UI updates for instant playback control and a bouncing audio visualizer.
*   **📋 Background Clipboard Manager:** Quietly runs in the background to automatically save your 5 most recent `Ctrl+C` text copies. Click any clip in the list to instantly copy it back to your clipboard.
*   **🔋 System Telemetry:** Live battery monitoring and live local weather updates.
*   **📅 Interactive Agenda:** A clean, rolling 4-day calendar view to keep you on track.
*   **🚀 Quick App Launchers:** One-click shortcuts to instantly open your Calculator, Notepad, File Explorer, and Web Browser directly from the island.
*   **💎 Premium Glassmorphic UI:** Built with an absolute black backdrop, smooth border transitions, and custom Google Material Symbols colored with elegant pastel accents.
*   **🪄 Interactive Animations:** Hover to expand the island natively, or drag files onto it. Features springy, satisfying micro-animations on all buttons.

---

## 🚀 How to Download & Install

This application is fully portable. There is no complicated installer, and it does not require administrator privileges to run!

1.  **Download:** Go to the [Releases](../../releases) tab on the right side of this page and download the latest `NotchNookClone-win32-x64.zip` file.
2.  **Extract:** Once downloaded, right-click the `.zip` file and select **"Extract All..."**.
3.  **Run:** Open the newly extracted folder and double-click the **`NotchNookClone.exe`** file. The island will instantly appear at the top of your screen!

> **💡 Pro Tip:** For easy access, right-click `NotchNookClone.exe` and select **"Pin to Taskbar"** or **"Send to > Desktop (create shortcut)"** so you can launch it easily anytime you start your PC!

---

## 🛠️ Built With

*   **[Electron](https://www.electronjs.org/)** - For the native desktop windowing and IPC communication.
*   **Vanilla JS, HTML, CSS** - For maximum performance and absolute control over the styling and layout.
*   **Windows SMTC API** - Utilizes the modern native Windows 10/11 Media Transport Controls via PowerShell to flawlessly manage media skipping without flaky keyboard emulation.
*   **Open-Meteo API** - For live weather telemetry.

---

## 💻 For Developers (Run Locally)

If you want to clone this repository, tweak the code, and run it locally, follow these steps:

1.  Clone the repository to your local machine.
2.  Ensure you have [Node.js](https://nodejs.org/) installed.
3.  Open a terminal in the folder and install the dependencies:
    ```bash
    npm install
    ```
4.  Start the application:
    ```bash
    npm start
    ```
5.  To package the app into a `.zip` for Windows yourself, run:
    ```bash
    npm install electron-packager --save-dev
    npx electron-packager . "NotchNookClone" --platform=win32 --arch=x64 --out=dist --overwrite
    ```
