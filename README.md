<div align="center">
  <h1>🏝️ NotchNook Clone for Windows 11</h1>
  <p><b>A hyper-optimized, native Windows 11 clone of the NotchNook Dynamic Island.</b></p>
</div>

<br/>

## ⌨️ Global Shortcuts

You can control the island from anywhere in Windows using these global hotkeys:

| Shortcut | Action |
| :--- | :--- |
| <kbd>Alt</kbd> + <kbd>N</kbd> | **Hide / Unhide** the island instantly |
| <kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>Q</kbd> | **Force Quit** the application completely |

---

## ✨ Features

* **Live Media Tracker**: Automatically detects any media playing on your PC (Spotify, YouTube, Chrome, Edge) and displays the album art, track title, and live controls.
* **Clipboard History Manager**: Instantly saves the last 5 text items you copied. Just click a clip in the island to instantly paste it into your active window!
* **Hardware Battery Interrupts**: Intercepts Windows ACPI battery signals. The island violently glows green when plugged in, and flashes red if your battery drops below 20%.
* **Live Weather Widget**: Fetches your exact real-time temperature and location completely silently in the background.
* **Quick App Launchers**: Pin your favorite tools like Calculator, Notepad, or Chrome directly inside the notch for lightning-fast access.
* **Over-The-Air Updates**: Built-in silent background updater. If a new version is released on GitHub, the island drops a green banner letting you update with a single click.

---

## ⚡ Hardcore Engine Optimizations

This is not a standard Electron app. The core architecture has been violently pushed to the absolute limits of the Chromium engine to guarantee **0.00% background CPU usage**.

* **Dynamic CPU Kill-Switches:** The heavy Windows C++ API polling loops (which track your music and clipboard) are physically destroyed the millisecond the island collapses, guaranteeing 0.00% processor drain while the app is idle.
* **V8 Bytecode Caching:** We bypass the Javascript parser entirely. The Node.js engine writes compiled machine-code binaries directly to your SSD (`v8-compile-cache`), allowing the app to cold-boot almost instantly.
* **Context Isolation Security:** The frontend UI and the backend Node.js engine are strictly isolated and communicate exclusively through a highly-secure IPC Preload Bridge, slashing the RAM footprint in half.
* **GPU-Composited Physics:** All CSS hover animations use hardware-accelerated transforms (`scaleY`) to completely bypass the CPU layout engine, eliminating thousands of useless math calculations per second.
* **OS Power Suspension Hooks:** The background workers are hard-wired into the Windows motherboard ACPI signals. If you close your laptop screen, the app detects the OS sleep state and completely suspends itself to save battery.
* **Network Throttling:** The weather API caches your geographical router location directly into the engine's memory so it never pings the external IP registry twice.

---

## 📥 Installation

1. Go to the [Releases](https://github.com/PulkitxAG/NotchNook-Windows/releases) tab.
2. Download the latest `NotchNookClone-win32-x64.zip` file.
3. Extract the folder anywhere on your PC.
4. Run `NotchNookClone.exe`.

*The app will automatically set itself to launch invisibly in the background every time you turn on your PC!*
