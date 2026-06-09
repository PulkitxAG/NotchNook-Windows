using System;
using System.IO;
using System.Windows;
using System.Windows.Input;
using System.Windows.Controls;
using System.Windows.Media.Imaging;
using System.Windows.Media.Animation;
using Windows.Media.Control;
using Windows.Devices.Power;
using NAudio.CoreAudioApi;

namespace NotchNookNative
{
    public partial class MainWindow : Window
    {
        private bool _isExpanded = false;
        private bool _isManuallyHidden = false;

        [System.Runtime.InteropServices.DllImport("kernel32.dll", SetLastError = true)]
        [return: System.Runtime.InteropServices.MarshalAs(System.Runtime.InteropServices.UnmanagedType.Bool)]
        static extern bool GetSystemPowerStatus(out SYSTEM_POWER_STATUS sps);

        public struct SYSTEM_POWER_STATUS
        {
            public byte ACLineStatus;
            public byte BatteryFlag;
            public byte BatteryLifePercent;
            public byte SystemStatusFlag;
            public int BatteryLifeTime;
            public int BatteryFullLifeTime;
        }

        [System.Runtime.InteropServices.DllImport("user32.dll")]
        static extern int SetWindowLong(IntPtr hwnd, int nIndex, int dwNewLong);

        [System.Runtime.InteropServices.DllImport("user32.dll")]
        static extern int GetWindowLong(IntPtr hwnd, int nIndex);

        [System.Runtime.InteropServices.DllImport("user32.dll")]
        private static extern bool RegisterHotKey(IntPtr hWnd, int id, uint fsModifiers, uint vk);



        [System.Runtime.InteropServices.DllImport("user32.dll")]
        private static extern bool UnregisterHotKey(IntPtr hWnd, int id);

        [System.Runtime.InteropServices.DllImport("user32.dll", SetLastError = true)]
        private static extern bool AddClipboardFormatListener(IntPtr hwnd);

        [System.Runtime.InteropServices.DllImport("user32.dll", SetLastError = true)]
        private static extern bool RemoveClipboardFormatListener(IntPtr hwnd);

        [System.Runtime.InteropServices.DllImport("user32.dll")]
        private static extern IntPtr GetForegroundWindow();

        [System.Runtime.InteropServices.DllImport("user32.dll")]
        private static extern IntPtr GetDesktopWindow();

        [System.Runtime.InteropServices.DllImport("user32.dll")]
        private static extern IntPtr GetShellWindow();

        [System.Runtime.InteropServices.DllImport("user32.dll", SetLastError = true)]
        private static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

        [System.Runtime.InteropServices.StructLayout(System.Runtime.InteropServices.LayoutKind.Sequential)]
        public struct RECT
        {
            public int Left;
            public int Top;
            public int Right;
            public int Bottom;
        }

        [System.Runtime.InteropServices.DllImport("user32.dll")]
        private static extern int GetSystemMetrics(int nIndex);
        private const int SM_CXSCREEN = 0;
        private const int SM_CYSCREEN = 1;

        private const int GWL_EXSTYLE = -20;
        private const int WS_EX_TOOLWINDOW = 0x00000080;
        private const int WS_EX_APPWINDOW = 0x00040000;
        private const int WM_HOTKEY = 0x0312;
        private const int WM_CLIPBOARDUPDATE = 0x031D;

        private const uint MOD_ALT = 0x0001;
        private const uint MOD_SHIFT = 0x0004;
        private const uint VK_N = 0x4E;
        private const uint VK_Q = 0x51;
        private const int HOTKEY_ID_N = 9000;
        private const int HOTKEY_ID_Q = 9001;

        private System.Windows.Threading.DispatcherTimer _timer = null!;
        private GlobalSystemMediaTransportControlsSession _currentSession = null!;
        
        // NAudio backend for Windows CoreAudio Volume Control
        private MMDeviceEnumerator _deviceEnumerator = null!;
        private MMDevice _defaultDevice = null!;
        private bool _isUpdatingVolume = false;

        private System.Collections.ObjectModel.ObservableCollection<string> _clipboardHistory = new System.Collections.ObjectModel.ObservableCollection<string>();

