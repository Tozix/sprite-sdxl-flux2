# Iron Arcana — FLUX.2 Klein 4B на Windows 10/11 через stable-diffusion.cpp + Vulkan

> Полная инструкция для повторного развёртывания локального FLUX.2 image-edit/generation сервера на Windows.  
> Цель: Windows работает как GPU-сервер, а Mac/другая машина в локальной сети отправляет запросы по HTTP API и получает изображения обратно.

## 0. Что именно разворачиваем

Наша проверенная конфигурация:

- **stable-diffusion.cpp**, готовая Windows x64 **Vulkan** сборка;
- **FLUX.2 Klein 4B**, GGUF `Q4_0`;
- **Qwen3-4B**, GGUF `Q4_K_M`, как text encoder/LLM;
- **FLUX.2 Small Decoder**, файл `full_encoder_small_decoder.safetensors`;
- diffusion выполняется на Vulkan GPU;
- text encoder и VAE выполняются на CPU;
- API server слушает по умолчанию `0.0.0.0:7861`;
- с Mac используется OpenAI-compatible API:
  - `GET /v1/models`
  - `POST /v1/images/generations`
  - `POST /v1/images/edits`

Изначально эта конфигурация подбиралась под:

- Windows 10;
- AMD Radeon RX 6600 XT 8 GB;
- 32 GB RAM;
- Mac и Windows в одной LAN.

На другой машине имя Vulkan device может отличаться (`vulkan0`, `vulkan1` и т. п.), поэтому installer показывает `--list-devices` и спрашивает устройство.

---

# 1. Что лежит в этом комплекте

```text
iron-arcana-flux2-windows/
├── README_FLUX2_WINDOWS.md
├── install-flux2.bat
└── install-flux2.ps1
```

Главный файл — `install-flux2.ps1`.

`install-flux2.bat` — удобная обёртка, чтобы можно было просто запустить installer двойным кликом или из CMD/PowerShell.

Installer:

1. спрашивает пути;
2. создаёт каталоги;
3. через GitHub API находит Windows Vulkan build `stable-diffusion.cpp`;
4. скачивает ZIP;
5. распаковывает `sd-cli.exe`, `sd-server.exe` и DLL;
6. скачивает FLUX.2;
7. скачивает Qwen3;
8. скачивает VAE;
9. показывает Vulkan devices;
10. спрашивает, какой Vulkan device использовать;
11. создаёт конфиг;
12. создаёт скрипт запуска сервера;
13. создаёт тестовый скрипт генерации;
14. создаёт скрипт проверки сервера;
15. при запуске от администратора может создать firewall rule для LAN;
16. пишет итоговые команды запуска.

---

# 2. Нужные прямые URL

Эти URL уже зашиты в installer. Руками по сайтам ходить не требуется.

## stable-diffusion.cpp

GitHub repository:

```text
https://github.com/leejet/stable-diffusion.cpp
```

Latest release metadata API:

```text
https://api.github.com/repos/leejet/stable-diffusion.cpp/releases/latest
```

Installer из JSON автоматически выбирает asset с именем вида:

```text
*bin-win-vulkan-x64.zip
```

То есть имя конкретного ZIP не зашито намертво и installer может брать свежую Vulkan-сборку.

Официальные releases:

```text
https://github.com/leejet/stable-diffusion.cpp/releases
```

## FLUX.2 Klein 4B Q4_0

Repository:

```text
https://huggingface.co/leejet/FLUX.2-klein-4B-GGUF
```

Прямой файл:

```text
https://huggingface.co/leejet/FLUX.2-klein-4B-GGUF/resolve/main/flux-2-klein-4b-Q4_0.gguf?download=true
```

Локальное имя:

```text
flux-2-klein-4b-Q4_0.gguf
```

Ориентировочный размер: ~2.46 GB.

## Qwen3-4B Q4_K_M

Repository:

```text
https://huggingface.co/unsloth/Qwen3-4B-GGUF
```

Прямой файл:

```text
https://huggingface.co/unsloth/Qwen3-4B-GGUF/resolve/main/Qwen3-4B-Q4_K_M.gguf?download=true
```

