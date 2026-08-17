#!/usr/bin/env bash
set -Eeuo pipefail
IFS=$'\n\t'

# Iron Arcana - FLUX.2 Klein 4B installer for Ubuntu Linux
# Target stack:
#   stable-diffusion.cpp (Vulkan)
#   FLUX.2 Klein 4B Q4_0
#   Qwen3-4B Q4_K_M
#   FLUX.2 Small Decoder
#   sd-server embedded Web UI + OpenAI-compatible API
#
# Designed for Ubuntu 24.04+ x86_64, including Ubuntu 26.04.
# Prefers the official Ubuntu 24.04 Vulkan release binary; if it cannot run,
# it can fall back to a local Vulkan build from the same release tag.

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { printf "${GREEN}[OK]${NC} %s\n" "$*"; }
info() { printf "${CYAN}[INFO]${NC} %s\n" "$*"; }
warn() { printf "${YELLOW}[WARN]${NC} %s\n" "$*"; }
die()  { printf "${RED}[ERROR]${NC} %s\n" "$*" >&2; exit 1; }

cleanup_dir=""
cleanup() {
  if [[ -n "${cleanup_dir:-}" && -d "$cleanup_dir" ]]; then
    rm -rf "$cleanup_dir" || true
  fi
}
trap cleanup EXIT

prompt() {
  local label="$1"
  local default="$2"
  local value
  read -r -p "$label [$default]: " value || true
  printf '%s' "${value:-$default}"
}

prompt_yn() {
  local label="$1"
  local default="${2:-Y}"
  local suffix='[Y/n]'
  [[ "$default" =~ ^[Nn]$ ]] && suffix='[y/N]'
  local answer
  read -r -p "$label $suffix: " answer || true
  answer="${answer:-$default}"
  [[ "$answer" =~ ^[Yy]$ ]]
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Не найдена команда: $1"
}

as_root() {
  if [[ $EUID -eq 0 ]]; then
    "$@"
  else
    sudo "$@"
  fi
}

download_resume() {
  local url="$1"
  local out="$2"
  local min_bytes="${3:-1024}"
  local part="${out}.part"
  mkdir -p "$(dirname "$out")"

  if [[ -f "$out" ]]; then
    local size
    size=$(stat -c '%s' "$out" 2>/dev/null || echo 0)
    if (( size >= min_bytes )); then
      info "Файл уже скачан ($(numfmt --to=iec "$size" 2>/dev/null || echo "$size bytes")): $out"
      return 0
    fi
    warn "Финальный файл слишком маленький; переношу его в .part и продолжаю скачивание."
    mv -f "$out" "$part"
  fi

  info "Скачиваю: $(basename "$out")"
  curl -L \
    --fail \
    --retry 10 \
    --retry-delay 3 \
    --retry-all-errors \
    -C - \
    --progress-bar \
    -o "$part" \
    "$url"

  local final_size
  final_size=$(stat -c '%s' "$part" 2>/dev/null || echo 0)
  (( final_size >= min_bytes )) || die "Скачанный файл подозрительно маленький: $part ($final_size bytes)"
  mv -f "$part" "$out"
}

json_escape() {
  jq -Rn --arg v "$1" '$v'
}

printf '\n==============================================\n'
printf ' IRON ARCANA - FLUX.2 UBUNTU INSTALLER\n'
printf ' stable-diffusion.cpp + Vulkan + Web UI\n'
printf '==============================================\n\n'

[[ "$(uname -s)" == "Linux" ]] || die "Этот installer рассчитан на Linux."
[[ "$(uname -m)" == "x86_64" ]] || die "Нужна архитектура x86_64. Текущая: $(uname -m)"

if [[ $EUID -eq 0 && -n "${SUDO_USER:-}" && "${SUDO_USER:-root}" != "root" ]]; then
  die "Не запускай весь installer через sudo. Запусти обычным пользователем: ./install-flux2-ubuntu.sh — sudo он вызовет сам только для apt/UFW."
fi

if [[ -r /etc/os-release ]]; then
  # shellcheck disable=SC1091
  source /etc/os-release
  info "OS: ${PRETTY_NAME:-$ID $VERSION_ID}"
  if [[ "${ID:-}" != "ubuntu" && "${ID_LIKE:-}" != *debian* ]]; then
    warn "Скрипт тестировался по логике Ubuntu/Debian; текущий дистрибутив: ${ID:-unknown}."
  fi
