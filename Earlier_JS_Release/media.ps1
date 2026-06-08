param($action)

$code = @"
using System.Runtime.InteropServices;
public class MediaKeys {
    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, int dwExtraInfo);
    public static void PlayPause() { keybd_event(0xB3, 0, 0, 0); keybd_event(0xB3, 0, 2, 0); }
    public static void Next() { keybd_event(0xB0, 0, 0, 0); keybd_event(0xB0, 0, 2, 0); }
    public static void Prev() { 
        // Double-tap the Previous key to bypass the "Restart Song" behavior in Spotify/Apple Music
        keybd_event(0xB1, 0, 0, 0); keybd_event(0xB1, 0, 2, 0); 
        System.Threading.Thread.Sleep(100);
        keybd_event(0xB1, 0, 0, 0); keybd_event(0xB1, 0, 2, 0); 
    }
}
"@

try {
    Add-Type -TypeDefinition $code -ErrorAction Ignore
} catch {}

if ($action -eq "playpause") { [MediaKeys]::PlayPause() }
if ($action -eq "next") { [MediaKeys]::Next() }
if ($action -eq "prev") { [MediaKeys]::Prev() }