Локальное имя:

```text
Qwen3-4B-Q4_K_M.gguf
```

## FLUX.2 Small Decoder

Repository:

```text
https://huggingface.co/black-forest-labs/FLUX.2-small-decoder
```

Прямой файл:

```text
https://huggingface.co/black-forest-labs/FLUX.2-small-decoder/resolve/main/full_encoder_small_decoder.safetensors?download=true
```

Локальное имя:

```text
full_encoder_small_decoder.safetensors
```

Ориентировочный размер: ~250 MB.

---

# 3. Самый простой способ установки

Скопируй весь каталог `iron-arcana-flux2-windows` на Windows.

Например:

```text
C:\IronArcana\tools\flux2-windows\
```

Открой **PowerShell от администратора**, если хочешь, чтобы installer сам создал firewall rule.

Перейди в папку:

```powershell
cd C:\IronArcana\tools\flux2-windows
```

Запусти:

```powershell
.\install-flux2.bat
```

Либо напрямую:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\install-flux2.ps1
```

---

# 4. Какие вопросы задаёт installer

Пример с дефолтами:

```text
Корневая папка установки [C:\AI]
Папка stable-diffusion.cpp (exe/dll) [C:\AI\sd-flux2]
Папка моделей FLUX.2 [C:\AI\models\flux2\klein4b]
Папка runtime-скриптов [C:\AI\scripts\flux2]
Папка входных/reference изображений [C:\AI\input]
Папка тестовых результатов [C:\AI\output\flux2]
IP, на котором слушать API server [0.0.0.0]
TCP порт API server [7861]
stable-diffusion.cpp release (latest или конкретный tag) [master-820-de298c2]
Добавить Windows Firewall rule ... [Y/n]
```

После скачивания binaries он выполняет:

```powershell
sd-cli.exe --list-devices
```

и спрашивает:

```text
Vulkan device для diffusion [vulkan0]
```

Для RX 6600 XT на нашей исходной машине использовался:

```text
vulkan0
```

Но на компьютере с несколькими GPU смотри вывод `--list-devices`.

---

# 5. Рекомендуемая структура каталогов

При дефолтном `C:\AI` получается:

```text
C:\AI\
├── sd-flux2\
│   ├── sd-cli.exe
│   ├── sd-server.exe
│   ├── ggml*.dll
│   └── ...
│
├── models\
│   └── flux2\
│       └── klein4b\
│           ├── diffusion\
│           │   └── flux-2-klein-4b-Q4_0.gguf
│           ├── text_encoder\
│           │   └── Qwen3-4B-Q4_K_M.gguf
│           └── vae\
│               └── full_encoder_small_decoder.safetensors
│
├── scripts\
│   └── flux2\
│       ├── flux2-config.json
│       ├── install-manifest.json
│       ├── run-flux2-server.ps1
│       ├── run-flux2-server.bat
│       ├── test-flux2.ps1
│       ├── test-flux2.bat
│       ├── check-flux2-server.ps1
│       └── check-flux2-server.bat
│
├── input\
│
├── output\
│   └── flux2\
│
├── downloads\
│   └── flux2\
│
└── temp\
    └── flux2-installer\
```

Ты можешь выбрать вообще другие пути. Например:

```text
D:\AI-BIN\sd-flux2
E:\AI-MODELS\flux2\klein4b
D:\IronArcana\scripts\flux2
```

Installer запишет абсолютные пути в `flux2-config.json`.

---

# 6. Что именно запускает server

Runtime-конфигурация по умолчанию эквивалентна примерно такой команде:

```powershell
C:\AI\sd-flux2\sd-server.exe `
  --listen-ip 0.0.0.0 `
  --listen-port 7861 `
  --diffusion-model C:\AI\models\flux2\klein4b\diffusion\flux-2-klein-4b-Q4_0.gguf `
  --llm C:\AI\models\flux2\klein4b\text_encoder\Qwen3-4B-Q4_K_M.gguf `
  --vae C:\AI\models\flux2\klein4b\vae\full_encoder_small_decoder.safetensors `
  --backend diffusion=vulkan0,te=cpu,vae=cpu `
  --cfg-scale 1.0 `
  --steps 4 `
  --sampling-method euler `
  --diffusion-fa `
  -v
```

