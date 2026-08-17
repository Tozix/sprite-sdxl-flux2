# Deployment scripts

Installers for the local AI inference server used by the Iron Arcana pipeline:

- **`install-flux2-ubuntu.sh`** — Ubuntu 24.04+ x86_64 (Vulkan)
- **`install-flux2.ps1`** + **`install-flux2.bat`** — Windows (Vulkan)

Both install `stable-diffusion.cpp` plus the FLUX.2 Klein 4B models
(FLUX.2 Klein 4B Q4_0, Qwen3-4B Q4_K_M text encoder, FLUX.2 Small Decoder VAE)
and generate runtime scripts (`run-flux2-server`, `test-flux2`, `check-flux2-server`)
under the chosen install directory.

The server exposes an OpenAI-compatible API. The Mac orchestration machine
then points `IRON_ARCANA_AI_SERVER` at it (default `http://192.168.0.16:7861`).

## Ubuntu

```bash
cd scripts
./install-flux2-ubuntu.sh
```

Interactive prompts (paths, Vulkan device, listen IP, port). After it finishes:

```bash
~/iron-arcana/scripts/test-flux2.sh          # test generation
~/iron-arcana/scripts/run-flux2-server.sh    # start API server
curl http://127.0.0.1:7861/v1/models         # health check
```

## Windows

```powershell
cd scripts
.\install-flux2.bat
```

Or directly:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\install-flux2.ps1
```

After it finishes, use the generated scripts (default `C:\AI\scripts\flux2\`):

```powershell
C:\AI\scripts\flux2\test-flux2.bat
C:\AI\scripts\flux2\run-flux2-server.bat
curl.exe http://127.0.0.1:7861/v1/models
```

Full Windows walkthrough: `flux2-install-windows/README_FLUX2_WINDOWS.md`.
