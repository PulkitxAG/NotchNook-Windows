# NotchNook (Native Windows Edition)

A sleek, premium, macOS-style "notch" desktop widget for Windows. NotchNook acts as a stealthy, high-performance system overlay that stays completely hidden until you need it. Built natively in C# WPF for near-zero CPU usage, hardware acceleration, and seamless OS integration.

## 📸 App Showcase

### Stealth Mode (Collapsed)
![Stealth Mode Notch](screenshots/collapsed.png)
When inactive, NotchNook hides as a sleek, minimal, hardware-accelerated black pill at the very top of your screen, blending perfectly into your bezel.

### Active Mode (Expanded Nook)
![Expanded NotchNook UI](screenshots/expanded.png)
Hovering over the notch instantly expands it into a fully-featured productivity dashboard. 

**Nook Dashboard Features:**
- **🎵 Global Media Player:** Automatically syncs with Windows (Spotify, YouTube, Chrome, etc.) to show album art, track details, playback controls, and a live audio equalizer.
- **📅 Dynamic Calendar:** A sleek mini-calendar highlighting today's date and the current week.
- **🔋 Battery Monitor:** Real-time tracking of your laptop's battery life and charging status.
- **🌤️ Live Weather:** Instant access to your current local temperature and weather conditions.
- **🚀 Quick Launch Bar:** A dock of shortcut icons at the bottom for instantly opening essential apps (Terminal, Notes, Explorer, Browser, Trash).
- **📋 Dual-Tab System:** The header lets you instantly toggle between this dashboard ("Nook") and your complete copy/paste history ("Clipboard").

## ⚡ Quick Shortcuts

Since NotchNook operates as a stealth background widget without taskbar clutter, you control it entirely via global hotkeys:

| Shortcut | Action | Description |
| :--- | :--- | :--- |
| **`Alt + N`** | **Hide / Unhide** | Instantly toggles the visibility of the Notch on your screen without killing the app. (Note: NotchNook features a Smart Auto-Hide engine that will also automatically hide itself if you enter a fullscreen game). |
| **`Alt + Shift + Q`** | **Force Quit** | Completely shuts down the NotchNook background process and frees up system resources. |

---

## ✨ Features

- **Pristine Dark-Mode Aesthetic:** Pure graphite `#181818` UI with subtle glow effects and modern rounded geometry, heavily inspired by high-end studio equipment.
- **Advanced Clipboard History:** Automatically intercepts and stores your copied text. Hover over the Notch to expand it and instantly view your recently copied items with a custom smooth-scrolling engine. Long text gracefully fades out with an ellipsis.
- **Smooth Physics Engine:** Features buttery-smooth, GPU-accelerated WPF expansion and collapse animations.
- **Global Hardware Media Sync:** Reads directly from the Windows Global System Media Transport Controls to display whatever music or video you are playing system-wide (Spotify, YouTube, etc.) accompanied by a live audio equalizer animation.
- **Smart Auto-Hide:** Automatically detects when a game or movie is running in True Fullscreen and hides itself to prevent blocking your view.

## 🚀 Installation & Running

1. Download the latest `NotchNook.exe` from the **Releases** tab on the right.
2. Double-click the `.exe` to launch. No installation required! (It runs silently in the background).
3. Press `Alt + N` to hide/unhide it anytime.

## 🛠 Building from Source

If you want to compile NotchNook yourself:
1. Ensure you have the [.NET 8.0 SDK](https://dotnet.microsoft.com/en-us/download/dotnet/8.0) installed.
2. Clone this repository.
3. Run the following command to build a highly-optimized, single-file executable:
   ```bash
   dotnet publish -c Release -r win-x64 --self-contained false -p:PublishSingleFile=true
   ```

## 📁 Repository Structure

- **`/` (Root):** The official, high-performance C# WPF native Windows application.
- **`/Earlier_JS_Release`:** The legacy JavaScript web-wrapper prototype of the application.