Почему так:

```text
diffusion -> Vulkan GPU
text encoder / Qwen3 -> CPU
VAE -> CPU
```

Это уменьшает давление на VRAM у видеокарт класса 8 GB.

---

# 7. Запуск тестовой генерации

После installer:

```powershell
C:\AI\scripts\flux2\test-flux2.bat
```

Или, если ты выбрал другой ScriptsDir, запускай `test-flux2.bat` из него.

Скрипт создаёт:

```text
<OutputDir>\flux2-install-test.png
```

Параметры теста:

```text
512x512
4 steps
Euler
CFG 1.0
seed 42
```

Если PNG появился — модель и CLI работают.

---

# 8. Запуск API server

Запуск:

```powershell
C:\AI\scripts\flux2\run-flux2-server.bat
```

Окно не закрывать.

Остановка:

```text
Ctrl+C
```

По дефолту server доступен:

```text
http://127.0.0.1:7861
```

и по LAN IP Windows:

```text
http://WINDOWS_IP:7861
```

если:

- `listen-ip = 0.0.0.0`;
- Windows network profile = Private;
- firewall пропускает TCP 7861.

---

# 9. Проверка сервера на Windows

В отдельном PowerShell:

```powershell
curl.exe http://127.0.0.1:7861/v1/models
```

Или готовым скриптом:

```powershell
C:\AI\scripts\flux2\check-flux2-server.bat
```

Ожидается JSON с моделью `sd-cpp-local`.

---

# 10. Узнать LAN IP Windows

PowerShell:

```powershell
Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object {
    $_.IPAddress -notmatch '^127\.' -and
    $_.IPAddress -notmatch '^169\.254\.'
  } |
  Select-Object InterfaceAlias, IPAddress
```

Для нашей исходной машины это было примерно:

```text
192.168.0.14
```

На другой машине адрес будет другой.

---

# 11. Проверка с Mac

Допустим Windows имеет IP:

```text
192.168.0.14
```

На Mac:

```bash
curl http://192.168.0.14:7861/v1/models
```

Если получен JSON — Mac видит GPU server.

---

# 12. Text-to-image через API с Mac

```bash
curl -sS \
  -X POST "http://192.168.0.14:7861/v1/images/generations" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "a small brown fantasy rat, full body, neutral background",
    "size": "512x512",
    "n": 1,
    "output_format": "png"
  }' \
  > response.json
```

Ответ содержит:

```text
data[0].b64_json
```

Декодирование через Node.js на Mac:

```bash
node -e '
const fs = require("fs");
const json = JSON.parse(fs.readFileSync("response.json", "utf8"));
fs.writeFileSync("result.png", Buffer.from(json.data[0].b64_json, "base64"));
console.log("result.png");
'
```

Открыть:

```bash
open result.png
```

---

# 13. Image edit / reference image через API с Mac

Это основной endpoint для нашего pipeline:

```text
POST /v1/images/edits
```

Пример:

```bash
curl -sS \
  -X POST "http://192.168.0.14:7861/v1/images/edits" \
  -F 'image[]=@./rat-left.png' \
  -F 'prompt=Keep exactly the same rat from the reference image. Preserve identity, proportions, fur color, ears, legs and tail. Rotate the rat into a rear view. The rat faces directly away from the viewer, north/up in a top-down 2D RPG. Full body visible. Plain neutral background.' \
  -F 'size=512x512' \
  -F 'n=1' \
  -F 'output_format=png' \
  > rat-up-response.json
```

Декодировать:

```bash
node -e '
const fs = require("fs");
const json = JSON.parse(fs.readFileSync("rat-up-response.json", "utf8"));
fs.writeFileSync("rat-up.png", Buffer.from(json.data[0].b64_json, "base64"));
console.log("rat-up.png");
'
```

Открыть:

```bash
open rat-up.png
```

---

# 14. Передача seed / steps / sampler через API