        public MainWindow()
        {
            try {
                InitializeComponent();
                Microsoft.Win32.SystemEvents.PowerModeChanged += SystemEvents_PowerModeChanged;
                CheckChargingState(); // Initial check
                
                SetAutoStart(true); // Register for boot on startup
                
                InitHardwareApis();
                InitAudio();
                InitPollers();
                
                // Fire and forget auto-updater in the background
                Task.Run(async () => {
                    bool hasUpdate = await UpdateManager.CheckForUpdatesAsync();
                    if (hasUpdate) {
                        Dispatcher.Invoke(() => {
                            UpdateButton.Visibility = Visibility.Visible;
                        });
                    }
                });
                
                this.Left = (SystemParameters.PrimaryScreenWidth - this.Width) / 2;
                this.Top = 0;
            } catch (Exception ex) {
                System.IO.File.WriteAllText("error.txt", "Constructor Error: " + ex.ToString());
            }
        }

        private void SetAutoStart(bool enable)
        {
            try
            {
                using (var key = Microsoft.Win32.Registry.CurrentUser.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\Run", true))
                {
                    if (enable)
                    {
                        string exePath = System.Diagnostics.Process.GetCurrentProcess().MainModule?.FileName ?? "";
                        if (!string.IsNullOrEmpty(exePath)) {
                            key.SetValue("NotchNookNative", $"\"{exePath}\"");
                        }
                    }
                    else
                    {
                        key.DeleteValue("NotchNookNative", false);
                    }
                }
            }
            catch { }
        }

        protected override void OnSourceInitialized(EventArgs e)
        {
            base.OnSourceInitialized(e);
            var hwnd = new System.Windows.Interop.WindowInteropHelper(this).Handle;
            int extendedStyle = GetWindowLong(hwnd, GWL_EXSTYLE);
            SetWindowLong(hwnd, GWL_EXSTYLE, (extendedStyle | WS_EX_TOOLWINDOW) & ~WS_EX_APPWINDOW);

            System.Windows.Interop.HwndSource source = System.Windows.Interop.HwndSource.FromHwnd(hwnd);
            source.AddHook(HwndHook);

            RegisterHotKey(hwnd, HOTKEY_ID_N, MOD_ALT, VK_N);
            RegisterHotKey(hwnd, HOTKEY_ID_Q, MOD_ALT | MOD_SHIFT, VK_Q);

            AddClipboardFormatListener(hwnd);
            ClipboardList.ItemsSource = _clipboardHistory;
        }

        private DateTime _lastManualCopyTime = DateTime.MinValue;

        private IntPtr HwndHook(IntPtr hwnd, int msg, IntPtr wParam, IntPtr lParam, ref bool handled)
        {
            if (msg == WM_CLIPBOARDUPDATE)
            {
                if ((DateTime.Now - _lastManualCopyTime).TotalMilliseconds < 500)
                {
                    // Ignore multi-firing Windows clipboard events right after we manually copy
                }
                else
                {
                    UpdateClipboard();
                }
                handled = true;
            }
            else if (msg == WM_HOTKEY)
            {
                if (wParam.ToInt32() == HOTKEY_ID_N)
                {
                    // Toggle the visibility of the entire island
                    if (this.Visibility == Visibility.Visible)
                    {
                        this.Visibility = Visibility.Hidden;
                        _isManuallyHidden = true;
                    }
                    else
                    {
                        ResetToNookTab();
                        this.Visibility = Visibility.Visible;
                        _isManuallyHidden = false;
                    }
                    
                    handled = true;
                }
                else if (wParam.ToInt32() == HOTKEY_ID_Q)
                {
                    Application.Current.Shutdown();
                    handled = true;
                }
            }
            return IntPtr.Zero;
        }

        protected override void OnClosed(EventArgs e)
        {
            var hwnd = new System.Windows.Interop.WindowInteropHelper(this).Handle;
            UnregisterHotKey(hwnd, HOTKEY_ID_N);
            UnregisterHotKey(hwnd, HOTKEY_ID_Q);
            RemoveClipboardFormatListener(hwnd);
            base.OnClosed(e);
        }

        private void InitPollers()
        {
            // Fast poller for UI interactions (Fullscreen hiding)
            var fastTimer = new System.Windows.Threading.DispatcherTimer();
            fastTimer.Interval = TimeSpan.FromMilliseconds(500);
            fastTimer.Tick += (s, e) => CheckFullscreen();
            fastTimer.Start();

            _timer = new System.Windows.Threading.DispatcherTimer();
            _timer.Interval = TimeSpan.FromSeconds(5);
            _timer.Tick += (s, e) => {
                UpdateBattery();
                UpdateWeather();
                UpdateCalendar();
                
                // Fallback: Manually sync media session in case Windows events fail to fire
                if (_sessionManager != null) {
                    try {
                        var currentSession = _sessionManager.GetCurrentSession();
                        if (currentSession != null) {
                            // Only force update if the source app changed, or just call UpdateMediaInfo()
                            // To be safe and simple, we'll just update the text manually here
                            UpdateMediaInfo();
                            UpdatePlayPauseButton(currentSession.GetPlaybackInfo().PlaybackStatus);
                        }
                    } catch { }
                }
            };
            _timer.Start();
            UpdateBattery();
            UpdateWeather();
            UpdateCalendar();
        }

        private void CheckFullscreen()
        {
            if (_isManuallyHidden) return;
            IntPtr fgWindow = GetForegroundWindow();
            if (fgWindow != IntPtr.Zero && fgWindow != GetDesktopWindow() && fgWindow != GetShellWindow())
            {
                GetWindowRect(fgWindow, out RECT rect);
                int width = rect.Right - rect.Left;
                int height = rect.Bottom - rect.Top;
                
                int screenWidth = GetSystemMetrics(SM_CXSCREEN);
                int screenHeight = GetSystemMetrics(SM_CYSCREEN);
                
                // If foreground window is EXACTLY the size of the primary physical screen and positioned at 0,0 (True Fullscreen)
                if (width == screenWidth && height == screenHeight && rect.Left == 0 && rect.Top == 0)
                {
                    if (this.Visibility == Visibility.Visible)
                        Dispatcher.Invoke(() => this.Visibility = Visibility.Hidden);
                    return;
                }
            }
            
            // Re-show if not fullscreen
            if (this.Visibility == Visibility.Hidden)
                Dispatcher.Invoke(() => this.Visibility = Visibility.Visible);
        }

        private void UpdateBattery()
        {
            if (GetSystemPowerStatus(out SYSTEM_POWER_STATUS sps))
            {
                BattTextRun.Text = $"{sps.BatteryLifePercent}%";
            }
        }

        private void UpdateCalendar()
        {
            Dispatcher.Invoke(() => {
                var now = DateTime.Now;
                MonthText.Text = now.ToString("MMM").ToUpper();

                Day1Name.Text = now.ToString("ddd").ToUpper();
                Day1Num.Text = now.ToString("dd");

                var d2 = now.AddDays(1);
                Day2Name.Text = d2.ToString("ddd").ToUpper();
                Day2Num.Text = d2.ToString("dd");

                var d3 = now.AddDays(2);
                Day3Name.Text = d3.ToString("ddd").ToUpper();
                Day3Num.Text = d3.ToString("dd");

                var d4 = now.AddDays(3);
                Day4Name.Text = d4.ToString("ddd").ToUpper();
                Day4Num.Text = d4.ToString("dd");
            });
        }

        private bool _wasPluggedIn = false;

        private void SystemEvents_PowerModeChanged(object sender, Microsoft.Win32.PowerModeChangedEventArgs e)
        {
            if (e.Mode == Microsoft.Win32.PowerModes.StatusChange)
            {
                Dispatcher.Invoke(() => CheckChargingState());
            }
        }

        private void CheckChargingState()
        {
            if (GetSystemPowerStatus(out SYSTEM_POWER_STATUS sps))
            {
                bool isPluggedIn = (sps.ACLineStatus == 1);
                
                if (isPluggedIn && !_wasPluggedIn)
                {
                    // Laptop was just plugged in! Trigger the green pulse.
                    // var sb = (System.Windows.Media.Animation.Storyboard)FindResource("ChargeGlowAnimation");
                    // sb.Begin();
                }
                
                _wasPluggedIn = isPluggedIn;
            }
        }

        private void UpdateClipboard()
        {
            try {
                if (Clipboard.ContainsText()) {
                    string rawText = Clipboard.GetText().Trim();
                    if (!string.IsNullOrEmpty(rawText)) {
                        // Force multi-line strings into a clean single line for the UI
                        string singleLineText = rawText.Replace("\r\n", " ").Replace("\n", " ").Replace("\r", " ");
                        
                        // Insert if unique compared to the very last copied item
                        if (_clipboardHistory.Count == 0 || _clipboardHistory[0] != singleLineText) {
                            _clipboardHistory.Insert(0, singleLineText);
                            Dispatcher.Invoke(() => EmptyClipboardMessage.Visibility = Visibility.Collapsed);
                            
                            // Keep max 50 items
                            if (_clipboardHistory.Count > 50) {
                                _clipboardHistory.RemoveAt(50);
                            }
                        }
                    }
                }
            } catch { }
        }

        private async void UpdateWeather()
        {
            try {
                using (var client = new System.Net.Http.HttpClient())
                {
                    client.Timeout = TimeSpan.FromSeconds(5);
                    string query = "";
                    try {
                        var ipRes = await client.GetStringAsync("http://ip-api.com/json/");
                        var matchLat = System.Text.RegularExpressions.Regex.Match(ipRes, "\"lat\":([0-9.]+)");
                        var matchLon = System.Text.RegularExpressions.Regex.Match(ipRes, "\"lon\":([0-9.]+)");
                        var matchCity = System.Text.RegularExpressions.Regex.Match(ipRes, "\"city\":\"(.*?)\"");
                        
                        if (matchLat.Success && matchLon.Success) {
                            // Use exact GPS decimal coordinates for hyper-accurate weather
                            query = $"{matchLat.Groups[1].Value},{matchLon.Groups[1].Value}";
                        } else if (matchCity.Success) {
                            query = matchCity.Groups[1].Value;
                        }
                    } catch { }

                    string url = string.IsNullOrEmpty(query) ? "https://wttr.in/?format=%c+%t" : $"https://wttr.in/{Uri.EscapeDataString(query)}?format=%c+%t";
                    var res = await client.GetStringAsync(url);
                    
                    // Remove the awkward "+" sign from the temperature
                    res = res.Replace("+", "").Trim();
                    
                    // Split the icon from the temperature
                    var parts = res.Split(new char[] { ' ' }, 2);
                    if (parts.Length == 2) {
                        string emoji = parts[0];
                        string temp = parts[1].Trim();
                        
                        // Map the raw weather text symbol to a gorgeous, full-color Twemoji PNG from the web
                        string imgUrl = "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/26c5.png"; // Default: partly cloudy
                        if (emoji.Contains("☀️") || emoji.Contains("☀")) imgUrl = "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/2600.png";
                        else if (emoji.Contains("☁️") || emoji.Contains("☁") || emoji.Contains("🌥")) imgUrl = "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/2601.png";
                        else if (emoji.Contains("⛅") || emoji.Contains("🌤")) imgUrl = "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/26c5.png";
                        else if (emoji.Contains("🌧") || emoji.Contains("🌦") || emoji.Contains("☔") || emoji.Contains("💧")) imgUrl = "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f327.png";
                        else if (emoji.Contains("🌩") || emoji.Contains("⚡")) imgUrl = "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/26a1.png";
                        else if (emoji.Contains("🌨") || emoji.Contains("❄")) imgUrl = "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/2744.png";
                        else if (emoji.Contains("🌫") || emoji.Contains("💨")) imgUrl = "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f32b.png";
                        else if (emoji.Contains("🌙") || emoji.Contains("✨") || emoji.Contains("⭐")) imgUrl = "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f319.png"; // Crescent moon

                        Dispatcher.Invoke(() => {
                            try {
                                var bitmap = new System.Windows.Media.Imaging.BitmapImage();
                                bitmap.BeginInit();
                                bitmap.UriSource = new Uri(imgUrl, UriKind.Absolute);
                                bitmap.EndInit();
                                WeatherImageIcon.Source = bitmap;
                                WeatherTempRun.Text = temp;
                            } catch { }
                        });
                    } else {
                        Dispatcher.Invoke(() => {
                            WeatherTempRun.Text = res;
                        });
                    }
                }
            } catch { }
        }

        private GlobalSystemMediaTransportControlsSessionManager _sessionManager;

        private async void InitHardwareApis()
        {
            try 
            {
                _sessionManager = await GlobalSystemMediaTransportControlsSessionManager.RequestAsync();
                _sessionManager.CurrentSessionChanged += (s, e) => {
                    SetCurrentSession(s.GetCurrentSession());
                };
                SetCurrentSession(_sessionManager.GetCurrentSession());
            }
            catch (Exception ex) { 
                System.IO.File.WriteAllText("error.txt", "InitHardwareApis Error: " + ex.ToString());
            }
        }

        private void SetCurrentSession(GlobalSystemMediaTransportControlsSession session)
        {
            if (_currentSession != null)
            {
                _currentSession.MediaPropertiesChanged -= Session_MediaPropertiesChanged;
                _currentSession.PlaybackInfoChanged -= Session_PlaybackInfoChanged;
            }

            _currentSession = session;

            if (_currentSession != null)
            {
                _currentSession.MediaPropertiesChanged += Session_MediaPropertiesChanged;
                _currentSession.PlaybackInfoChanged += Session_PlaybackInfoChanged;
                UpdateMediaInfo();
                UpdatePlayPauseButton(_currentSession.GetPlaybackInfo().PlaybackStatus);
            }
            else
            {
                Dispatcher.Invoke(() => {
                    TrackTitle.Text = "Not playing";
                    TrackArtist.Text = "...";
                    AlbumArtImage.ImageSource = null;
                    PlayPauseButton.Content = "\xE768";
                });
            }
        }

        private void Session_MediaPropertiesChanged(GlobalSystemMediaTransportControlsSession sender, MediaPropertiesChangedEventArgs args)
        {
            UpdateMediaInfo();
        }

        private void Session_PlaybackInfoChanged(GlobalSystemMediaTransportControlsSession sender, PlaybackInfoChangedEventArgs args)
        {
            UpdatePlayPauseButton(sender.GetPlaybackInfo().PlaybackStatus);
        }

        private System.Windows.Media.Animation.Storyboard _eqStoryboard = null!;

        private void UpdatePlayPauseButton(GlobalSystemMediaTransportControlsSessionPlaybackStatus status)
        {
            Dispatcher.Invoke(() => {
                bool isPlaying = (status == GlobalSystemMediaTransportControlsSessionPlaybackStatus.Playing);
                PlayPauseButton.Content = isPlaying ? "\xE769" : "\xE768";
                
                // Handle the Animated Album Art EQ Overlay
                if (isPlaying) {
                    PlayingOverlay.Visibility = Visibility.Visible;
                    if (_isExpanded) {
                        if (_eqStoryboard == null) _eqStoryboard = (System.Windows.Media.Animation.Storyboard)FindResource("PlayingEQAnimation");
                        _eqStoryboard.Begin();
                    }
                } else {
                    PlayingOverlay.Visibility = Visibility.Collapsed;
                    if (_eqStoryboard != null) _eqStoryboard.Stop();
                }
                
                var anim = new DoubleAnimation(0.2, 1.0, TimeSpan.FromMilliseconds(200));
                PlayPauseButton.BeginAnimation(UIElement.OpacityProperty, anim);
            });
        }

        private async void UpdateMediaInfo()
        {
            var session = _currentSession;
            if (session == null) return;
            try
            {
                var mediaProperties = await session.TryGetMediaPropertiesAsync();
                if (mediaProperties != null)
                {
                    Dispatcher.Invoke(() => {
                        TrackTitle.Text = string.IsNullOrEmpty(mediaProperties.Title) ? "Not playing" : mediaProperties.Title;
                        TrackArtist.Text = string.IsNullOrEmpty(mediaProperties.Artist) ? "..." : mediaProperties.Artist;
                    });

                    if (mediaProperties.Thumbnail != null)
                    {
                        using (var stream = await mediaProperties.Thumbnail.OpenReadAsync())
                        {
                            var memStream = new MemoryStream();
                            await stream.AsStreamForRead().CopyToAsync(memStream);
                            memStream.Position = 0;
                            Dispatcher.Invoke(() => {
                                try {
                                    var bitmap = new BitmapImage();
                                    bitmap.BeginInit();
                                    bitmap.StreamSource = memStream;
                                    bitmap.CacheOption = BitmapCacheOption.OnLoad;
                                    bitmap.EndInit();
                                    bitmap.Freeze();
                                    AlbumArtImage.ImageSource = bitmap;
                                } catch { }
                            });
                        }
                    }
                    else
                    {
                        Dispatcher.Invoke(() => AlbumArtImage.ImageSource = null);
                    }
                }
            }
            catch { }
        }

        // TABS
        private void TabNook_Click(object sender, MouseButtonEventArgs e)
        {
            if (DashboardView.Visibility == Visibility.Visible && DashboardView.Opacity == 1.0) return;

            DashboardView.Visibility = Visibility.Visible;
            
            // Slide Dashboard IN
            DoubleAnimation slideIn = new DoubleAnimation(20, 0, TimeSpan.FromMilliseconds(250)) { EasingFunction = new CubicEase { EasingMode = EasingMode.EaseOut } };
            DoubleAnimation fadeIn = new DoubleAnimation(0, 1, TimeSpan.FromMilliseconds(250));
            DashboardTransform.BeginAnimation(System.Windows.Media.TranslateTransform.XProperty, slideIn);
            DashboardView.BeginAnimation(UIElement.OpacityProperty, fadeIn);

            // Slide Clipboard OUT
            DoubleAnimation slideOut = new DoubleAnimation(0, -20, TimeSpan.FromMilliseconds(250)) { EasingFunction = new CubicEase { EasingMode = EasingMode.EaseOut } };
            DoubleAnimation fadeOut = new DoubleAnimation(1, 0, TimeSpan.FromMilliseconds(250));
            fadeOut.Completed += (s, ev) => ClipboardView.Visibility = Visibility.Collapsed;
            ClipboardTransform.BeginAnimation(System.Windows.Media.TranslateTransform.XProperty, slideOut);
            ClipboardView.BeginAnimation(UIElement.OpacityProperty, fadeOut);

            // Animate Text Scale and Opacity
            DoubleAnimation scaleUp = new DoubleAnimation(1.15, TimeSpan.FromMilliseconds(200)) { EasingFunction = new CubicEase { EasingMode = EasingMode.EaseOut } };
            DoubleAnimation scaleDown = new DoubleAnimation(1.0, TimeSpan.FromMilliseconds(200)) { EasingFunction = new CubicEase { EasingMode = EasingMode.EaseOut } };
            TabNookScale.BeginAnimation(System.Windows.Media.ScaleTransform.ScaleXProperty, scaleUp);
            TabNookScale.BeginAnimation(System.Windows.Media.ScaleTransform.ScaleYProperty, scaleUp);
            TabClipboardScale.BeginAnimation(System.Windows.Media.ScaleTransform.ScaleXProperty, scaleDown);
            TabClipboardScale.BeginAnimation(System.Windows.Media.ScaleTransform.ScaleYProperty, scaleDown);

            TabNook.Foreground = System.Windows.Media.Brushes.White;
            TabNook.Effect = new System.Windows.Media.Effects.DropShadowEffect { Color = System.Windows.Media.Colors.White, BlurRadius = 4, ShadowDepth = 0, Opacity = 0.4 };
            TabClipboard.Foreground = new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(136, 136, 136));
            TabClipboard.Effect = null;
        }

