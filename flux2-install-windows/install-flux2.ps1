[CmdletBinding()]
param(
    [string]$BaseDir = "",
    [string]$BinDir = "",
    [string]$ModelsDir = "",
    [string]$ScriptsDir = "",
    [string]$InputDir = "",
    [string]$OutputDir = "",
    [string]$ListenIp = "",
    [int]$Port = 0,
    [string]$VulkanDevice = "",
    [string]$ReleaseTag = "",
    [switch]$NonInteractive,
    [switch]$SkipFirewall
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = "Stop"

function Write-Section {
    param([string]$Text)
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor DarkGray
    Write-Host $Text -ForegroundColor Cyan
    Write-Host "============================================================" -ForegroundColor DarkGray
}

function Read-WithDefault {
    param(
        [string]$Prompt,
        [string]$Default
    )

    if ($NonInteractive) {
        return $Default
    }

    $value = Read-Host "$Prompt [$Default]"
    if ([string]::IsNullOrWhiteSpace($value)) {
        return $Default
    }
    return $value.Trim()
}

function Read-YesNo {
    param(
        [string]$Prompt,
        [bool]$Default = $true
    )

    if ($NonInteractive) {
        return $Default
    }

    $suffix = if ($Default) { "Y/n" } else { "y/N" }
    $value = Read-Host "$Prompt [$suffix]"

    if ([string]::IsNullOrWhiteSpace($value)) {
        return $Default
    }

    switch -Regex ($value.Trim()) {
        '^(y|yes|д|да)$' { return $true }
        '^(n|no|н|нет)$' { return $false }
        default { return $Default }
    }
}

function Resolve-InstallPath {
    param([string]$PathValue)
    $expanded = [Environment]::ExpandEnvironmentVariables($PathValue)
    return [IO.Path]::GetFullPath($expanded)
}

function Ensure-Directory {
    param([string]$PathValue)
    if (-not (Test-Path -LiteralPath $PathValue)) {
        New-Item -ItemType Directory -Force -Path $PathValue | Out-Null
    }
}

function Assert-Curl {
    $curl = Get-Command curl.exe -ErrorAction SilentlyContinue
    if (-not $curl) {
        throw "curl.exe не найден. На актуальном Windows 10/11 он обычно встроен. Обнови Windows или установи curl и запусти installer снова."
    }
}

function Download-File {
    param(
        [string]$Url,
        [string]$Destination,
        [Int64]$MinBytes,
        [string]$Label
    )

    Ensure-Directory ([IO.Path]::GetDirectoryName($Destination))

    if (Test-Path -LiteralPath $Destination) {
        $existing = Get-Item -LiteralPath $Destination
        if ($existing.Length -ge $MinBytes) {
            Write-Host "SKIP: $Label уже скачан ($([math]::Round($existing.Length / 1MB, 1)) MB)" -ForegroundColor Green
            return
        }
        Write-Host "RESUME: найден частичный файл $Label ($([math]::Round($existing.Length / 1MB, 1)) MB)" -ForegroundColor Yellow
    }

    Write-Host "DOWNLOAD: $Label" -ForegroundColor Cyan
    Write-Host "  $Url" -ForegroundColor DarkGray

    & curl.exe -L --fail --retry 10 --retry-delay 3 --continue-at - --progress-bar --output $Destination $Url
    if ($LASTEXITCODE -ne 0) {
        throw "Ошибка curl при скачивании: $Label"
    }

    if (-not (Test-Path -LiteralPath $Destination)) {
        throw "Файл не появился после скачивания: $Destination"
    }

    $downloaded = Get-Item -LiteralPath $Destination
    if ($downloaded.Length -lt $MinBytes) {
        throw "Файл слишком маленький и, вероятно, скачан некорректно: $Destination ($($downloaded.Length) bytes)"
    }

    Write-Host "OK: $Label ($([math]::Round($downloaded.Length / 1MB, 1)) MB)" -ForegroundColor Green
}

function Get-IsAdmin {
    try {
        $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
        $principal = New-Object Security.Principal.WindowsPrincipal($identity)
        return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    }
    catch {
        return $false
    }
}

function Write-Utf8BomFile {
    param(
        [string]$PathValue,
        [string]$Content
    )
    $utf8Bom = New-Object System.Text.UTF8Encoding($true)
    [IO.File]::WriteAllText($PathValue, $Content, $utf8Bom)
}

function Write-AsciiFile {
    param(
        [string]$PathValue,
        [string]$Content
    )
    [IO.File]::WriteAllText($PathValue, $Content, [Text.Encoding]::ASCII)
}

if ($env:OS -ne "Windows_NT") {
    throw "Этот installer предназначен только для Windows."
}

Write-Host ""
Write-Host "Iron Arcana - FLUX.2 Klein 4B / stable-diffusion.cpp Vulkan installer" -ForegroundColor Magenta
Write-Host "Windows 10/11, локальный GPU server" -ForegroundColor DarkGray

Assert-Curl

# -----------------------------------------------------------------------------
# Interactive configuration
# -----------------------------------------------------------------------------

$baseDefault = if ([string]::IsNullOrWhiteSpace($BaseDir)) { "C:\AI" } else { $BaseDir }
$BaseDir = Resolve-InstallPath (Read-WithDefault "Корневая папка установки" $baseDefault)

$binDefault = if ([string]::IsNullOrWhiteSpace($BinDir)) { Join-Path $BaseDir "sd-flux2" } else { $BinDir }
$BinDir = Resolve-InstallPath (Read-WithDefault "Папка stable-diffusion.cpp (exe/dll)" $binDefault)

$modelsDefault = if ([string]::IsNullOrWhiteSpace($ModelsDir)) { Join-Path $BaseDir "models\flux2\klein4b" } else { $ModelsDir }
$ModelsDir = Resolve-InstallPath (Read-WithDefault "Папка моделей FLUX.2" $modelsDefault)

$scriptsDefault = if ([string]::IsNullOrWhiteSpace($ScriptsDir)) { Join-Path $BaseDir "scripts\flux2" } else { $ScriptsDir }
$ScriptsDir = Resolve-InstallPath (Read-WithDefault "Папка runtime-скриптов" $scriptsDefault)

$inputDefault = if ([string]::IsNullOrWhiteSpace($InputDir)) { Join-Path $BaseDir "input" } else { $InputDir }
$InputDir = Resolve-InstallPath (Read-WithDefault "Папка входных/reference изображений" $inputDefault)

$outputDefault = if ([string]::IsNullOrWhiteSpace($OutputDir)) { Join-Path $BaseDir "output\flux2" } else { $OutputDir }
$OutputDir = Resolve-InstallPath (Read-WithDefault "Папка тестовых результатов" $outputDefault)

$listenDefault = if ([string]::IsNullOrWhiteSpace($ListenIp)) { "0.0.0.0" } else { $ListenIp }
$ListenIp = Read-WithDefault "IP, на котором слушать API server" $listenDefault

if ($Port -le 0) {
    $portText = Read-WithDefault "TCP порт API server" "7861"
    $parsedPort = 0
    if (-not [int]::TryParse($portText, [ref]$parsedPort)) {
        throw "Некорректный порт: $portText"
    }
    $Port = $parsedPort
}
if ($Port -lt 1 -or $Port -gt 65535) {
    throw "Порт должен быть в диапазоне 1..65535"
}

$releaseDefault = if ([string]::IsNullOrWhiteSpace($ReleaseTag)) { "master-820-de298c2" } else { $ReleaseTag }
$ReleaseTag = Read-WithDefault "stable-diffusion.cpp release (latest или конкретный tag)" $releaseDefault

$addFirewall = $false
if (-not $SkipFirewall) {
    $addFirewall = Read-YesNo "Добавить Windows Firewall rule для LAN-доступа к порту $Port" $true
}

Write-Section "Параметры установки"
Write-Host "Base:       $BaseDir"
Write-Host "Binaries:   $BinDir"
Write-Host "Models:     $ModelsDir"
Write-Host "Scripts:    $ScriptsDir"
Write-Host "Input:      $InputDir"
Write-Host "Output:     $OutputDir"
Write-Host "Listen:     $ListenIp`:$Port"
Write-Host "Release:    $ReleaseTag"
Write-Host "Firewall:   $addFirewall"

if (-not $NonInteractive) {
    $proceed = Read-YesNo "Продолжить установку" $true
    if (-not $proceed) {
        Write-Host "Отменено пользователем."
        exit 0
    }
}

# -----------------------------------------------------------------------------
# Paths / URLs
# -----------------------------------------------------------------------------

$DownloadsDir = Join-Path $BaseDir "downloads\flux2"
$TempDir = Join-Path $BaseDir "temp\flux2-installer"
$DiffusionDir = Join-Path $ModelsDir "diffusion"
$TextEncoderDir = Join-Path $ModelsDir "text_encoder"
$VaeDir = Join-Path $ModelsDir "vae"

$FluxModel = Join-Path $DiffusionDir "flux-2-klein-4b-Q4_0.gguf"
$QwenModel = Join-Path $TextEncoderDir "Qwen3-4B-Q4_K_M.gguf"
$VaeModel = Join-Path $VaeDir "full_encoder_small_decoder.safetensors"

$FluxUrl = "https://huggingface.co/leejet/FLUX.2-klein-4B-GGUF/resolve/main/flux-2-klein-4b-Q4_0.gguf?download=true"
$QwenUrl = "https://huggingface.co/unsloth/Qwen3-4B-GGUF/resolve/main/Qwen3-4B-Q4_K_M.gguf?download=true"
$VaeUrl = "https://huggingface.co/black-forest-labs/FLUX.2-small-decoder/resolve/main/full_encoder_small_decoder.safetensors?download=true"

foreach ($dir in @($BaseDir, $BinDir, $ModelsDir, $ScriptsDir, $InputDir, $OutputDir, $DownloadsDir, $TempDir, $DiffusionDir, $TextEncoderDir, $VaeDir)) {
    Ensure-Directory $dir
}

# -----------------------------------------------------------------------------
# Resolve stable-diffusion.cpp release and Windows Vulkan asset
# -----------------------------------------------------------------------------

Write-Section "stable-diffusion.cpp Vulkan"

if ($ReleaseTag -eq "latest") {
    $releaseApiUrl = "https://api.github.com/repos/leejet/stable-diffusion.cpp/releases/latest"
}
else {
    $encodedTag = [Uri]::EscapeDataString($ReleaseTag)
    $releaseApiUrl = "https://api.github.com/repos/leejet/stable-diffusion.cpp/releases/tags/$encodedTag"
}

Write-Host "GitHub API: $releaseApiUrl" -ForegroundColor DarkGray
$releaseRaw = (& curl.exe -fsSL --retry 5 --retry-delay 2 $releaseApiUrl | Out-String)
if ($LASTEXITCODE -ne 0) {
    throw "Не удалось получить release metadata с GitHub API."
}

$release = $releaseRaw | ConvertFrom-Json
$asset = $release.assets |
    Where-Object { $_.name -match 'bin-win-vulkan-x64\.zip$' } |
    Select-Object -First 1

if (-not $asset) {
    Write-Host "Доступные assets:" -ForegroundColor Yellow
    $release.assets | ForEach-Object { Write-Host "  $($_.name)" }
    throw "Не найден asset *bin-win-vulkan-x64.zip. Возможно, upstream изменил имя Windows Vulkan сборки."
}

$resolvedReleaseTag = [string]$release.tag_name
$sdZip = Join-Path $DownloadsDir ([string]$asset.name)
Write-Host "Release: $resolvedReleaseTag" -ForegroundColor Green
Write-Host "Asset:   $($asset.name)" -ForegroundColor Green

Download-File -Url ([string]$asset.browser_download_url) -Destination $sdZip -MinBytes 1000000 -Label "stable-diffusion.cpp Windows Vulkan"

Write-Host "Распаковка stable-diffusion.cpp..." -ForegroundColor Cyan
if (Test-Path -LiteralPath $TempDir) {
    Remove-Item -LiteralPath $TempDir -Recurse -Force
}
Ensure-Directory $TempDir
Expand-Archive -LiteralPath $sdZip -DestinationPath $TempDir -Force

$sdCliFound = Get-ChildItem -LiteralPath $TempDir -Recurse -Filter "sd-cli.exe" | Select-Object -First 1
if (-not $sdCliFound) {
    throw "В архиве не найден sd-cli.exe"
}

$sourceBinDir = $sdCliFound.Directory.FullName
Write-Host "Bin source: $sourceBinDir" -ForegroundColor DarkGray
Copy-Item -Path (Join-Path $sourceBinDir "*") -Destination $BinDir -Recurse -Force

$SdCliExe = Join-Path $BinDir "sd-cli.exe"
$SdServerExe = Join-Path $BinDir "sd-server.exe"
if (-not (Test-Path -LiteralPath $SdCliExe)) { throw "Не найден $SdCliExe" }
if (-not (Test-Path -LiteralPath $SdServerExe)) { throw "Не найден $SdServerExe" }

Write-Host "OK: stable-diffusion.cpp установлен" -ForegroundColor Green

# -----------------------------------------------------------------------------
# Models
# -----------------------------------------------------------------------------

Write-Section "Модели"
Download-File -Url $FluxUrl -Destination $FluxModel -MinBytes 2000000000 -Label "FLUX.2 Klein 4B Q4_0"
Download-File -Url $QwenUrl -Destination $QwenModel -MinBytes 2000000000 -Label "Qwen3-4B Q4_K_M text encoder"
Download-File -Url $VaeUrl -Destination $VaeModel -MinBytes 200000000 -Label "FLUX.2 full encoder + small decoder VAE"

# -----------------------------------------------------------------------------
# Device detection
# -----------------------------------------------------------------------------

Write-Section "GPU / Vulkan devices"
$deviceOutput = ""
try {
    $deviceOutput = (& $SdCliExe --list-devices 2>&1 | Out-String)
    Write-Host $deviceOutput
}
catch {
    Write-Warning "Не удалось выполнить --list-devices: $($_.Exception.Message)"
}

$vulkanDefault = if ([string]::IsNullOrWhiteSpace($VulkanDevice)) { "vulkan0" } else { $VulkanDevice }
$VulkanDevice = Read-WithDefault "Vulkan device для diffusion" $vulkanDefault

if (-not [string]::IsNullOrWhiteSpace($deviceOutput) -and $deviceOutput -notmatch [regex]::Escape($VulkanDevice)) {
    Write-Warning "В выводе --list-devices не найдено '$VulkanDevice'. Проверь имя устройства выше. Скрипты всё равно будут созданы."
}

# -----------------------------------------------------------------------------
# Runtime config and generated scripts
# -----------------------------------------------------------------------------

Write-Section "Создание runtime-скриптов"

$config = [ordered]@{
    schemaVersion = 1
    installedAt = (Get-Date).ToString("o")
    stableDiffusionCpp = [ordered]@{
        releaseTag = $resolvedReleaseTag
        binaryDir = $BinDir
        sdCli = $SdCliExe
        sdServer = $SdServerExe
    }
    models = [ordered]@{
        root = $ModelsDir
        diffusion = $FluxModel
        llm = $QwenModel
        vae = $VaeModel
    }
    runtime = [ordered]@{
        vulkanDevice = $VulkanDevice
        listenIp = $ListenIp
        port = $Port
        backend = "diffusion=$VulkanDevice,te=cpu,vae=cpu"
        cfgScale = 1.0
        steps = 4
        samplingMethod = "euler"
        diffusionFa = $true
    }
    folders = [ordered]@{
        input = $InputDir
        output = $OutputDir
        scripts = $ScriptsDir
        downloads = $DownloadsDir
    }
    downloadUrls = [ordered]@{
        stableDiffusionCppReleaseApi = $releaseApiUrl
        stableDiffusionCppAsset = [string]$asset.browser_download_url
        flux2 = $FluxUrl
        qwen3 = $QwenUrl
        vae = $VaeUrl
    }
}

$configPath = Join-Path $ScriptsDir "flux2-config.json"
$config | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $configPath -Encoding UTF8

$runServerPs1 = @'
Set-StrictMode -Version 2.0
$ErrorActionPreference = "Stop"

$configPath = Join-Path $PSScriptRoot "flux2-config.json"
if (-not (Test-Path -LiteralPath $configPath)) {
    throw "Config not found: $configPath"
}

$config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
$server = [string]$config.stableDiffusionCpp.sdServer

if (-not (Test-Path -LiteralPath $server)) {
    throw "sd-server.exe not found: $server"
}

$backend = [string]$config.runtime.backend

Write-Host ""
Write-Host "============================================================" -ForegroundColor DarkGray
Write-Host "FLUX.2 Klein 4B API server" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor DarkGray
Write-Host "Server:  $($config.runtime.listenIp):$($config.runtime.port)"
Write-Host "Backend: $backend"
Write-Host "Model:   $($config.models.diffusion)"
Write-Host "LLM:     $($config.models.llm)"
Write-Host "VAE:     $($config.models.vae)"
Write-Host ""
Write-Host "Stop server: Ctrl+C" -ForegroundColor Yellow
Write-Host ""

$arguments = @(
    "--listen-ip", [string]$config.runtime.listenIp,
    "--listen-port", [string]$config.runtime.port,
    "--diffusion-model", [string]$config.models.diffusion,
    "--llm", [string]$config.models.llm,
    "--vae", [string]$config.models.vae,
    "--backend", $backend,
    "--cfg-scale", [string]$config.runtime.cfgScale,
    "--steps", [string]$config.runtime.steps,
    "--sampling-method", [string]$config.runtime.samplingMethod,
    "--diffusion-fa",
    "-v"
)

& $server @arguments
exit $LASTEXITCODE
'@
Write-Utf8BomFile -PathValue (Join-Path $ScriptsDir "run-flux2-server.ps1") -Content $runServerPs1

$testPs1 = @'
Set-StrictMode -Version 2.0
$ErrorActionPreference = "Stop"
$config = Get-Content -LiteralPath (Join-Path $PSScriptRoot "flux2-config.json") -Raw | ConvertFrom-Json
$cli = [string]$config.stableDiffusionCpp.sdCli
$out = Join-Path ([string]$config.folders.output) "flux2-install-test.png"
$backend = [string]$config.runtime.backend

$arguments = @(
    "--diffusion-model", [string]$config.models.diffusion,
    "--llm", [string]$config.models.llm,
    "--vae", [string]$config.models.vae,
    "--backend", $backend,
    "--cfg-scale", "1.0",
    "--steps", "4",
    "--sampling-method", "euler",
    "--diffusion-fa",
    "-W", "512",
    "-H", "512",
    "--seed", "42",
    "-p", "a small brown fantasy rat, full body visible, neutral background, game asset concept art",
    "-o", $out,
    "-v"
)

Write-Host "Generating test image: $out" -ForegroundColor Cyan
& $cli @arguments
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "DONE: $out" -ForegroundColor Green
'@
Write-Utf8BomFile -PathValue (Join-Path $ScriptsDir "test-flux2.ps1") -Content $testPs1

$checkPs1 = @'
Set-StrictMode -Version 2.0
$ErrorActionPreference = "Stop"
$config = Get-Content -LiteralPath (Join-Path $PSScriptRoot "flux2-config.json") -Raw | ConvertFrom-Json
$url = "http://127.0.0.1:$($config.runtime.port)/v1/models"
Write-Host "GET $url" -ForegroundColor Cyan
& curl.exe -f -sS $url
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    throw "Server is not reachable on localhost. Start run-flux2-server.bat first."
}
Write-Host ""
Write-Host "OK" -ForegroundColor Green
'@
Write-Utf8BomFile -PathValue (Join-Path $ScriptsDir "check-flux2-server.ps1") -Content $checkPs1