OpenAI-compatible endpoint поддерживает дополнительные native параметры `stable-diffusion.cpp` через блок:

```text
<sd_cpp_extra_args>...</sd_cpp_extra_args>
```

Пример prompt:

```text
Keep the same rat and rotate it to rear view.
<sd_cpp_extra_args>{"seed":42,"sample_params":{"sample_steps":4,"sample_method":"euler","guidance":{"txt_cfg":1.0}}}</sd_cpp_extra_args>
```

Это удобно для Node.js pipeline на Mac, потому что можно воспроизводимо перебирать seeds.

---

# 15. Ручная установка без installer — только PowerShell/curl

Ниже запасной путь, если нужно проверить installer или сделать всё вручную.

## 15.1 Создать папки

```powershell
$ROOT = "C:\AI"

New-Item -ItemType Directory -Force "$ROOT\sd-flux2" | Out-Null
New-Item -ItemType Directory -Force "$ROOT\downloads\flux2" | Out-Null
New-Item -ItemType Directory -Force "$ROOT\temp\flux2" | Out-Null
New-Item -ItemType Directory -Force "$ROOT\models\flux2\klein4b\diffusion" | Out-Null
New-Item -ItemType Directory -Force "$ROOT\models\flux2\klein4b\text_encoder" | Out-Null
New-Item -ItemType Directory -Force "$ROOT\models\flux2\klein4b\vae" | Out-Null
New-Item -ItemType Directory -Force "$ROOT\scripts\flux2" | Out-Null
New-Item -ItemType Directory -Force "$ROOT\input" | Out-Null
New-Item -ItemType Directory -Force "$ROOT\output\flux2" | Out-Null
```

## 15.2 Скачать latest Windows Vulkan build stable-diffusion.cpp

```powershell
$releaseJson = (curl.exe -fsSL "https://api.github.com/repos/leejet/stable-diffusion.cpp/releases/latest" | Out-String)
$release = $releaseJson | ConvertFrom-Json

$asset = $release.assets |
  Where-Object { $_.name -match 'bin-win-vulkan-x64\.zip$' } |
  Select-Object -First 1

if (-not $asset) {
  $release.assets.name
  throw "Windows Vulkan asset not found"
}

$zip = "C:\AI\downloads\flux2\$($asset.name)"

curl.exe -L `
  --fail `
  --retry 10 `
  --retry-delay 3 `
  -C - `
  --progress-bar `
  -o "$zip" `
  "$($asset.browser_download_url)"
```

Распаковать:

```powershell
Remove-Item "C:\AI\temp\flux2\*" -Recurse -Force -ErrorAction SilentlyContinue
Expand-Archive -Path "$zip" -DestinationPath "C:\AI\temp\flux2" -Force

$cli = Get-ChildItem "C:\AI\temp\flux2" -Recurse -Filter sd-cli.exe | Select-Object -First 1
Copy-Item "$($cli.Directory.FullName)\*" "C:\AI\sd-flux2\" -Recurse -Force
```

## 15.3 Скачать FLUX.2

```powershell
curl.exe -L `
  --fail `
  --retry 10 `
  --retry-delay 3 `
  -C - `
  --progress-bar `
  -o "C:\AI\models\flux2\klein4b\diffusion\flux-2-klein-4b-Q4_0.gguf" `
  "https://huggingface.co/leejet/FLUX.2-klein-4B-GGUF/resolve/main/flux-2-klein-4b-Q4_0.gguf?download=true"
```

## 15.4 Скачать Qwen3

```powershell
curl.exe -L `
  --fail `
  --retry 10 `
  --retry-delay 3 `
  -C - `
  --progress-bar `
  -o "C:\AI\models\flux2\klein4b\text_encoder\Qwen3-4B-Q4_K_M.gguf" `
  "https://huggingface.co/unsloth/Qwen3-4B-GGUF/resolve/main/Qwen3-4B-Q4_K_M.gguf?download=true"