fi

if [[ $EUID -ne 0 ]]; then
  need_cmd sudo
  info "Для системных пакетов понадобится sudo."
  sudo -v
fi

DEFAULT_BASE="$HOME/AI"
BASE_DIR=$(prompt "Корневая папка установки" "$DEFAULT_BASE")
BIN_DIR=$(prompt "Папка stable-diffusion.cpp" "$BASE_DIR/sd-flux2")
MODELS_DIR=$(prompt "Папка моделей FLUX.2" "$BASE_DIR/models/flux2/klein4b")
SCRIPTS_DIR=$(prompt "Папка runtime-скриптов" "$BASE_DIR/scripts/flux2")
INPUT_DIR=$(prompt "Папка reference/input изображений" "$BASE_DIR/input")
OUTPUT_DIR=$(prompt "Папка результатов" "$BASE_DIR/output/flux2")
LISTEN_IP=$(prompt "IP для API/server" "0.0.0.0")
PORT=$(prompt "TCP порт" "7861")
RELEASE_TAG=$(prompt "stable-diffusion.cpp release (latest или конкретный tag)" "latest")

[[ "$PORT" =~ ^[0-9]+$ ]] || die "Порт должен быть числом."
(( PORT >= 1 && PORT <= 65535 )) || die "Некорректный порт: $PORT"

mkdir -p \
  "$BIN_DIR" \
  "$MODELS_DIR/diffusion" \
  "$MODELS_DIR/text_encoder" \
  "$MODELS_DIR/vae" \
  "$SCRIPTS_DIR" \
  "$INPUT_DIR" \
  "$OUTPUT_DIR" \
  "$BASE_DIR/downloads/flux2"

printf '\n'
info "Устанавливаю системные зависимости..."
as_root apt-get update
as_root env DEBIAN_FRONTEND=noninteractive apt-get install -y \
  ca-certificates \
  curl \
  jq \
  unzip \
  git \
  cmake \
  ninja-build \
  build-essential \
  libvulkan1 \
  libvulkan-dev \
  mesa-vulkan-drivers \
  vulkan-tools \
  glslc \
  spirv-headers \
  python3 \
  libstdc++6 \
  libgcc-s1

need_cmd curl
need_cmd jq
need_cmd unzip
need_cmd vulkaninfo
need_cmd python3

printf '\n'
info "Проверяю Vulkan..."
if ! vulkaninfo --summary >/tmp/iron-arcana-vulkan-summary.txt 2>/tmp/iron-arcana-vulkan-error.txt; then
  warn "vulkaninfo завершился с ошибкой."
  cat /tmp/iron-arcana-vulkan-error.txt >&2 || true
  die "Vulkan не работает. Проверь Mesa/amdgpu и повтори запуск."
fi
cat /tmp/iron-arcana-vulkan-summary.txt | sed -n '1,120p'

if grep -qiE 'llvmpipe|software rasterizer' /tmp/iron-arcana-vulkan-summary.txt; then
  warn "В Vulkan summary присутствует llvmpipe. Это CPU software Vulkan. Ниже обязательно выбери реальное AMD Vulkan-устройство, а не llvmpipe."
fi

# Swap warning only. We do not mutate Btrfs swap automatically.
SWAP_BYTES=$(awk '/SwapTotal:/ {print $2 * 1024}' /proc/meminfo)
if awk "BEGIN {exit !($SWAP_BYTES < 4294967296)}"; then
  warn "Swap меньше 4 GiB. Для твоих 32 GiB RAM FLUX.2 4B обычно должен жить, но при тяжёлой нагрузке лучше иметь 8-16 GiB swap. Скрипт swap автоматически не меняет."
fi

printf '\n'
info "Получаю metadata stable-diffusion.cpp..."
if [[ "$RELEASE_TAG" == "latest" ]]; then
  RELEASE_API="https://api.github.com/repos/leejet/stable-diffusion.cpp/releases/latest"
else
  RELEASE_API="https://api.github.com/repos/leejet/stable-diffusion.cpp/releases/tags/$RELEASE_TAG"
fi

RELEASE_JSON=$(curl -fsSL --retry 5 "$RELEASE_API") || die "Не удалось получить release metadata: $RELEASE_API"
RESOLVED_TAG=$(jq -r '.tag_name // empty' <<<"$RELEASE_JSON")
[[ -n "$RESOLVED_TAG" ]] || die "GitHub API не вернул tag_name."
log "Release: $RESOLVED_TAG"