        private void TabClipboard_Click(object sender, MouseButtonEventArgs e)
        {
            if (ClipboardView.Visibility == Visibility.Visible && ClipboardView.Opacity == 1.0) return;

            ClipboardView.Visibility = Visibility.Visible;

            // Slide Clipboard IN
            DoubleAnimation slideIn = new DoubleAnimation(-20, 0, TimeSpan.FromMilliseconds(250)) { EasingFunction = new CubicEase { EasingMode = EasingMode.EaseOut } };
            DoubleAnimation fadeIn = new DoubleAnimation(0, 1, TimeSpan.FromMilliseconds(250));
            ClipboardTransform.BeginAnimation(System.Windows.Media.TranslateTransform.XProperty, slideIn);
            ClipboardView.BeginAnimation(UIElement.OpacityProperty, fadeIn);

            // Slide Dashboard OUT
            DoubleAnimation slideOut = new DoubleAnimation(0, 20, TimeSpan.FromMilliseconds(250)) { EasingFunction = new CubicEase { EasingMode = EasingMode.EaseOut } };
            DoubleAnimation fadeOut = new DoubleAnimation(1, 0, TimeSpan.FromMilliseconds(250));
            fadeOut.Completed += (s, ev) => DashboardView.Visibility = Visibility.Collapsed;
            DashboardTransform.BeginAnimation(System.Windows.Media.TranslateTransform.XProperty, slideOut);
            DashboardView.BeginAnimation(UIElement.OpacityProperty, fadeOut);

            // Animate Text Scale and Opacity
            DoubleAnimation scaleUp = new DoubleAnimation(1.15, TimeSpan.FromMilliseconds(200)) { EasingFunction = new CubicEase { EasingMode = EasingMode.EaseOut } };
            DoubleAnimation scaleDown = new DoubleAnimation(1.0, TimeSpan.FromMilliseconds(200)) { EasingFunction = new CubicEase { EasingMode = EasingMode.EaseOut } };
            TabClipboardScale.BeginAnimation(System.Windows.Media.ScaleTransform.ScaleXProperty, scaleUp);
            TabClipboardScale.BeginAnimation(System.Windows.Media.ScaleTransform.ScaleYProperty, scaleUp);
            TabNookScale.BeginAnimation(System.Windows.Media.ScaleTransform.ScaleXProperty, scaleDown);
            TabNookScale.BeginAnimation(System.Windows.Media.ScaleTransform.ScaleYProperty, scaleDown);

            TabClipboard.Foreground = System.Windows.Media.Brushes.White;
            TabClipboard.Effect = new System.Windows.Media.Effects.DropShadowEffect { Color = System.Windows.Media.Colors.White, BlurRadius = 4, ShadowDepth = 0, Opacity = 0.4 };
            TabNook.Foreground = new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(136, 136, 136));
            TabNook.Effect = null;
        }