```

## 15.5 Скачать VAE

```powershell
curl.exe -L `
  --fail `
  --retry 10 `
  --retry-delay 3 `
  -C - `
  --progress-bar `
  -o "C:\AI\models\flux2\klein4b\vae\full_encoder_small_decoder.safetensors" `
  "https://huggingface.co/black-forest-labs/FLUX.2-small-decoder/resolve/main/full_encoder_small_decoder.safetensors?download=true"
```

## 15.6 Проверить Vulkan

```powershell
& "C:\AI\sd-flux2\sd-cli.exe" --list-devices
```

---

# 16. Firewall вручную

Запускать PowerShell **от администратора**:

```powershell
New-NetFirewallRule `
  -DisplayName "Iron Arcana FLUX2 sd.cpp port 7861" `
  -Direction Inbound `
  -Action Allow `
  -Protocol TCP `
  -LocalPort 7861 `
  -Profile Private `
  -RemoteAddress LocalSubnet
```

Правило специально ограничено:

```text
Profile = Private
RemoteAddress = LocalSubnet
```

То есть не нужно открывать API всему интернету.

---

# 17. Автоматическая установка без вопросов

Если надо развернуть машину полностью из CI/скрипта:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\install-flux2.ps1 `
  -NonInteractive `
  -BaseDir "C:\AI" `
  -BinDir "C:\AI\sd-flux2" `
  -ModelsDir "C:\AI\models\flux2\klein4b" `
  -ScriptsDir "C:\AI\scripts\flux2" `
  -InputDir "C:\AI\input" `
  -OutputDir "C:\AI\output\flux2" `
  -ListenIp "0.0.0.0" `
  -Port 7861 `
  -VulkanDevice "vulkan0" `
  -ReleaseTag "master-820-de298c2"