ASSET_NAME=$(jq -r '.assets[].name' <<<"$RELEASE_JSON" | grep -E 'bin-Linux-Ubuntu-24\.04-x86_64-vulkan\.zip$' | head -n1 || true)
ASSET_URL=""
if [[ -n "$ASSET_NAME" ]]; then
  ASSET_URL=$(jq -r --arg n "$ASSET_NAME" '.assets[] | select(.name==$n) | .browser_download_url' <<<"$RELEASE_JSON" | head -n1)
fi

INSTALL_MODE="prebuilt"
SD_CLI=""
SD_SERVER=""

install_prebuilt() {
  local zip="$BASE_DIR/downloads/flux2/$ASSET_NAME"
  local release_dir="$BIN_DIR/$RESOLVED_TAG"

  download_resume "$ASSET_URL" "$zip" 1000000
  rm -rf "$release_dir"
  mkdir -p "$release_dir"
  unzip -q -o "$zip" -d "$release_dir"

  find "$release_dir" -type f \( -name 'sd-cli' -o -name 'sd-server' \) -exec chmod +x {} + || true

  SD_CLI=$(find "$release_dir" -type f -name 'sd-cli' -print -quit || true)
  SD_SERVER=$(find "$release_dir" -type f -name 'sd-server' -print -quit || true)

  [[ -n "$SD_CLI" && -n "$SD_SERVER" ]] || return 1

  if ! "$SD_CLI" -h >/tmp/iron-arcana-sd-cli-help.txt 2>/tmp/iron-arcana-sd-cli-help.err; then
    warn "Официальный Ubuntu 24.04 Vulkan binary не запустился на этой системе."
    cat /tmp/iron-arcana-sd-cli-help.err >&2 || true
    return 1
  fi

  return 0
}

build_from_source() {
  INSTALL_MODE="source"
  warn "Перехожу на сборку stable-diffusion.cpp из исходников с Vulkan."

  as_root env DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs npm

  local node_major
  node_major=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)
  if (( node_major < 20 )); then
    die "Для embedded Web UI нужен Node.js >= 20. В репозитории Ubuntu обнаружен Node.js $(node -v 2>/dev/null || echo unknown). Установи Node.js 20+ и перезапусти installer."
  fi

  if ! command -v pnpm >/dev/null 2>&1; then
    as_root npm install -g pnpm@10
  fi

  cleanup_dir=$(mktemp -d -t iron-arcana-sdcpp-XXXXXX)
  local src="$cleanup_dir/stable-diffusion.cpp"
  git clone --depth 1 --branch "$RESOLVED_TAG" https://github.com/leejet/stable-diffusion.cpp.git "$src"

  cmake -S "$src" -B "$src/build" -G Ninja \
    -DCMAKE_BUILD_TYPE=Release \
    -DSD_VULKAN=ON \
    -DSD_SERVER_BUILD_FRONTEND=ON

  cmake --build "$src/build" --config Release -j"$(nproc)"

  local built_cli built_server
  built_cli=$(find "$src/build" -type f -name 'sd-cli' -print -quit || true)
  built_server=$(find "$src/build" -type f -name 'sd-server' -print -quit || true)
  [[ -n "$built_cli" && -n "$built_server" ]] || die "Сборка завершилась, но sd-cli/sd-server не найдены."

  local release_dir="$BIN_DIR/$RESOLVED_TAG-source"
  rm -rf "$release_dir"
  mkdir -p "$release_dir"

  # Copy the entire build tree because shared libraries may be needed.
  cp -a "$src/build/." "$release_dir/"
  SD_CLI=$(find "$release_dir" -type f -name 'sd-cli' -print -quit)
  SD_SERVER=$(find "$release_dir" -type f -name 'sd-server' -print -quit)
  chmod +x "$SD_CLI" "$SD_SERVER"

  "$SD_CLI" -h >/dev/null || die "Собранный sd-cli не запускается."
}

if [[ -n "$ASSET_NAME" && -n "$ASSET_URL" ]]; then
  info "Найден официальный Linux Vulkan asset: $ASSET_NAME"
  if ! install_prebuilt; then
    if prompt_yn "Собрать stable-diffusion.cpp локально из исходников?" "Y"; then
      build_from_source
    else
      die "Без рабочего sd-cli продолжить нельзя."
    fi
  fi