        // NATIVE 0% CPU EVENT HANDLERS
        // Because WPF is deeply integrated into the OS Graphics Engine, 
        // we don't need kernel hooks or C++ polling loops! The OS triggers this natively.
        
        private void ResetToNookTab()
        {
            DashboardView.BeginAnimation(UIElement.OpacityProperty, null);
            DashboardTransform.BeginAnimation(System.Windows.Media.TranslateTransform.XProperty, null);
            ClipboardView.BeginAnimation(UIElement.OpacityProperty, null);
            ClipboardTransform.BeginAnimation(System.Windows.Media.TranslateTransform.XProperty, null);
            
            TabNookScale.BeginAnimation(System.Windows.Media.ScaleTransform.ScaleXProperty, null);
            TabNookScale.BeginAnimation(System.Windows.Media.ScaleTransform.ScaleYProperty, null);
            TabClipboardScale.BeginAnimation(System.Windows.Media.ScaleTransform.ScaleXProperty, null);
            TabClipboardScale.BeginAnimation(System.Windows.Media.ScaleTransform.ScaleYProperty, null);

            DashboardView.Opacity = 1.0;
            DashboardView.Visibility = Visibility.Visible;
            DashboardTransform.X = 0;
            
            ClipboardView.Opacity = 0.0;
            ClipboardView.Visibility = Visibility.Collapsed;
            ClipboardTransform.X = 20;
            
            TabNook.Foreground = System.Windows.Media.Brushes.White;
            TabNook.Effect = new System.Windows.Media.Effects.DropShadowEffect { Color = System.Windows.Media.Colors.White, BlurRadius = 4, ShadowDepth = 0, Opacity = 0.4 };
            
            TabClipboard.Foreground = new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(136, 136, 136));
            TabClipboard.Effect = null;
            