```

Если firewall не нужен:

```powershell
-SkipFirewall
```

---

# 18. Как зафиксировать версию stable-diffusion.cpp

По умолчанию installer использует зафиксированный release, на котором собран этот deployment bundle:

```text
master-820-de298c2
```

Это сделано специально для воспроизводимости: upstream активно развивается и CLI/API могут меняться. Если сознательно хочешь обновиться на самую свежую сборку, введи `latest` в соответствующем вопросе installer.

Для воспроизводимого production setup можно указать конкретный release tag.

Пример:

```text
master-820-de298c2
```

Interactive installer спросит:

```text
stable-diffusion.cpp release (latest или конкретный tag)
```

Либо non-interactive:

```powershell
-ReleaseTag "master-820-de298c2"
```

После установки реальный использованный tag сохраняется в:

```text
flux2-config.json
install-manifest.json
```

Поэтому всегда можно понять, на какой сборке машина была развёрнута.

---

# 19. Повторный запуск installer

Installer рассчитан на повторный запуск.

Для больших моделей используется curl resume:

```text
-C -
```

Если скачивание оборвалось, повторный запуск попробует продолжить его.

Если файл уже существует и прошёл минимальную проверку размера, downloader его пропускает.

Если нужно принудительно скачать конкретную модель заново — удали соответствующий файл и снова запусти installer.

Пример:

```powershell
Remove-Item "C:\AI\models\flux2\klein4b\diffusion\flux-2-klein-4b-Q4_0.gguf"
.\install-flux2.bat
```

---

# 20. Типичные проблемы

## `curl.exe не найден`

Проверка:

```powershell
curl.exe --version
```

Если команды нет — Windows слишком старая/необновлённая либо curl удалён из PATH.

## В `--list-devices` нет AMD/Vulkan

Проверь:

```powershell
C:\AI\sd-flux2\sd-cli.exe --list-devices
```

Если Vulkan GPU отсутствует:

1. обновить AMD driver;
2. перезагрузить Windows;
3. снова выполнить `--list-devices`.

## `vulkan0` — не та видеокарта

На системе с iGPU + dGPU может быть несколько устройств.

Выбери правильное имя из:

```powershell
sd-cli.exe --list-devices
```

И поправь:

```text
flux2-config.json
```

Поле:

```json
"vulkanDevice": "vulkan1"
```

и backend:

```json
"backend": "diffusion=vulkan1,te=cpu,vae=cpu"
```

Проще всего также повторно запустить installer и выбрать правильный device.

## `OutOfDeviceMemory`

Сначала убедись, что используется именно наша схема:

```text
diffusion=<vulkan>,te=cpu,vae=cpu
```

Для первичной диагностики используй 512x512.

Не начинай с 1024/1536, пока 512 не работает.

## Server работает на Windows, но Mac не видит

Windows:

```powershell
curl.exe http://127.0.0.1:7861/v1/models
```

Если это работает, а Mac нет:

1. server должен слушать `0.0.0.0`, не `127.0.0.1`;
2. Windows network profile должен быть Private;
3. firewall rule должен разрешать порт;
4. Mac и Windows должны быть в одной сети;
5. использовать LAN IP Windows.

Проверка порта Windows:

```powershell
Get-NetTCPConnection -LocalPort 7861 -State Listen
```

## Порт занят

```powershell
Get-NetTCPConnection -LocalPort 7861 -ErrorAction SilentlyContinue
```

Можно переустановить runtime scripts с другим портом, например 7862.

## Hugging Face download оборвался

Просто запусти installer ещё раз.

Он использует resume download.

---

# 21. Безопасность

`sd-server` в нашей схеме предназначен для локальной доверенной сети.

Не делай port-forwarding 7861 на роутере и не публикуй этот API напрямую в интернет.

Рекомендуемый режим:

```text
listen-ip = 0.0.0.0
Windows Firewall Profile = Private
RemoteAddress = LocalSubnet
```

Это позволяет Mac обращаться к Windows внутри LAN, но не предназначено для публичного доступа.

---

# 22. Что хранить в Git проекта

В Git класть:

```text
tools/flux2-windows/
├── README_FLUX2_WINDOWS.md
├── install-flux2.bat
└── install-flux2.ps1
```

**Не класть в Git обычного проекта:**

```text
*.gguf
*.safetensors
sd-cli.exe
sd-server.exe
*.dll
```

Модели и binaries installer скачивает сам.

Так репозиторий остаётся лёгким, а новая Windows-машина разворачивается командами из этого комплекта.

---

# 23. Короткая шпаргалка новой машины

## Установить

```powershell
cd <project>\tools\flux2-windows
.\install-flux2.bat
```

Нажимать Enter на дефолтах, если нужен `C:\AI`, порт `7861` и зафиксированный known-good release `master-820-de298c2`.

## Проверить модель

```powershell
C:\AI\scripts\flux2\test-flux2.bat
```

## Запустить server

```powershell
C:\AI\scripts\flux2\run-flux2-server.bat
```

## Проверить Windows

```powershell
curl.exe http://127.0.0.1:7861/v1/models
```

## Проверить Mac

```bash
curl http://WINDOWS_IP:7861/v1/models
```

## Image editing API

```text
POST http://WINDOWS_IP:7861/v1/images/edits
```

---

# 24. Upstream документация

stable-diffusion.cpp FLUX.2 guide:

```text
https://github.com/leejet/stable-diffusion.cpp/blob/master/docs/flux2.md
```

Backend selection:

```text
https://github.com/leejet/stable-diffusion.cpp/blob/master/docs/backend.md
```

Server API:

```text
https://github.com/leejet/stable-diffusion.cpp/blob/master/examples/server/api.md
```

Releases:

```text
https://github.com/leejet/stable-diffusion.cpp/releases
```

---

# Итоговая архитектура

```text
Mac / Node.js pipeline
        |
        | HTTP
        | /v1/images/generations
        | /v1/images/edits
        v
Windows LAN IP : 7861
        |
        v
stable-diffusion.cpp
        |
        +--> FLUX.2 Klein 4B Q4_0 ----> Vulkan GPU
        |
        +--> Qwen3-4B Q4_K_M --------> CPU
        |
        +--> FLUX.2 Small Decoder ---> CPU
        |
        v
base64 PNG response
        |
        v
Mac сохраняет PNG локально
```

Windows в дальнейшем можно воспринимать просто как headless GPU worker. Все orchestration-скрипты, ассеты, выбор seeds, spritesheet packing и постпроцессинг могут жить на Mac.