else
  warn "В release $RESOLVED_TAG нет Ubuntu 24.04 x86_64 Vulkan asset."
  if prompt_yn "Собрать stable-diffusion.cpp локально из исходников?" "Y"; then
    build_from_source
  else
    die "Установка отменена."
  fi
fi

log "sd-cli: $SD_CLI"
log "sd-server: $SD_SERVER"

printf '\n'
info "Устройства stable-diffusion.cpp:"
DEVICE_OUTPUT=$({ "$SD_CLI" --list-devices; } 2>&1 || true)
printf '%s\n' "$DEVICE_OUTPUT"

DEFAULT_VULKAN_DEVICE=$(grep -oE 'vulkan[0-9]+' <<<"$DEVICE_OUTPUT" | head -n1 || true)
DEFAULT_VULKAN_DEVICE="${DEFAULT_VULKAN_DEVICE:-vulkan0}"
VULKAN_DEVICE=$(prompt "Vulkan device для diffusion" "$DEFAULT_VULKAN_DEVICE")

if ! grep -q "$VULKAN_DEVICE" <<<"$DEVICE_OUTPUT"; then
  warn "Устройство '$VULKAN_DEVICE' не найдено буквально в выводе --list-devices. Продолжаю по твоему выбору, но проверь его перед генерацией."
fi

printf '\n'
info "Скачиваю модели. Это несколько гигабайт. Повторный запуск продолжит недокачанные файлы."

DIFF_MODEL="$MODELS_DIR/diffusion/flux-2-klein-4b-Q4_0.gguf"
LLM_MODEL="$MODELS_DIR/text_encoder/Qwen3-4B-Q4_K_M.gguf"
VAE_MODEL="$MODELS_DIR/vae/full_encoder_small_decoder.safetensors"

DIFF_URL='https://huggingface.co/leejet/FLUX.2-klein-4B-GGUF/resolve/main/flux-2-klein-4b-Q4_0.gguf?download=true'
LLM_URL='https://huggingface.co/unsloth/Qwen3-4B-GGUF/resolve/main/Qwen3-4B-Q4_K_M.gguf?download=true'
VAE_URL='https://huggingface.co/black-forest-labs/FLUX.2-small-decoder/resolve/main/full_encoder_small_decoder.safetensors?download=true'

download_resume "$DIFF_URL" "$DIFF_MODEL" 2000000000
download_resume "$LLM_URL" "$LLM_MODEL" 1000000000
download_resume "$VAE_URL" "$VAE_MODEL" 100000000

CONFIG="$SCRIPTS_DIR/flux2-config.json"
BACKEND="diffusion=$VULKAN_DEVICE,te=cpu,vae=cpu"
PARAMS_BACKEND="diffusion=$VULKAN_DEVICE,te=cpu,vae=cpu"

jq -n \
  --arg releaseTag "$RESOLVED_TAG" \
  --arg installMode "$INSTALL_MODE" \
  --arg sdCli "$SD_CLI" \
  --arg sdServer "$SD_SERVER" \
  --arg diffusionModel "$DIFF_MODEL" \
  --arg llmModel "$LLM_MODEL" \
  --arg vaeModel "$VAE_MODEL" \
  --arg inputDir "$INPUT_DIR" \
  --arg outputDir "$OUTPUT_DIR" \
  --arg listenIp "$LISTEN_IP" \
  --argjson port "$PORT" \
  --arg vulkanDevice "$VULKAN_DEVICE" \
  --arg backend "$BACKEND" \
  --arg paramsBackend "$PARAMS_BACKEND" \
  '{
    releaseTag: $releaseTag,
    installMode: $installMode,
    sdCli: $sdCli,
    sdServer: $sdServer,
    diffusionModel: $diffusionModel,
    llmModel: $llmModel,
    vaeModel: $vaeModel,
    inputDir: $inputDir,
    outputDir: $outputDir,
    listenIp: $listenIp,
    port: $port,
    vulkanDevice: $vulkanDevice,
    backend: $backend,
    paramsBackend: $paramsBackend,
    defaults: {
      width: 512,
      height: 512,
      steps: 4,
      cfgScale: 1.0,
      samplingMethod: "euler"
    }
  }' > "$CONFIG"

RUN_SCRIPT="$SCRIPTS_DIR/run-flux2-server.sh"
cat > "$RUN_SCRIPT" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
CONFIG="$SCRIPT_DIR/flux2-config.json"