            TabNookScale.ScaleX = 1.15;
            TabNookScale.ScaleY = 1.15;
            TabClipboardScale.ScaleX = 1.0;
            TabClipboardScale.ScaleY = 1.0;
        }

        private void IslandBackground_MouseEnter(object sender, MouseEventArgs e)
        {
            if (_isExpanded) return;
            ResetToNookTab();
            _isExpanded = true;
            
            var expandStoryboard = (System.Windows.Media.Animation.Storyboard)FindResource("ExpandStoryboard");
            expandStoryboard.Begin();

            // Resume EQ animation if music is playing
            if (_currentSession != null && _currentSession.GetPlaybackInfo()?.PlaybackStatus == GlobalSystemMediaTransportControlsSessionPlaybackStatus.Playing)
            {
                if (_eqStoryboard == null) _eqStoryboard = (System.Windows.Media.Animation.Storyboard)FindResource("PlayingEQAnimation");
                _eqStoryboard.Begin();
            }
        }

        private void IslandBackground_MouseLeave(object sender, MouseEventArgs e)
        {
            if (!_isExpanded) return;
            _isExpanded = false;
            
            var collapseStoryboard = (System.Windows.Media.Animation.Storyboard)FindResource("CollapseStoryboard");
            collapseStoryboard.Begin();

            // Suspend EQ animation to save CPU when hidden
            if (_eqStoryboard != null) _eqStoryboard.Stop();
        }

        private void ClipboardList_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (ClipboardList.SelectedItem != null)
            {
                string selectedText = ClipboardList.SelectedItem.ToString();
                try {
                    _lastManualCopyTime = DateTime.Now;
                    Clipboard.SetText(selectedText);
                } catch { }
                ClipboardList.SelectedItem = null;
            }
        }
        
        // INTERACTIVE BUTTON HANDLERS
        private async void PlayPause_Click(object sender, RoutedEventArgs e)
        {
            try {
                var sessionManager = await GlobalSystemMediaTransportControlsSessionManager.RequestAsync();
                await sessionManager.GetCurrentSession().TryTogglePlayPauseAsync();
            } catch { }
        }

        private async void Prev_Click(object sender, RoutedEventArgs e)
        {
            try {
                var sessionManager = await GlobalSystemMediaTransportControlsSessionManager.RequestAsync();
                await sessionManager.GetCurrentSession().TrySkipPreviousAsync();
            } catch { }
        }

        private async void Next_Click(object sender, RoutedEventArgs e)
        {
            try {
                var sessionManager = await GlobalSystemMediaTransportControlsSessionManager.RequestAsync();
                await sessionManager.GetCurrentSession().TrySkipNextAsync();
            } catch { }
        }

        private void UpdateButton_Click(object sender, RoutedEventArgs e)
        {
            try {
                // Open the GitHub Releases page safely in the user's default web browser
                System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo("https://github.com/PulkitxAG/NotchNook-Windows/releases") { UseShellExecute = true });
            } catch { }
        }

        private void CloseApp_Click(object sender, RoutedEventArgs e)
        {
            Application.Current.Shutdown();
        }

        // --- Core Audio NAudio Integration ---
        private void InitAudio()
        {
            try {
                _deviceEnumerator = new MMDeviceEnumerator();
                _defaultDevice = _deviceEnumerator.GetDefaultAudioEndpoint(DataFlow.Render, Role.Multimedia);
                
                UpdateVolumeUI();
                _defaultDevice.AudioEndpointVolume.OnVolumeNotification += AudioEndpointVolume_OnVolumeNotification;
            } catch { }
        }

        private void AudioEndpointVolume_OnVolumeNotification(AudioVolumeNotificationData data)
        {
            Dispatcher.Invoke(() => {
                _isUpdatingVolume = true;
                VolumeSlider.Value = data.MasterVolume * 100;
                UpdateMuteIcon(data.Muted);
                _isUpdatingVolume = false;
            });
        }

        private void UpdateVolumeUI()
        {
            if (_defaultDevice != null)
            {
                _isUpdatingVolume = true;
                VolumeSlider.Value = _defaultDevice.AudioEndpointVolume.MasterVolumeLevelScalar * 100;
                UpdateMuteIcon(_defaultDevice.AudioEndpointVolume.Mute);
                _isUpdatingVolume = false;
            }
        }

        private void UpdateMuteIcon(bool muted)
        {
            VolumeIcon.Text = muted ? "\uE74F" : "\uE995";
            VolumeIcon.Foreground = muted ? new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(255, 80, 80)) : System.Windows.Media.Brushes.White;
        }

        private void VolumeSlider_ValueChanged(object sender, RoutedPropertyChangedEventArgs<double> e)
        {
            if (_isUpdatingVolume || _defaultDevice == null) return;
            try {
                _defaultDevice.AudioEndpointVolume.MasterVolumeLevelScalar = (float)(e.NewValue / 100.0);
                if (_defaultDevice.AudioEndpointVolume.Mute && e.NewValue > 0)
                {
                    _defaultDevice.AudioEndpointVolume.Mute = false;
                    UpdateMuteIcon(false);
                }
            } catch { }
        }

        private void MuteButton_Click(object sender, RoutedEventArgs e)
        {
            if (_defaultDevice == null) return;
            try {
                // Instantly flip system mute. We deliberately DO NOT manually update the UI here,
                // because the system's OnVolumeNotification event will fire immediately and handle 
                // the UI update. Doing it twice causes the visual flicker/glitch.
                _defaultDevice.AudioEndpointVolume.Mute = !_defaultDevice.AudioEndpointVolume.Mute;
            } catch { }
        }

        private void App_Click(object sender, RoutedEventArgs e)
        {
            try {
                if (sender is Button btn && btn.Tag is string appName) {
                    if (appName == "calc") System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo("calc.exe") { UseShellExecute = true });
                    else if (appName == "notepad") System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo("notepad.exe") { UseShellExecute = true });
                    else if (appName == "explorer") System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo("explorer.exe") { UseShellExecute = true });
                    else if (appName == "recycle") System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo("explorer.exe", "shell:RecycleBinFolder") { UseShellExecute = true });
                    else if (appName == "browser") 
                    {
                        string browserPath = "";
                        using (var key = Microsoft.Win32.Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\Shell\Associations\UrlAssociations\http\UserChoice"))
                        {
                            if (key != null)
                            {
                                string progId = key.GetValue("ProgId")?.ToString() ?? "";
                                using (var cmdKey = Microsoft.Win32.Registry.ClassesRoot.OpenSubKey($@"{progId}\shell\open\command"))
                                {
                                    if (cmdKey != null)
                                    {
                                        string cmd = cmdKey.GetValue(null)?.ToString() ?? "";
                                        int exeIndex = cmd.IndexOf(".exe", StringComparison.OrdinalIgnoreCase);
                                        if (exeIndex > 0) browserPath = cmd.Substring(0, exeIndex + 4).Trim('"', ' ');
                                    }
                                }
                            }
                        }
                        if (!string.IsNullOrEmpty(browserPath)) System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(browserPath) { UseShellExecute = true });
                        else System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo("about:blank") { UseShellExecute = true });
                    }
                }
            } catch { }
        }
    }
}