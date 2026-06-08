param (
    [string]$ZipPath,
    [string]$AppDir,
    [string]$ExePath
)

# Wait 3 seconds to ensure the Node process completely exits and unlocks all files
Start-Sleep -Seconds 3

# Define a temporary extraction folder
$TempExtract = Join-Path $env:TEMP "NotchNookUpdateExtract"

# Clean it up if it somehow already exists
if (Test-Path $TempExtract) {
    Remove-Item -Path $TempExtract -Recurse -Force
}

# Extract the downloaded zip file
Expand-Archive -Path $ZipPath -DestinationPath $TempExtract -Force

# The zip will contain a folder (e.g. NotchNookClone-win32-x64), we want its contents
$ExtractedFolder = Get-ChildItem -Path $TempExtract -Directory | Select-Object -First 1

if ($ExtractedFolder) {
    # Copy all contents from inside that folder directly over the running app directory
    # -Force ensures it overwrites existing files silently
    Copy-Item -Path "$($ExtractedFolder.FullName)\*" -Destination $AppDir -Recurse -Force
}

# Clean up the temporary extracted files and the original downloaded zip
Remove-Item -Path $TempExtract -Recurse -Force
Remove-Item -Path $ZipPath -Force

# Relaunch the newly updated app!
Start-Process -FilePath $ExePath
