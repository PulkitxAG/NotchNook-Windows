$pngBytes = [System.IO.File]::ReadAllBytes("C:\Users\pulki\OneDrive\Desktop\AntiGravity\NotchNookNative\icon.png")
$pngSize = $pngBytes.Length
$icoBytes = New-Object byte[] ($pngSize + 22)
$icoBytes[0] = 0; $icoBytes[1] = 0; $icoBytes[2] = 1; $icoBytes[3] = 0; $icoBytes[4] = 1; $icoBytes[5] = 0;
$icoBytes[6] = 0; $icoBytes[7] = 0; $icoBytes[8] = 0; $icoBytes[9] = 0; $icoBytes[10] = 1; $icoBytes[11] = 0;
$icoBytes[12] = 32; $icoBytes[13] = 0;
$icoBytes[14] = [byte]($pngSize -band 0xFF);
$icoBytes[15] = [byte](($pngSize -shr 8) -band 0xFF);
$icoBytes[16] = [byte](($pngSize -shr 16) -band 0xFF);
$icoBytes[17] = [byte](($pngSize -shr 24) -band 0xFF);
$icoBytes[18] = 22; $icoBytes[19] = 0; $icoBytes[20] = 0; $icoBytes[21] = 0;
[System.Array]::Copy($pngBytes, 0, $icoBytes, 22, $pngSize)
[System.IO.File]::WriteAllBytes("C:\Users\pulki\OneDrive\Desktop\AntiGravity\NotchNookNative\icon.ico", $icoBytes)
