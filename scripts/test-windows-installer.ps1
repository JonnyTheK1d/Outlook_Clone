param(
  [Parameter(Mandatory = $true)][string]$Installer,
  [Parameter(Mandatory = $true)][string]$Checksums
)
$ErrorActionPreference = 'Stop'
$installerFile = Get-Item -LiteralPath $Installer
if ($installerFile.Length -lt 10MB) {
  throw 'The download is not a complete installer. It may be a Git LFS pointer or an HTML page.'
}
$stream = [System.IO.File]::OpenRead($installerFile.FullName)
try {
  if ($stream.ReadByte() -ne 0x4D -or $stream.ReadByte() -ne 0x5A) { throw 'Missing Windows executable header (MZ).' }
} finally { $stream.Dispose() }
$checksumLine = Get-Content -LiteralPath $Checksums | Where-Object { $_ -match ('\s' + [regex]::Escape($installerFile.Name) + '$') }
if (-not $checksumLine) { throw 'Installer checksum is missing.' }
$expected = ($checksumLine -split '\s+')[0]
$actual = (Get-FileHash -LiteralPath $installerFile.FullName -Algorithm SHA256).Hash
if ($actual -ne $expected) { throw 'Installer checksum does not match.' }

# Hosted CI runner only. Never run this against a user's installation/profile.
$destination = Join-Path $env:RUNNER_TEMP ('Postblick-test-' + [guid]::NewGuid().ToString('N'))
$application = Join-Path $destination 'Postblick.exe'
$process = $null
try {
  $installation = Start-Process -FilePath $installerFile.FullName -ArgumentList @('/S', "/D=$destination") -PassThru -Wait
  if ($installation.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $application)) { throw 'Windows installer failed.' }
  $process = Start-Process -FilePath $application -PassThru
  $opened = $false
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    Start-Sleep -Seconds 1
    $process.Refresh()
    if ($process.HasExited) { throw "Postblick exited during startup (code $($process.ExitCode))." }
    if ($process.MainWindowHandle -ne 0 -and $process.MainWindowTitle -eq 'Postblick') { $opened = $true; break }
  }
  if (-not $opened) { throw 'The Postblick desktop window did not open.' }
  Stop-Process -Id $process.Id -Force
  $process.WaitForExit()
  $process = $null
  Start-Sleep -Seconds 2
  $marker = Join-Path $destination 'user-file.txt'
  Set-Content -LiteralPath $marker -Value 'This user-owned file must survive uninstallation.'
  $uninstaller = Join-Path $destination 'Uninstall Postblick.exe'
  $uninstallation = Start-Process -FilePath $uninstaller -ArgumentList '/S' -PassThru -Wait
  for ($attempt = 0; $attempt -lt 30 -and (Test-Path -LiteralPath $application); $attempt++) { Start-Sleep -Seconds 1 }
  if (Test-Path -LiteralPath $application) { throw 'Uninstallation did not remove the program.' }
  if (-not (Test-Path -LiteralPath $marker)) { throw 'Uninstallation removed a user-owned file.' }
  "Windows installation, desktop startup and uninstallation passed." | Tee-Object -Variable result
  if ($env:GITHUB_STEP_SUMMARY) { $result | Out-File -FilePath $env:GITHUB_STEP_SUMMARY -Append -Encoding utf8 }
} finally {
  if ($process -and -not $process.HasExited) { Stop-Process -Id $process.Id -Force }
  if (Test-Path -LiteralPath $destination) { Remove-Item -LiteralPath $destination -Recurse -Force }
}