$runBat = '@echo off' + "`r`n" + 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0run-flux2-server.ps1"' + "`r`n" + 'pause' + "`r`n"
$testBat = '@echo off' + "`r`n" + 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0test-flux2.ps1"' + "`r`n" + 'pause' + "`r`n"
$checkBat = '@echo off' + "`r`n" + 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0check-flux2-server.ps1"' + "`r`n" + 'pause' + "`r`n"

Write-AsciiFile -PathValue (Join-Path $ScriptsDir "run-flux2-server.bat") -Content $runBat
Write-AsciiFile -PathValue (Join-Path $ScriptsDir "test-flux2.bat") -Content $testBat
Write-AsciiFile -PathValue (Join-Path $ScriptsDir "check-flux2-server.bat") -Content $checkBat

# -----------------------------------------------------------------------------
# Firewall
# -----------------------------------------------------------------------------

if ($addFirewall) {
    Write-Section "Windows Firewall"
    if (Get-IsAdmin) {
        $ruleName = "Iron Arcana FLUX2 sd.cpp port $Port"
        $oldRule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
        if ($oldRule) {
            Remove-NetFirewallRule -DisplayName $ruleName | Out-Null
        }
        New-NetFirewallRule `
            -DisplayName $ruleName `
            -Direction Inbound `
            -Action Allow `
            -Protocol TCP `
            -LocalPort $Port `
            -Profile Private `
            -RemoteAddress LocalSubnet | Out-Null
        Write-Host "OK: firewall rule создан для Private profile + LocalSubnet" -ForegroundColor Green
    }
    else {
        Write-Warning "Installer запущен не от администратора, поэтому firewall rule не создан."
        Write-Host "Запусти PowerShell от администратора и выполни:" -ForegroundColor Yellow
        Write-Host "New-NetFirewallRule -DisplayName 'Iron Arcana FLUX2 sd.cpp port $Port' -Direction Inbound -Action Allow -Protocol TCP -LocalPort $Port -Profile Private -RemoteAddress LocalSubnet" -ForegroundColor White
    }
}

# -----------------------------------------------------------------------------
# Final manifest / instructions
# -----------------------------------------------------------------------------

$manifestPath = Join-Path $ScriptsDir "install-manifest.json"
$config | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $manifestPath -Encoding UTF8

$lanIps = @()
try {
    $lanIps = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
        Where-Object {
            $_.IPAddress -notmatch '^127\.' -and
            $_.IPAddress -notmatch '^169\.254\.'
        } |
        Select-Object -ExpandProperty IPAddress -Unique
}
catch {
    # Optional only.
}

Write-Section "ГОТОВО"
Write-Host "Runtime scripts: $ScriptsDir" -ForegroundColor Green
Write-Host "Config:          $configPath"
Write-Host "Manifest:        $manifestPath"
Write-Host ""
Write-Host "1) Тест генерации:" -ForegroundColor Cyan
Write-Host "   `"$(Join-Path $ScriptsDir 'test-flux2.bat')`""
Write-Host ""
Write-Host "2) Запуск API server:" -ForegroundColor Cyan
Write-Host "   `"$(Join-Path $ScriptsDir 'run-flux2-server.bat')`""
Write-Host ""
Write-Host "3) Проверка на Windows:" -ForegroundColor Cyan
Write-Host "   curl.exe http://127.0.0.1:$Port/v1/models"
Write-Host ""

if ($lanIps.Count -gt 0) {
    Write-Host "4) Возможные URL для Mac/LAN:" -ForegroundColor Cyan
    foreach ($ip in $lanIps) {
        Write-Host "   http://$ip`:$Port/v1/models"
    }
}
else {
    Write-Host "4) С Mac: curl http://<WINDOWS_LAN_IP>:$Port/v1/models" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "API edit endpoint:" -ForegroundColor Cyan
Write-Host "   POST http://<WINDOWS_LAN_IP>:$Port/v1/images/edits"
Write-Host ""
Write-Host "Если скачивание когда-нибудь оборвётся — просто запусти installer повторно: большие файлы докачиваются через curl -C -." -ForegroundColor DarkGray
