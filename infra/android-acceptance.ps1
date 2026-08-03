param(
  [switch]$Visible
)

$ErrorActionPreference = "Stop"
$avdName = "SaleAdvisor_API_36"
$systemImage = "system-images;android-36;google_apis;x86_64"
$sdk = if ($env:ANDROID_SDK_ROOT) {
  $env:ANDROID_SDK_ROOT
} elseif ($env:ANDROID_HOME) {
  $env:ANDROID_HOME
} else {
  Join-Path $env:LOCALAPPDATA "Android\Sdk"
}
$adb = Join-Path $sdk "platform-tools\adb.exe"
$emulator = Join-Path $sdk "emulator\emulator.exe"
$avdManager = Join-Path $sdk "cmdline-tools\latest\bin\avdmanager.bat"
$requiredPaths = @(
  (Join-Path $sdk "platforms\android-36"),
  (Join-Path $sdk "build-tools\36.0.0"),
  (Join-Path $sdk "system-images\android-36\google_apis\x86_64"),
  $adb,
  $emulator,
  $avdManager
)

foreach ($path in $requiredPaths) {
  if (-not (Test-Path -LiteralPath $path)) {
    throw "Android prerequisite is missing: $path"
  }
}

$previousErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = "Continue"
$javaOutput = (& java -version 2>&1) -join "`n"
$javaExitCode = $LASTEXITCODE
$ErrorActionPreference = $previousErrorActionPreference
if ($javaExitCode -ne 0 -or $javaOutput -notmatch 'version "21(?:\.|")') {
  throw "Java 21 is required."
}

$avds = @(& $emulator -list-avds)
if ($avdName -notin $avds) {
  "no" | & $avdManager create avd --name $avdName --package $systemImage --device "pixel_7"
  if ($LASTEXITCODE -ne 0) { throw "Failed to create AVD $avdName." }
}

function Get-SaleAdvisorDevice {
  $serials = & $adb devices | Select-String '^(emulator-\d+)\s+device$' | ForEach-Object {
    $_.Matches[0].Groups[1].Value
  }
  foreach ($serial in $serials) {
    $runningAvd = (& $adb -s $serial emu avd name 2>$null | Select-Object -First 1).Trim()
    if ($runningAvd -eq $avdName) { return $serial }
  }
  return $null
}

$serial = Get-SaleAdvisorDevice
if (-not $serial) {
  $arguments = @("-avd", $avdName, "-no-snapshot-save")
  if (-not $Visible) { $arguments += @("-no-window", "-no-audio") }
  $start = @{
    FilePath = $emulator
    ArgumentList = $arguments
    PassThru = $true
  }
  if (-not $Visible) { $start.WindowStyle = "Hidden" }
  Start-Process @start | Out-Null
}

$deadline = (Get-Date).AddMinutes(4)
do {
  Start-Sleep -Seconds 2
  $serial = Get-SaleAdvisorDevice
  if ($serial) {
    $booted = (& $adb -s $serial shell getprop sys.boot_completed 2>$null).Trim()
    $api = (& $adb -s $serial shell getprop ro.build.version.sdk 2>$null).Trim()
    if ($booted -eq "1" -and $api -eq "36") { break }
  }
} while ((Get-Date) -lt $deadline)

if (-not $serial -or $booted -ne "1" -or $api -ne "36") {
  throw "AVD $avdName did not reach ADB state device on API 36."
}

Write-Output "Android target ready: AVD=$avdName serial=$serial API=$api state=device"