jq -e . "$CONFIG" >/dev/null
SD_SERVER=$(jq -r '.sdServer' "$CONFIG")
DIFF_MODEL=$(jq -r '.diffusionModel' "$CONFIG")
LLM_MODEL=$(jq -r '.llmModel' "$CONFIG")
VAE_MODEL=$(jq -r '.vaeModel' "$CONFIG")
LISTEN_IP=$(jq -r '.listenIp' "$CONFIG")
PORT=$(jq -r '.port' "$CONFIG")
BACKEND=$(jq -r '.backend' "$CONFIG")
PARAMS_BACKEND=$(jq -r '.paramsBackend' "$CONFIG")

export LD_LIBRARY_PATH="$(dirname "$SD_SERVER"):${LD_LIBRARY_PATH:-}"

exec "$SD_SERVER" \
  --listen-ip "$LISTEN_IP" \
  --listen-port "$PORT" \
  --diffusion-model "$DIFF_MODEL" \
  --llm "$LLM_MODEL" \
  --vae "$VAE_MODEL" \
  --backend "$BACKEND" \
  --params-backend "$PARAMS_BACKEND" \
  --cfg-scale 1.0 \
  --steps 4 \
  --sampling-method euler \
  --diffusion-fa \
  -v
EOF
chmod +x "$RUN_SCRIPT"

TEST_SCRIPT="$SCRIPTS_DIR/test-flux2.sh"
cat > "$TEST_SCRIPT" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
CONFIG="$SCRIPT_DIR/flux2-config.json"

SD_CLI=$(jq -r '.sdCli' "$CONFIG")
DIFF_MODEL=$(jq -r '.diffusionModel' "$CONFIG")
LLM_MODEL=$(jq -r '.llmModel' "$CONFIG")
VAE_MODEL=$(jq -r '.vaeModel' "$CONFIG")
OUTPUT_DIR=$(jq -r '.outputDir' "$CONFIG")
BACKEND=$(jq -r '.backend' "$CONFIG")
PARAMS_BACKEND=$(jq -r '.paramsBackend' "$CONFIG")

mkdir -p "$OUTPUT_DIR"
OUT="$OUTPUT_DIR/flux2-install-test.png"
export LD_LIBRARY_PATH="$(dirname "$SD_CLI"):${LD_LIBRARY_PATH:-}"

"$SD_CLI" \
  --diffusion-model "$DIFF_MODEL" \
  --llm "$LLM_MODEL" \
  --vae "$VAE_MODEL" \
  --backend "$BACKEND" \
  --params-backend "$PARAMS_BACKEND" \
  -p "a small brown fantasy rat, full body, neutral background" \
  -W 512 \
  -H 512 \
  --cfg-scale 1.0 \
  --steps 4 \
  --sampling-method euler \
  --diffusion-fa \
  --seed 42 \
  --output "$OUT" \
  -v

printf '\nGenerated: %s\n' "$OUT"
EOF
chmod +x "$TEST_SCRIPT"

CHECK_SCRIPT="$SCRIPTS_DIR/check-flux2-server.sh"
cat > "$CHECK_SCRIPT" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
CONFIG="$SCRIPT_DIR/flux2-config.json"
PORT=$(jq -r '.port' "$CONFIG")
curl -fsS "http://127.0.0.1:${PORT}/v1/models" | jq .
EOF
chmod +x "$CHECK_SCRIPT"

OPEN_GUI_SCRIPT="$SCRIPTS_DIR/open-flux2-gui.sh"
cat > "$OPEN_GUI_SCRIPT" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
CONFIG="$SCRIPT_DIR/flux2-config.json"
PORT=$(jq -r '.port' "$CONFIG")
URL="http://127.0.0.1:${PORT}/"
printf 'Opening %s\n' "$URL"
if command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$URL" >/dev/null 2>&1 || true
else
  printf '%s\n' "$URL"
fi
EOF
chmod +x "$OPEN_GUI_SCRIPT"

# Optional user-level systemd service.
SERVICE_DIR="$HOME/.config/systemd/user"
SERVICE_FILE="$SERVICE_DIR/iron-arcana-flux2.service"
mkdir -p "$SERVICE_DIR"
cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=Iron Arcana FLUX.2 stable-diffusion.cpp server
After=network-online.target

