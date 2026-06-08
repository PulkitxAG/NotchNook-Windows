using System;
using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Threading.Tasks;
using System.Windows;

namespace NotchNookNative
{
    public static class UpdateManager
    {
        private const string RepoOwner = "PulkitxAG";
        private const string RepoName = "NotchNook-Windows";
        private const string CurrentVersion = "v1.3.0"; // Bumped past old releases to prevent downgrade loop

        public static async Task<bool> CheckForUpdatesAsync()
        {
            try
            {
                using var client = new HttpClient();
                client.DefaultRequestHeaders.UserAgent.Add(new ProductInfoHeaderValue("NotchNookUpdater", "1.0"));

                string apiUrl = $"https://api.github.com/repos/{RepoOwner}/{RepoName}/releases/latest";
                var response = await client.GetAsync(apiUrl);

                if (!response.IsSuccessStatusCode) return false;

                var json = await response.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;

                if (!root.TryGetProperty("tag_name", out var tagElement)) return false;
                string latestVersionStr = tagElement.GetString() ?? "";

                if (string.IsNullOrEmpty(latestVersionStr)) return false;

                // Strip 'v' prefix if present for parsing
                string cleanLatest = latestVersionStr.StartsWith("v", StringComparison.OrdinalIgnoreCase) ? latestVersionStr.Substring(1) : latestVersionStr;
                string cleanCurrent = CurrentVersion.StartsWith("v", StringComparison.OrdinalIgnoreCase) ? CurrentVersion.Substring(1) : CurrentVersion;

                if (Version.TryParse(cleanLatest, out Version latestVer) && Version.TryParse(cleanCurrent, out Version currentVer))
                {
                    if (latestVer > currentVer)
                    {
                        // A strictly newer version exists!
                        return true;
                    }
                }
                else
                {
                    // Fallback to simple string comparison if parsing fails, but avoid downgrade loop
                    if (latestVersionStr != CurrentVersion && string.Compare(latestVersionStr, CurrentVersion) > 0)
                    {
                        return true;
                    }
                }
                
                return false;
            }
            catch (Exception ex)
            {
                File.WriteAllText("update_error.txt", "Updater Error: " + ex.ToString());
                return false;
            }
        }
    }
}