[Service]
Type=simple
ExecStart=/bin/bash "$RUN_SCRIPT"
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload >/dev/null 2>&1 || true

# Optional UFW LAN-only rule.
if [[ "$LISTEN_IP" == "0.0.0.0" ]] && command -v ufw >/dev/null 2>&1; then
  UFW_STATUS=$(as_root ufw status 2>/dev/null | head -n1 || true)
  if grep -qi 'Status: active' <<<"$UFW_STATUS"; then
    DEFAULT_IFACE=$(ip route show default 2>/dev/null | awk '/default/ {print $5; exit}')
    LAN_CIDR=""
    if [[ -n "$DEFAULT_IFACE" ]]; then
      ADDR_CIDR=$(ip -o -4 addr show dev "$DEFAULT_IFACE" scope global 2>/dev/null | awk '{print $4; exit}')
      if [[ -n "$ADDR_CIDR" ]]; then
        LAN_CIDR=$(python3 - "$ADDR_CIDR" <<'PY'
import ipaddress, sys
print(ipaddress.ip_interface(sys.argv[1]).network)
PY
)
      fi
    fi

    if [[ -n "$LAN_CIDR" ]]; then
      if prompt_yn "UFW активен. Разрешить TCP $PORT только из LAN $LAN_CIDR?" "Y"; then
        as_root ufw allow from "$LAN_CIDR" to any port "$PORT" proto tcp
      fi
    else
      warn "UFW активен, но LAN subnet определить не удалось. Firewall rule автоматически не создаю."
    fi
  fi
fi

# Detect LAN address for the final help text.
DEFAULT_IFACE=$(ip route show default 2>/dev/null | awk '/default/ {print $5; exit}')
LAN_IP=""
if [[ -n "$DEFAULT_IFACE" ]]; then
  LAN_IP=$(ip -o -4 addr show dev "$DEFAULT_IFACE" scope global 2>/dev/null | awk '{print $4}' | cut -d/ -f1 | head -n1)
fi

printf '\n==============================================\n'
printf ' INSTALLATION COMPLETE\n'
printf '==============================================\n\n'
printf 'Release:       %s\n' "$RESOLVED_TAG"
printf 'Install mode:  %s\n' "$INSTALL_MODE"
printf 'Vulkan device: %s\n' "$VULKAN_DEVICE"
printf 'Config:        %s\n\n' "$CONFIG"

printf '1) Проверить генерацию 512x512:\n'
printf '   %q\n\n' "$TEST_SCRIPT"

printf '2) Запустить API server + встроенный Web UI:\n'
printf '   %q\n\n' "$RUN_SCRIPT"

printf '3) Открыть GUI локально:\n'
printf '   http://127.0.0.1:%s/\n' "$PORT"
printf '   или: %q\n\n' "$OPEN_GUI_SCRIPT"

printf '4) Проверить OpenAI-compatible API:\n'
printf '   curl http://127.0.0.1:%s/v1/models\n\n' "$PORT"

if [[ -n "$LAN_IP" ]]; then
  printf '5) С другой машины в LAN:\n'
  printf '   GUI: http://%s:%s/\n' "$LAN_IP" "$PORT"
  printf '   API: http://%s:%s/v1/models\n\n' "$LAN_IP" "$PORT"
fi

printf '6) Запуск через systemd --user:\n'
printf '   systemctl --user start iron-arcana-flux2\n'
printf '   systemctl --user status iron-arcana-flux2\n'
printf '   journalctl --user -u iron-arcana-flux2 -f\n\n'
printf 'Автозапуск после входа в пользователя:\n'
printf '   systemctl --user enable iron-arcana-flux2\n\n'

printf 'OpenAI-compatible endpoints:\n'
printf '   GET  /v1/models\n'
printf '   POST /v1/images/generations\n'
printf '   POST /v1/images/edits\n\n'

printf 'ВАЖНО для этой машины:\n'
printf ' - Ryzen 7 5800H имеет встроенную Vega и использует общую RAM, а не 8 GB выделенной VRAM.\n'
printf ' - Поэтому начинай с 512x512 / 4 steps / Euler / CFG 1.0.\n'
printf ' - Не публикуй порт %s в интернет. Для LAN достаточно listen-ip=0.0.0.0 + локальный firewall.\n' "$PORT"
printf ' - Если получишь Vulkan OOM, сначала попробуй добавить --vae-tiling или перевести paramsBackend diffusion на cpu в config/runtime.\n'
