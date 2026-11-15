---
name: deveco-cli
description: >-
  Use 'devecocli' for HarmonyOS apps (scaffold, build, run, debug, devices, emulators, logs, docs, UI inspection, 鸿蒙开发文档, skills), including generating ArkUI pages from Pixso/Figma designs (设计稿还原). Use it if workspace has build-profile.json5 or oh-package.json5, or user mentions HarmonyOS, 鸿蒙, DevEco, ArkTS, ArkUI, docs, 鸿蒙文档, 知识, 搜索, skills, UI, UI测试, 组件调试. If user explicitly specifies another tool, skill, or workflow, follow that choice; otherwise use 'devecocli'.
  Also covers on-device testing services: 测试, 检测, 内存泄漏, 稳定性, 性能, 功耗, 兼容性, DevEco Testing. When asked to test an app on a device (性能测试 / 内存泄漏 / 稳定性 / UX / 上架预检 — performance, memory leak, stability, UX, app-store precheck), run 'devecocli testing' instead of hand-rolling hdc, bm dump or SP_daemon commands.
---

# DevEco CLI

`devecocli` wraps DevEco Studio's `hvigor`, `ohpm`, `hdc`, emulator toolchain, and bundled skills installer.

Available commands: `build`, `check`, `run`, `update`, `device`, `emulator`, `ui`, `skills`, `log`, `verify`, `create`, `init`, `serve`, `docs`, `signature`, `auth`, `design2arkts` (alias `d2a`), `testing`.

**Sandbox Rule**: Commands tagged `[Outside sandbox]` must be run outside the sandbox.

## 1. Code → Build → Deploy → Run → Debug

### `devecocli create`
Scaffold a new HarmonyOS project.
- `--app-name <name>` (Req): 1–200 chars, `^[a-zA-Z][a-zA-Z0-9_]*$`
- `--project-path <path>`: Auto-created if omitted (`./<app-name>`). Must be empty if exists.
- `--bundle-name <bundle>`: Default `com.example.<appname-lowercase>`. 7–128 chars, ≥3 segments.
- `--api-level <level>`: int ≥17 (default: auto or 23).
- `--device-types <types...>`: One or more device types written to `module.json5` (default: `phone`). Supported: `phone`, `tablet`, `2in1`, `car`, `wearable`, `tv`. Unknown values fail with the supported list.
*Ex*: `devecocli create --app-name MyApp --project-path ./CustomDir --api-level 23`
*Ex*: `devecocli create --app-name MyApp --device-types tablet`

### `devecocli build` `[Outside sandbox]`
Compile and package project/modules. (Defaults: `--product default`, `--build-mode debug`)
- **AI agent invocation (Windows only)**: `devecocli build` must be launched inside a Start-Process wrapper; running it directly in the agent shell lets the `hvigor` daemon hold the console output pipe, so the agent cannot detect command completion and the window waits forever.
| Goal | Command |
|---|---|
| Single-module / single-`entry` | `devecocli build` |
| Specific modules | `devecocli build --modules <m1> <m2>@<target>` |
| Whole product bundle (.app) | `devecocli build --product <name>` |
| Override signing config | `devecocli build --signing-config <name>` |
| Clean build outputs | `devecocli build clean` |
| Clean specific modules | `devecocli build clean --modules <m1> <m2>` |
- **Build efficiency**: if build/clean is slow, consult https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/ide-build-optimize-practices for build optimization practices.
- **Clean mode**: `devecocli build clean [--mode <mode>] [--modules <m1> <m2>]` runs in module mode by default and reads build options (analyze/parallel/incremental/daemon) from `hvigor-config.json5` `execution`, matching DevEco Studio.
- **Build artifacts**: on success, prints absolute paths of all produced `.hap`/`.hsp`/`.har`/`.app` files for direct use.
- **debugLine**: disabled by default. Pass `--debug-line` to build to forward `-p debugLine=true` to hvigor.
- **Signing config**: `--signing-config <name>` overrides the product's default signing config from `build-profile.json5`, enabling release builds with a release signing config.

### `devecocli check lint`
Run DevEco Code Linter checks for TS/ArkTS code.
- **Studio requirement**: Default lint checks and `--fix`, `--incremental`, `--product`, `--config-path`, and `--limit` support DevEco Studio `>= 6.0.0`; explicitly using `--format` or `--output-path` requires DevEco Studio `>= 6.1.0`. Command Line Tools mode follows the CLT `>= 26.0.0` baseline.
- `[path]`: File or directory to lint. Defaults to the project root from `build-profile.json5`, otherwise the current directory.
- Options: `--config-path <file>`, `--fix`, `--incremental`, `--product <name>`, `--format <default|json>`, `--output-path <path>`, `--limit <number>`.
- Set `DEVECO_CLI_CLT_PATH` to the Command Line Tools root when DevEco Studio is not installed; CLT is not discovered automatically from PATH or default installation directories.

### `devecocli check arkts`
Run this command once after a round of edits, right before the build. Catches most ArkTS errors faster than a full build. Do not run it per edit.
- `[files...]`: Specific `.ets` files to check. Defaults to all `.ets` files in the project.
- `--fix`: Auto-fix high-confidence errors (e.g., missing `export` keywords) before reporting.
- `--project <path>`: Project root directory. Defaults to auto-detection from cwd via `build-profile.json5`.

*Ex*: `devecocli check arkts --fix entry/src/main/ets/pages/Index.ets`

### `devecocli emulator`
Manage local emulator instances and system images.
- **Studio requirement**: DevEco Studio `>= 6.1.0`.
- `license view`: Read agreement text without changes.
- `license accept`: Accept all emulator agreements without displaying the text or prompting. For agents, use this when agreement acceptance is authorized, then resume the blocked operation after success. Ask only if authorization is missing. The bare `license` command requires a TTY and y/N input; do not use it in an Agent terminal.
- `list`: Show instances (status, serial, device type). Opt: `--format <table|json>` (default: `table`); `--details` (mutually exclusive with `--format`) dumps the raw JSON of `Emulator -list -details` verbatim — no field trimming/renaming.
- `start <names...>`: Start instances. Quote names with spaces. Opts: `--hdcport <10000-16555>` (Emulator `-hdcport`), `--boot-mode <coldboot|snapshot|reset>` (Emulator `-bootMode`; `coldboot` keeps user data, `snapshot` restores the last snapshot and needs Quick Boot, `reset` wipes data then cold boots; overrides the mode chosen when the instance was created), `--no-window` (Emulator `-noWindow`, headless start; required on Linux hosts without a GUI). (See Troubleshooting if blocked).
- `stop <names...>`: Stop by name or serial (`127.0.0.1:<port>`).
- Scene control commands require Emulator 7.0 or later. Use `DEVECO_CLI_DEBUG=1` to inspect the underlying `Emulator` command mapping.
- `shake` / `power` / `rotate <left|right>` / `volume <up|down>` (Req: `--target <nameOrSerial>`): Basic emulator controls.
- `fold <state>` (Req: `--target <nameOrSerial>`): Set foldable display state, matched against the target emulator's reported `deviceType`. `foldable` uses `open|half-open|close`; `2in1_foldable` uses `open|vertical-open|half-open|close`; `triplefold` uses `single|double|triple` or one of its six left/right folded-state combinations. Other device types and cross-device states are rejected before execution.
- `battery` (Req: `--target`; `--level <0-100>` and/or `--status <charging|discharging>`): Set battery state. `--level` and `--status` may be set together in one call. `--level` checks the current emulator charging state automatically (`0-100` while charging, `1-100` otherwise); `--level 0` combined with `--status discharging` is rejected as invalid.
- `geolocation` (Req: `--target`; `--longitude`+`--latitude` recommended together, missing one warns only; Opt: `--altitude`, `--direction`): Inject GPS data (multiple options in one call).
- `scene <outdoorRunning|outdoorCycling|drivingNavigation>` (Req: `--target`): Start motion simulation.
- `sensor` (Req: `--target`; `--light-intensity`/`--humidity`/`--temperature`/`--steps`/`--heartrate`, multiple may be set in one call): Inject sensor data.
- Multi-option `geolocation`/`battery`/`sensor` commands dispatch actions sequentially and are non-atomic: on action N failure, actions 1..N-1 are already applied with no rollback; re-run the whole command to converge.
- `create <name>` (Req: `--device-type`, `--os-version`): Create instance. Opts: `--instance-path <path>` (alias `--path`), `--image-root <path>`, `--screen-profile <model>`, `--screen <config...>`, `--storage <2-1023>`, `--memory <2-32>`, `--hot-boot <true|false>`, `--force`. Device type is case-insensitive. `--screen` accepts one quoted configuration or two for a foldable device in the format `width(px) height(px) DPI screen-diagonal-length(inch)`; width/height: 720-3500 px, DPI: 240-640, screen diagonal length: 3.5-9 inch. When combined with `--screen-profile`, `--screen` takes precedence. API 26+ uses hot boot by default unless explicitly disabled.
- `delete <name>`: Delete instance. Opt: `--instance-path <path>` (alias `--path`) — required to delete an instance created with a custom path.
- `image list`: List downloaded images. Opts: `--device-type <type>`, `--all`, `--format <table|json>`.
- `image download` / `image remove` (Req: `--device-type`, `--os-version`): Download/remove image. (Takes 30+ min, set long timeout).
*Device types*: `phone`, `foldable`, `widefold`, `triplefold`, `tablet`, `2in1`, `2in1 foldable`, `wearable`, `tv`.

### `devecocli ui`
Inspect UI on a connected physical device or running emulator.
- `screenshot`: Capture a screenshot from a physical device or running emulator. `--device <name|serial>` is optional when exactly one device is connected, and required when multiple devices are connected.
- Optional: `--display <displayId>`. Required: `--path <path>` (existing directory or PNG file path, including paths relative to the current directory; writable destination; no overwrite).
- Implementation uses `hdc shell snapshot_display` and `hdc file recv`; set `DEVECO_CLI_DEBUG=1` to inspect the actual `hdc` commands.
*Ex*: `devecocli ui screenshot --device Phone --path ./screenshots/phone.png`

`screenrecord` records the screen of a physical device to an MP4 file (emulators are rejected). No subcommand enters interactive mode (Ctrl+C stops and saves); `start` returns immediately and the device keeps recording until `stop`. `--device <name|serial>` follows the same multi-device rule; interactive and `start` require `--path <dir|file.mp4>`. `status` reports `recording` / `busy` / `idle`; with `--format json`, stdout carries the JSON object. `stop --force` stops a recording not started by this CLI without downloading it (view it in the device gallery). A recording already stopped on the device can be recovered by `stop` on the same `DEVECO_CLI_DATA_DIR`. Starting again (interactive or `start`) deletes the interrupted registration without downloading the old video; the original remains in the device gallery.
*Ex*: `devecocli ui screenrecord start --device Phone --path ./recordings/` → `devecocli ui screenrecord stop --device Phone`

### `devecocli docs`
Search HarmonyOS developer documentation in the local HarmonyOS Knowledge Base — returns articles with examples and guidance on HarmonyOS APIs, ArkTS, and libraries. Typical use cases: finding API migration guides, examples for HarmonyOS APIs/ArkTS, up-to-date API references, and best practices for HarmonyOS development.
- `search <keywords...>`: Match any keyword. Opts: `--catalog <name>`, `--format <default|json>`, `--limit <n>`.
- `read <documentId>`: Read full content by ID (e.g. `devecocli docs read guides/harmonyos-guides/指南/系统/网络/网络`).
- `catalog`: List available catalogs.
- `update`: Update docs to the latest compatible version — downloads, sha512-verifies, and installs the docs-data package with atomic version switching; falls back to the bundled baseline if missing/corrupted. Opts: `--force`, `--check`.

Always use this tool to get the most up-to-date information about HarmonyOS concepts.

### `devecocli device`
Manage connected devices — device info, app management, system control, screen, files, clipboard, fonts, view mode, location mock, network simulation, and media playback. All subcommands accept `--device <name|serial>` (Req on multi-device hosts).

| Subcommand | Description | Key Options |
|---|---|---|
| `list` | Show active real devices and running emulators | `--format table\|json` (default: `table`) |
| `view` | Detailed device info | `-t <name\|serial>` (Req on multi-device), `--format table\|json` (default: `table`) |
| `sqlite3 <db-path>` | Run `sqlite3` on a device; all args after `db-path` forwarded as-is | Maps to `hdc -t <serial> shell sqlite3 <db-path> [args...]` |
| `app install [files...]` | Install hap/hsp packages | `--replace` (overwrite), `--shared <path>` (HSP libs, repeatable), `--wait <seconds>` (180–600), `--user <userId>` |
| `app uninstall` | Uninstall app by bundle name | `--bundle <name>` |
| `app list` | List installed apps | `--format default\|json` |
| `app info <bundleName>` | Show app details | `--format default\|json` |
| `app foreground` | Show current foreground app | `--format default\|json` |
| `app start` | Launch app ability | `--bundle <name>`, `--ability <name>`, `--action <action>`, `--uri <uri>` |
| `app stop` | Force-stop app | `--bundle <name>` |
| `app cleardata` | Clear app data | `--bundle <name>` |
| `app clearcache` | Clear app cache | `--bundle <name>` |
| `wake` | Wake screen | — |
| `sleep` | Suspend screen | — |
| `status` | Show screen state (AWAKE/SLEEP) | — |
| `unlock` | Wake + swipe-up to unlock (phone/tablet only, not 2in1) | — |
| `open-control-center` | Swipe to open control center (phone/tablet only) | — |
| `open-notification-center` | Swipe to open notification center (phone/tablet only) | — |
| `time [datetime]` | Get (no arg) or set system time | `[datetime]` positional arg |
| `timezone [timezone]` | Get (no arg) or set system timezone | `[timezone]` positional arg |
| `screen size` | Get screen resolution | `--format default\|json` (json: `{width, height}`) |
| `screen rotation` | Get current screen rotation | — |
| `screen rotate <angle>` | Set screen rotation angle | `<angle>`: `0\|90\|180\|270` |
| `screen rotation-lock <state>` | Lock/unlock auto-rotate | `<state>`: `on\|off` |
| `screen sleeptime <ms>` | Set screen-off timeout | `<ms>`: timeout in ms; `-1` = never sleep |
| `file send <local> <remote>` | Push file to device | `<local>` source path, `<remote>` dest path |
| `file recv <remote> <local>` | Pull file from device | `<remote>` source path, `<local>` dest path |
| `file exist <path>` | Check if file exists on device | `<path>` on-device file path |
| `file delete <path>` | Delete file on device | `<path>` on-device file path |
| `clipboard read` | Read clipboard text | — |
| `clipboard write <text>` | Write text to clipboard | `<text>` positional arg |
| `clipboard clear` | Clear clipboard | — |
| `font info <fontpath>` | Query font info | `<fontpath>` font file path |
| `font install <fontpath>` | Install font file | `<fontpath>` font file path |
| `font uninstall <name>` | Uninstall font by name | `<name>` font name |
| `viewmode` | Get current dark/light mode | — |
| `viewmode dark` | Set dark mode | — |
| `viewmode light` | Set light mode | — |
| `location set` | Mock location from coordinates | `--latitude <degrees>`, `--longitude <degrees>`, `--altitude <m>`, `--speed <m/s>`, `--direction <degrees>` (0–360), `--interval <seconds>` (1–3600, default 1) |
| `location set` (gpx) | Mock location from GPX file | `--gpx-file <path>`, `--interval <seconds>` (mutually exclusive with lat/lon mode) |
| `location enable` | Turn on location mock (also done automatically by `set`) | — |
| `location disable` | Turn off and restore real location | — |
| `network-sim start` (preset) | Start preset scenario (1–8) | `--id <n>` |
| `network-sim start` (custom) | Start custom network scenario | `--name <n>`, `--up-bandwidth <bps>`, `--down-bandwidth <bps>`, `--up-latency <ms>`, `--down-latency <ms>`, `--up-drop <0-1>`, `--down-drop <0-1>` (`--id` and custom options mutually exclusive) |
| `network-sim stop` | Clear simulation, delete custom scenario, disable netcopilot (idempotent) | — |
| `network-sim list` | Show preset scenarios | — |
| `network-sim status` | Report enabled/disabled | — |
| `playback list` | Show active media sessions (bundle name + session ID) | — |
| `playback play` | Play media | `--id <sessionID>` or `--bundle <bundleName>` |
| `playback pause` | Pause media | `--id <sessionID>` or `--bundle <bundleName>` |
| `playback next` | Next track | `--id <sessionID>` or `--bundle <bundleName>` |
| `playback previous` | Previous track | `--id <sessionID>` or `--bundle <bundleName>` |
| `playback forward` | Fast forward (step size app-defined) | `--id <sessionID>` or `--bundle <bundleName>` |
| `playback rewind` | Rewind (step size app-defined) | `--id <sessionID>` or `--bundle <bundleName>` |
| `playback seek` | Jump to position | `--position <seconds>`, `--id <sessionID>` or `--bundle <bundleName>` |

- `location`: requires system version 7.0+ (testhelper).
- `network-sim`: requires API 20+ (netcopilot).
- `playback`: requires system version 6.1+ (ohos-avsession-manager).



### `devecocli run` `[Outside sandbox]`
Build, install, and launch. After a successful ability launch (and after a successful `--apply`), runs a **default smoke check**. Success prints `Smoke: PASS`; failures print `Smoke: FAIL_CRASH` or `Smoke: FAIL_BLANK` (crash log path via `crash_log:`, blank screenshot via `screenshot:`) and exit non-zero. Smoke is skipped when there is no ability to launch, and for `--hotreload` / `--hotreload-apply`.
- `--module <m1> [m2...]`: Target module(s) (auto-selected if only one runnable).
- `--device <name|serial>`: Target device (Req if multiple connected).
- `--product <product>` / `--build-mode <mode>`: Defaults: `default` / `debug`.
- `--ability <ability>`: Default from `module.json5`.
- `--uninstall`: Uninstall existing app first (Fixes signing key issues).
- `--skip-build`: Deploy existing artifacts.
- `--debug-line`: Forward `-p debugLine=true` to hvigor for the full build, `--apply`, and hot-reload compiles (default: disabled).
- `--apply <fileName>`: **Fast incremental deploy** — rebuilds only changed files into a signed hqf, installs via `bm quickfix -a -f -o`, then restarts the app. Much faster than a full `devecocli run` for iterating on code changes. Modules are auto-detected from the file paths in `<fileName>` (no `--module` needed).
  - `<fileName>`: a plain file name (no path separators) under the project's `.hvigor/` directory; the caller writes the changed-file list there. File name is sanitized to prevent path traversal. Content: list of **source file paths changed this round** (one per line, relative to project root or absolute; `#` comments and blank lines ignored; typically `.ets`/`.ts`/`.cpp`/resource files). The changeFileList is **incrementally merged** — only list files changed since the last apply; previously listed files are retained automatically.
  - **Prereq**: DevEco Studio ≥6.1.1 (hvigor `assembleDevHqf` support; below is rejected with an upgrade hint); run `devecocli run` once first (full build + deploy — `--apply` reuses its build intermediates and generates its own short-lived `buildConfig.json` per apply). Normal `run`/`build` clears the symbol table required by cold-reload ArkTS patches; the first `--apply` with ArkTS changes after a normal build automatically runs a full `assembleHap`/`assembleHsp` bootstrap (by module type) to regenerate it (may take tens of seconds on a cold cache; resource-only applies skip this). Consecutive applies without an intervening normal build reuse the symbol table and are fast.
  - **Do not mix with an active `--hotreload` watch session**: both drive patch builds over the same per-module `buildConfig.json`; stop the session (`--hotreload stop`) first.
  - **If changes don't take effect**: on any apply failure, fall back to a full `devecocli run`. Note: the bootstrap rebuild produces a hap containing `ets/symbolMap.map` (hot-reload compilation side effect); this is harmless for `--apply` (only the hqf is installed, not the hap) and the next normal `run`/`build` cleans it — a later `run --skip-build` would deploy that regenerated hap as-is.
*Ex*: `devecocli run` → edit code → write `.hvigor/changes.txt` → `devecocli run --apply changes.txt`
- `--hotreload [action]`: **Hot-reload watch session** — must be started as a **background process** (the process holds a persistent socket to the hvigor daemon). It builds the hap in hot-reload mode (`hotReload=true debuggable=true`), deploys+launches the app, then the process itself connects a socket to the daemon and sends `CommonBuild assembleHap --hot-reload-build --watch`, **staying connected** so the daemon's watch worker (rollup watch) stays alive for `--hotreload-apply` to reuse. The process stays alive (onBuildOutput streams to its stdout). **Must be stopped (kill the background process) when the hot-reload debug session ends** — otherwise the watch worker/daemon leaks. `--hotreload stop` additionally stops the hvigor daemon.
  - **Usage**: start `devecocli run --module <m> --hotreload` as a background process; wait for the `.hotreload-mode` marker (or "watch session active" on its stdout) = ready; then run `devecocli run --module <m> --hotreload-apply <file>` (foreground). When done: kill the background process + `devecocli run --hotreload stop`.
- `--hotreload-apply <fileName>`: **Hot reload without app restart** — reads the changed-file list from `.hvigor/<fileName>` (same format/merge rules as `--apply`), opens a **short socket** to the daemon (kept alive by the background `--hotreload` process) and sends `CommonBuild assembleDevHqf --hot-compile` → the watch worker incrementally hot-compiles changed `.ets`/`.ts` into abc (HotReloadArkTS; output/errors streamed live via WatchLog), then **manually** packs + signs a hqf from that abc (`app_packing_tool.jar` + `hap-sign-tool.jar`, DevEco material password decrypted via `DecipherUtil`), and installs it via `bm quickfix -a -f -o`. The app is **not restarted** — changes take effect immediately.
  - **Prereq**: the background `devecocli run --hotreload` process must be running (holds the watch session). If `--hotreload-apply` times out, the watch session isn't alive — (re)start the background `--hotreload`.
  - **Session exclusivity**: do not run `--apply` or a normal `run`/`build` against the project while the watch session is live — they clear the `buildConfig.json` the session's hot compile depends on. Stop the session (`--hotreload stop`) first, restart it after.
  - **Scope (important)**: hot reload targets a **single module** (`--module` required; the target can be entry/hsp/feature; `har` deps are folded in and fine). **`har` dependency changes are auto-routed** to the dependent main module's (entry/feature/hsp) `hotReload/changedFileList.json` — so editing a har's `.ets` and listing it hot-reloads via the target module. Changes in **`feature`/`hsp` dependency modules** (not the target) are NOT hot-reloadable — they're detected and warned (run a full `devecocli run` to redeploy those). `@State`/state-decorator changes are **not** hot-reloadable (state isn't re-initialized); hot-reloadable changes are non-state code: UI property values (`.fontColor`/`.fontSize`), `Text`/`Button` literal labels, method bodies, expressions. Resources/native changes need a full run.
  - **Compile errors**: ArkTS compile errors from the hot compile are routed (via WatchLog) to the **background `--hotreload` process**, which writes them to **`.hvigor/hotreload-watch.log`** (and its stdout). On failure, `--hotreload-apply` reads that file and prints the errors inline (fast-fail, ~15s timeout if the watch session is dead).
  - **Artifacts under `.hvigor/`** (shared with `--apply`): `.hvigor/<fileName>` = the changed-file list you write; `.hvigor/hotreload-watch.log` = the watch session's onBuildOutput/compile-errors (written by the background `--hotreload` process; safe to read/delete). The hot-reload marker is `<module>/build/<product>/.hotreload-mode`.
*Ex*: background `devecocli run --module entry --hotreload` → (ready) → edit `.fontColor` in `entry/src/main/ets/pages/Index.ets` → write path to `.hvigor/changes.txt` → `devecocli run --module entry --hotreload-apply changes.txt` (UI updates without restart). When done: kill the background process + `devecocli run --hotreload stop`.

### `devecocli signature generate` `[Outside sandbox]`
Auto-generate HarmonyOS signing materials (local p12/csr + cloud cert + profile) and write signing config to `build-profile.json5`. Supports `debug` and `release` signing types.
- **Prereq**: Authenticate with `devecocli auth login --no-prompt` if needed and authorized (see Setup); run from a project directory (with `build-profile.json5`); a connected device or emulator is required for device registration (debug only; release signing skips device registration).
- `--product <name>`: Product name for local p12/csr file naming (default: `default`).
- `--team-id <id>`: Specify the team-id (default: current user's id).
- `--type <type>`: Signing type: `debug` or `release` (default: `debug`). Release uses real provision endpoint and release certificate type; debug uses test provision and debug certificate.
- `--force`: Force regenerate even if existing materials are valid.
- Generates under `~/.ohos/config/`: `.p12` keystore, `.csr`, downloaded `.cer` certificate, `.p7b` profile. Debug and release materials use separate file paths (release paths include `_release` segment).
- Writes `signingConfigs` + `products` entries to `build-profile.json5` with encrypted key/store passwords (AES-128-GCM). Release configs use `<product>_release` as the config name.
- Cloud cert name: `auto_debug_<teamId>.cer` (debug) or `auto_release_<teamId>.cer` (release). Key alias: `debugKey` (debug) or `releaseKey` (release).
- Error handling (aligned with DevEco Studio JAR): 401→re-login, 403→no AGC permission, `205389872`→cert limit, `205389904`→not Harmony user, `205389938`→provision limit, invalid `.cer`→retry.
*Ex*: `devecocli signature generate --product default` / `devecocli signature generate --type release`


### `devecocli log`
Fetch hilog or crash logs. Req `--device <name|serial>` on multi-device hosts.
- `--crash`: Dump crash logs.
- `--level D|I|W|E|F`: Filter by level.
- `--bundle-name` / `--keyword`: Filter output.
- `--from <start>` / `--to <end>`: Relative offsets (`30s`, `5m`).
- `--tail <num>` / `--follow`: Keep last N lines / stream real-time (no `--to`).
- `--path <path>` + `--crash`: Analyze a local fault log file or directory (cpp_crash / js_crash / app_freeze) instead of pulling from device; picks the most relevant candidate when given a directory.
- `--stack` + `--path <file>`: Analyze a local sample stack file (enhanced log); mutually exclusive with `--crash`.
- `--format default|json|report|hilog`: Output format for local analysis (`hilog` extracts the HiLog section, `--crash` only).
- `--limit <num>`: Max hotspots shown by `--stack` (default 20).
- `--path` cannot be combined with device log options (`--device`, `--level`, `--bundle-name`, `--keyword`, `--tail`, `--from`, `--to`, `--follow`).
*Ex*: `devecocli log --crash --bundle-name com.example.app`, `devecocli log --level E --from 5m --tail 200`, `devecocli log --crash --path ./faultlog --format report`, `devecocli log --stack --path sample_stacks.txt --limit 20`

### `devecocli verify`
Run UI verification on a connected device. Based on natural-language functional steps, the tool launches the app, uses screenshots to judge the current UI state, performs UI operations, and verifies whether the functionality completes correctly. This is the standard tool for UI testing and issue reproduction.

Supported operations include tap, double-tap, swipe, long press, key input, mouse, and keyboard actions. Supported navigation includes direct navigation to a specified page via a URI in a test step. When using URI navigation, the test plan must provide the complete, explicit, directly executable URI; do not only describe the target page or omit the URI content.

- `--test-plan <plan>` (**required**) — Natural-language test plan describing each step and its expected result. The test plan must not exceed 3000 characters. **Must be wrapped in single quotes** (`--test-plan '...'`) to prevent shell interpretation. Write a clear, specific plan based on the user's description. Example:
  ```
  1. 启动应用，预期：进入应用主界面，底部显示「书架」「发现」「订阅源」三个Tab
 	2. 点击「发现」Tab，预期：进入发现页面
 	3. 点击「订阅源」Tab，预期：进入订阅源页面
 	4. 点击「书架」Tab，预期：返回书架页面
  ```
- `--bundle-name <name>` — Bundle name of the app to be tested; auto-detected from `AppScope/app.json5` when omitted.
- `--no-fresh-start` — Skip relaunching the app before verification; omit to relaunch by default.
- `--device <name|serial>` — device name (substring) or serial; auto-selected on single-device hosts, **required on multi-device hosts**. Quote names with spaces (e.g. `--device "Mate 70 Pro"`).

Output JSON contains `success`, `reason` (failure cause), `successPart`, `failPart`, `failType`, and `id` (unique task ID for log and screenshot retrieval). `failType` is `''` when verification passed. Otherwise it is `verification_failed` (a step did not meet its expectation), `unsupported` (a required action is outside the tool, including sound, haptics, and acting on a moving target), `invalid_plan` (the plan is not a valid test, or this device cannot run it), `execution_error` (the run stopped before a conclusion), or `inconclusive` (the evidence cannot separate an app failure from a tool limit, including the round limit).

Each UI verification run is limited to 10 minutes.

Usage guidance:
- Write a test plan based on the user's description and call `devecocli verify --test-plan '...'`
- If log analysis is needed, call `devecocli verify log --id <id>` to retrieve the execution log
- If screenshots are needed, call `devecocli verify screenshot --id <id> --save-path <path>` to save step-by-step screenshots

Examples:
- `devecocli verify --test-plan '1. 启动应用，预期：进入应用主界面'`
- `devecocli verify --test-plan '1. 启动应用，deeplink跳转到"aigomall://test/order-confirm"，预期：显示订单提交页面'`
- `devecocli verify --test-plan '1. 启动应用，预期：进入应用主界面' --bundle-name com.example.app`
- `devecocli verify --test-plan '1. 启动应用，预期：进入应用主界面' --no-fresh-start`
- `devecocli verify --test-plan '1. 启动应用，预期：进入应用主界面' --device 127.0.0.1:5555`

### `devecocli verify appanalyzer` `[Outside sandbox]`
Run local health checks for apps and atomic services through the bundled AppAnalyzer CLI: it inspects the running app, then reports analysis guidance and fix suggestions.
- **Prereq**: Command Line Tools install source (not available in DevEco Studio) with the AppAnalyzer component. Run `devecocli verify appanalyzer init` before any check to initialize the environment.

| Subcommand | Description |
|---|---|
| `init` | Initialize the tool environment (installs Python dependencies). |
| `autoAnalyze` | Automated page traversal + detection. |
| `uxAnalyze` | Manual single-page UX detection; put the device on the target page and keep the screen on first. |
| `powerAnalyze` | Manual power-consumption detection: records ~15s of the app standing by in the foreground, then reports. Real devices only. |

- **Common options**: `-b/--bundleName` (Req), `-p/--projectPath` (Req), `-s/--scenes` (default: recommended scenes), `-d/--device <serial|IP:port>` (default: first available real device, else first emulator), `-o/--output <reportPath>` (default: cwd), `-m/--hapPaths` (only with the basic scene, for icon checks).
- `autoAnalyze` also takes `-t/--duration <minutes>` (5–240, default `10`).
- Reports are written as both JSON and ZIP to the output path.

**Scenes** — `-s` takes a category (`Dxx`, runs every scene under it) or individual scenes (`Sxx`, comma-separated):

| Category | Meaning | Scenes |
|---|---|---|
| `D03` | UX — multi-device layout adaptation | `S14` truncation, `S15` large image/large font, `S16` white space, `S17` avoid-area occlusion, `S18` foundation |
| `D04` | Power consumption | `S11` foreground standby |

*Ex*: `devecocli verify appanalyzer init`
*Ex*: `devecocli verify appanalyzer autoAnalyze -b com.example.app -p ./MyApp -s D03 -t 5 -o ./output`
*Ex*: `devecocli verify appanalyzer uxAnalyze -b com.example.app -p ./MyApp -s S14,S15 -d 127.0.0.1:5555`
*Ex*: `devecocli verify appanalyzer powerAnalyze -b com.example.app -p ./MyApp`

### `devecocli verify log`
Retrieve the execution log of a verification task by ID.

- `--id <id>` (**required**) — Task ID from the `id` field in `verify` output.
- `--search-keywords <keywords>` — Filter to lines containing the keyword; **wrap value in single quotes**.
- `--max-log-size <n>` — Max characters to show (default `5000`; `-1` for unlimited).

Examples:
- `devecocli verify log --id <id>`
- `devecocli verify log --id <id> --search-keywords 'error' --max-log-size -1`

### `devecocli verify screenshot`
Save step-by-step screenshots from a verification task to a specified directory; returns a list of saved file paths.

- `--id <id>` (**required**) — Task ID from the `id` field in `verify` output.
- `--save-path <path>` (**required**) — Absolute path to the target directory (created automatically if it does not exist).

Examples:
- `devecocli verify screenshot --id <id> --save-path 'C:\Users\user\Desktop\screenshots'`

### `devecocli ui`
Inspect UI on a connected device. All subcommands accept `--device <name|serial>` (Req on multi-device hosts).

| Subcommand | Description | Key Options |
|---|---|---|
| `layout` | Dump ArkUI accessibility layout tree — **visible area only** (on-screen nodes). Requires device API 20+ | `--id <id>`, `--window <windowId>`, `--all-windows`, `--depth <n>` (0=unlimited, 1=root only, 2=root+children), `--format default\|json`, `--mode full\|simplified` |
| `window list` | List active windows | `--format default\|json`, `--all` (include system windows) |
| `screenshot` | Capture a screenshot of the device screen | `--display <displayId>`, required `--path <path>` (existing directory or PNG file path; relative paths supported; writable destination; no overwrite) |
| `screenrecord` | Record the screen to an MP4 file (physical devices only; emulators are rejected) | interactive by default, or `start` / `stop` / `status`; required `--path <dir|file.mp4>` for interactive and `start`; `stop --force` stops a recording not started by this CLI; `status --format table\|json` |
| `click [x] [y]` | Tap at the specified coordinates or node | `--id <id>` (auto-resolves to center), `--selector <expr>`, `--window <windowId>` (used with `--id` or `--selector`) |
| `doubleclick [x] [y]` | Double-tap at the specified coordinates or node | `--id <id>`, `--selector <expr>`, `--window <windowId>` |
| `longclick [x] [y]` | Long-press at the specified coordinates or node | `--id <id>`, `--selector <expr>`, `--duration <ms>` (500–60000, default 1000), `--window <windowId>` |
| `swipe <x1> <y1> <x2> <y2>` | Swipe from one point to another (coordinates or element mode) | `--start <expr> --end <expr>` (element mode; both required together), `--speed <n>` (200–40000, px/s) |
| `fling <x1> <y1> <x2> <y2>` | Fling from one point to another | `--speed <n>` (200–40000, px/s) |
| `drag <x1> <y1> <x2> <y2>` | Drag from one point to another (coordinates or element mode) | `--start <expr> --end <expr>` (element mode; both required together), `--speed <n>` (200–40000, px/s) |
| `dircfling <direction>` | Quick directional fling (system default speed, ideal for scrolling) | `direction`: `up`, `down`, `left`, `right` |
| `text <text> [x] [y]` | Input text at a target location or the currently focused field | `--id <id>` (auto-resolves to center), `--selector <expr>`, `--window <windowId>` (used with `--id` or `--selector`) |
| `cleartext` | Clear text via Ctrl+A + Del (optionally click target element first) | `--selector <expr>` (click before clearing; default: focused field), `--window <windowId>` |
| `scrolltostart` | Scroll a scrollable container to the start (top) | `--selector <expr>` (default: first scrollable element), `--speed <n>` (200–40000, default 1500), `--timeout <ms>` (1–3600000, default 60000) |
| `scrolltoend` | Scroll a scrollable container to the end (bottom) | `--selector <expr>` (default: first scrollable element), `--speed <n>` (200–40000, default 1500), `--timeout <ms>` (1–3600000, default 60000) |
| `scrollsearch <selector>` | Scroll within a container and search for a target element | `--scroll-selector <expr>` (default: first scrollable element), `--vertical <true\|false>` (default true), `--offset <n>` (≥0, default 80), `--timeout <ms>` (1–3600000, default 60000) |
| `pinch <scale> [x] [y]` | Pinch (zoom) at an element or coordinates | `--selector <expr>`, `--area-radius <n>` (integer ≥50; default: 300 for coords, 90% of area for element/screen), `--speed <n>` (600–3000, default 600), `--window <windowId>` |
| `rotate <angle> [x] [y]` | Two-finger rotation at an element or coordinates | `--direction <cw\|ccw>` (default cw), `--selector <expr>`, `--radius <n>` (50–500, default 300), `--speed <n>` (200–40000, default 1500), `--window <windowId>` (used with `--selector`) |
| `press_key <key1> [key2] [key3]` | Press hardware/system key(s), up to 3 for combos | keys: string name (`back`/`enter`/`ctrl_left`) or numeric keycode |
| `find [selector]` | Find UI element(s) by selector DSL, XPath, or base64 — polls until match or timeout | `--device`, `--window <windowId>`, `--all` (return all matches), `--timeout <ms>` (default 3000, max 360000), `--format default\|json` |
| `wait [timeoutMs]` | Wait for element to appear/disappear, or pure sleep if no selector | `--device`, `--window <windowId>`, `--disappear` (wait for element to disappear; requires selector); `<selector>` as positional arg triggers element wait mode |

- **Coordinates vs `--id`/`--selector`**: Mutually exclusive. Provide either `x y`, `--id <id>`, or `--selector <expr>`. For `text`, if none is given, text goes to the currently focused field. For `swipe`/`drag`, use either coordinates or `--start <expr> --end <expr>` (both required together).
- **`--window`**: Default is focused window. May be used with `--id`, `--selector`, or coordinate mode.
- **Selector DSL**: `key op value` clauses, `,`-separated for AND, `[n]` for index. Operators: `=` (exact), `*=` (contains), `^=` (prefix), `$=` (suffix), `/=` (regex). Also supports `xpath=` prefix for XPath 1.0 expressions and `base64=` prefix to escape shell/DSL special characters. Duplicate property keys (including `desc`/`description` aliases) are rejected.
- **`swipe`/`drag` element mode**: `--start <expr> --end <expr>` resolves each selector to bounds center, then performs the swipe/drag. Both must be provided together.
- **`find`/`wait`**: `find` polls the UI tree every 300ms until a match is found or `--timeout` expires. `wait` without a selector is a pure sleep; with a selector, polls for appearance (default) or disappearance (`--disappear`).
- **`swipe` vs `dircfling`**: `swipe` requires exact start/end coordinates (or `--start`/`--end`) and supports `--speed`; `dircfling` only needs a direction (`up/down/left/right`) and uses system default speed (ideal for page/list scrolling).
- **`scrollsearch`**: The target `<selector>` does not support an index (`[n]`); passing one triggers an error.
- **Text encoding**: Special characters in `text` are Base64-encoded internally to safely pass through device shell.
- `--format json` pairs well with `jq`.
- `--mode full`: full layout tree, no filtering.
- `--mode simplified` (default): folds meaningless wrapper containers (non-root, no `id`, no text, not interactive) by lifting their surviving children up. `--depth` truncates after folding.

### `devecocli testing` `[Outside sandbox]`

Run DevEco Testing detection services on a connected device.

| Sub-command | Parameters |
|---|---|
| `list` | — (`ServiceKey`, `Status`) |
| `install` | `--service <serviceKey>` |
| `update` | `--service <serviceKey>` |
| `run <serviceKey>` | `--package <bundleName>`, `--sn <serial[,serial]>`, `--duration <minutes>`, `--yes` |
| `stop` | `--task-id <taskId>` |
| `userinfo`, `exit` | — |

Parameter reference: `devecocli testing <sub-command> --help`.

```powershell
devecocli testing list
devecocli testing install --service MemLeakTest
devecocli testing update --service MemLeakTest
devecocli testing run MemLeakTest --package com.example.myapp --sn <serial> --duration 10 --yes
```

**Device**: `--sn` must be the device the user confirmed. With several devices connected (`devecocli device list`), ask which one to test and wait for the answer; never default to the first serial.

**Progress**: run `testing run` with the globally installed CLI (`& "$env:APPDATA\npm\devecocli.cmd"` on Windows, `"$(npm prefix -g)/bin/devecocli"` elsewhere) so output streams.

**Result**: the run ends with `[REPORT] 报告已生成: <dir>`; read `<dir>/export/2d_report_data.json` (`isTaskPass`, `expandData[].resultSummary`, `expandData[].resultDetails[].status`) or `<dir>/export/Task-*.html` — never print the JSON. Services that write no `2d_report_data.json` keep the verdict in `<dir>/report/<taskId>_report.json` (`taskResult.taskPass`). Exit code stays `0` even when the task fails; on failure read `[ERROR]` / `[SUGGEST]`.

## 2. Setup

### Agent Plugins

When this skill is provided by an agent plugin, follow its injected Runtime guidance for CLI selection, installation and updates. Plugin commands are available only in that environment; standalone CLI users follow the setup commands below.

### `devecocli init`
MUTUALLY EXCLUSIVE modes for setup:
1. `--skill` (Default): Install all bundled skills (`deveco-cli`, `hmos-arkui-develop-skill`, `hmos-dfx-analyzer`) to AI agents; each skill is linked into the agent skill paths pointing to the CLI package.
2. `--mcp`: Configure `deveco-mcp` server (ArkTS/C++ syntax checking).
*Options*:
- `--agent <agents>`: Comma-separated (e.g. `opencode,pi,cursor`). Defaults to detected agents.
- `--project <path>`: Project-level config (Abs path for MCP).
- `--path <path>`: Direct skill install path; cannot combine with `--agent`, `--project` or `--mcp`.
- `--with-homegraph`: With `--mcp` only. Also install the `homegraph` CLI and write a sibling `homegraph` MCP entry; records an opt-in marker so `devecocli update` can upgrade it later. Errors if used without `--mcp`.
*MCP Rules*: Configured MCP agents support global (no `--project`) and project-level setup; `qoder` is unsupported.
*Skill agents*: See README.md, “Skill 支持的智能体”. All supported agents allow global and project installation. If an agent is not detected, specify `--agent`.

**Existing Skill paths and MCP entries are skipped by default. To update them or convert copied Skill installations to symlinks, rerun `devecocli init -f` (or `--force`); old content and local edits will be deleted.** This flag also allows missing target directories to be created. Correct links are kept and follow CLI updates; failed linking falls back to copying. `skills remove` rejects bundled skill names and never touches the npm package. Bundled skills newly added by a CLI upgrade are installed by rerunning `devecocli init` (already-installed links follow package updates automatically).

### `devecocli auth login`
Sign in to your Huawei Developer account. Opens a browser for OAuth authentication. Required before `signature generate`. On an interactive terminal it waits for Enter before opening the browser; pass `--no-prompt` to open it immediately (also auto-skipped when stdin is not a TTY).
For login and CLI/runtime installation, use existing user authorization from the conversation and ask only if it is missing. Once login is authorized, run `devecocli auth login --no-prompt` directly instead of asking the user to run it in a terminal. The user still completes authentication in the browser; `--no-prompt` only skips the terminal Enter confirmation.
*Ex*: `devecocli auth login --no-prompt`

### `devecocli auth logout`
Sign out and clear locally stored credentials.

### `devecocli auth status`
Show the current logged-in user.

### `devecocli auth team list`
List team accounts the current user has joined.

### `devecocli skills`
The skills command manages HarmonyOS skills for AI agents and projects, supporting listing, keyword search, installation and uninstallation. Use this tool when you need to view, search, add or remove HarmonyOS skills bound to AI agents or projects.
- `list [-l|--long]` / `find <keyword>`: List or search skills; bundled skills are shown first with the `[built-in]` marker and remain visible when the marketplace is unreachable.
- `add (--all | --skill <name>) [--agent <a,b…>] [--project <path>] [--path <path>] [-f]`: Install. A `--skill` name that is bundled in `packages/cli/skills` is rejected — use `devecocli init` (those skills update with the CLI package). `--all` installs marketplace skills only. (`hmos-design2arkts`, shipped with the design2arkts engine, is the exception: it is bundled but installed on demand through `add`.)
- `remove --skill <name> [...]`: Uninstall (marketplace skills; names bundled in `packages/cli/skills` are rejected — they follow the CLI package). `-f` also removes modified managed Skills, deleting their local edits.
- Ordinary project paths such as `skills/` and `data/` require an explicit `--agent` for installation or removal; automatic selection ignores them.
A minimum set is bundled with the CLI and installed by `devecocli init`: `hmos-arkui-develop-skill` (ArkTS red-line rules, fatal pitfalls + accurate API entry) and `hmos-dfx-analyzer` (DFX fault triage: input normalization, deterministic fault classification and routed analysis for crashes, freezes and faultlogs) — covering pre-coding constraints and fault diagnosis.

Routing: load `hmos-arkui-develop-skill` before writing or modifying `.ets` UI code, `hmos-dfx-analyzer` for fault analysis (crash/freeze/ANR, CppCrash, JSCrash, AppFreeze, faultlogs), and use `deveco-cli` commands for build/run/device/log work. `hmos-one-sdk-skill` is not bundled with the CLI; install it on demand with `devecocli skills add --skill hmos-one-sdk-skill`.

**Existing Skill paths are skipped by default. Use `-f` / `--force` to replace them, deleting old content and local edits. To convert copied agent installations to symlinks, rerun `devecocli init -f` for bundled skills or `devecocli skills add --skill <name> -f` for other Skills.** This flag also allows missing target directories to be created. Correct links are kept; failed linking falls back to copying. Batch installation continues after failures, prints a summary and exits nonzero if any Skill fails.

Extracted skills are stored in <CLI data directory>/skills/store/<name> globally or <project>/.deveco-cli/skills/store/<name> per project (consider ignoring .deveco-cli/skills/ in version control). Agent skill entries like .agents/skills/<name> link directly to this store, reusing existing files for new Agents. Bundled skills skip the store: their agent entries link directly into the CLI package, so they update with `npm update` of the CLI. Note that -f updates affect every linked Agent in that scope.

*Ex*: `devecocli skills add --skill <name> --agent opencode --project ./MyApp`

### `devecocli plugin`
Manage whitelisted npm-packaged AI agent plugins (official registry only; the whitelist `npmPackage` coordinate may carry a `@tag` suffix to select a dist-tag, e.g. `@scope/pkg@cli` — defaults to `latest`).
- `list [-l|--long]`: List whitelisted plugins and locally downloaded versions in a `Name / Version / Status` table (one row per cached version, ascending; `not installed` when none); `--long` appends `NpmPackage` and `Desc` columns.
- `install <name> [--agent <a,b…>] [--project <path>] [-f]`: Download the package into the CLI data directory, then run the plugin's `install` hook per target agent (detected agents ∩ plugin `supportedAgents`; a plugin omitting `supportedAgents` defaults to all known agents, while an explicitly empty/unknown list fails contract validation). `--force` runs the previous version's `uninstall` hook first. With an explicit `--agent` plus `--project`, missing target skills dirs (including the `.<agent>` root) are created before hooks run, matching `init --project --agent`.
- `update <name> [--agent <a,b…>] [--project <path>]`: Fetch the latest version and run the `update` hook (`from`/`to` provided; `from` is the highest pre-download store version — `from === to` means no local version or latest already cached, treat as repair/first install). With an explicit `--agent` plus `--project`, missing target skills dirs (including the `.<agent>` root) are created before hooks run, same as `install`.
- `uninstall <name> [--agent <a,b…>] [--project <path>]`: Run the `uninstall` hook of the highest loadable local version. Never deletes cached packages (`<dataDir>/plugins/store/<name>/`) or plugin data (`<dataDir>/plugins/data/<name>/`); remove those manually if needed.
- Hook execution is capped at 120s (override with `DEVECO_CLI_PLUGIN_HOOK_TIMEOUT_MS`).

*Ex*: `devecocli plugin install example-plugin --agent opencode --project ./MyApp`

### `devecocli check compat` `[Outside sandbox]`
Scan source code for breaking API changes between two SDK versions. Built on top of DevEco Studio's `arkanalyzer-apiscan` plugin (Studio ≥ 26.0.0.810) or Command Line Tools' `apicompat` component (CLT ≥ 26.0.1). On Linux, CLT is required.
- `versions`: List available target SDK versions. Opts: `--format <default|json>` (default: `default`).
- Default (no args): project-level scan.
- `--modules <m1> [m2...]`: Module-level scan.
- `<file1> [file2...]`: File-level scan (`.ets`/`.c`/`.cpp` only).
- `--source-version <v>` (Req) / `--target-version <v>` (Req): SDK version pair. Run `devecocli check compat versions` first; on zsh, **quote the value** (e.g. `"<source_version>"`, `"<target_version>"`).
- `--format <default|csv|json>` (default: `default`): Console output accepts `default` (text) or `json`; file output (via `--output-path`) accepts `default` (csv), `csv`, or `json`. `csv` requires `--output-path`.
- `--output-path <path>`: Directory (writes `apiChange-*.csv`/`apiChange-*.json`) or explicit file (extension must match `--format`).
- `--limit <n>` (default `100`): Max records shown on console when no `--output-path`.

Validation order: `files` + `--modules` mutually exclusive → `--source-version`/`--target-version` required → `csv` requires `--output-path` → project dir valid → modules exist → files exist + extension valid → versions in catalog + `target > source` → format/extension match → output target writable.

*Ex*: `devecocli check compat --source-version "<source_version>" --target-version "<target_version>" --output-path ./report`

### `devecocli design2arkts` (alias: `d2a`)

Use `devecocli d2a --help` for Pixso/Figma design-to-ArkTS workflows and standalone capabilities accepting local images or code without a prior D2A run.

Solution design supports UI pages only; repository analysis covers the target page and its dependencies. The Pixso workflow proceeds from repository understanding to page design. Follow the Controller-returned stage IDs; they are not guaranteed to be consecutive.

## 3. Maintenance

- **`devecocli update`** `[Outside sandbox]`: Update CLI to latest version.
- **`devecocli serve mcp`**: Host stdio MCP server (`check` tool for `.ets`/C/C++). Used via `init --mcp`. (Env: `PROJECT_PATH`, `DEVECO_PATH`, `NODE_MAX_OLD_SPACE_SIZE`, `DEBUG=1`).
- **`devecocli serve lsp`**: Host a bundled stdio **LSP** language server — `--arkts` (ArkTS, ace-server) or `--cpp` (clangd). Standard LSP protocol: completion, go-to-definition, hover, references, diagnostics. Opts: `--project-path <path>` (used as-is), `--auto-detect` (search cwd and subdirs for project root; ignored when `--project-path` given).
  - Agents/editors with a built-in LSP client drive it directly — e.g. **opencode** (`lsp` config in `opencode.json`), **Zed**, **Neovim**, **VS Code**, **Emacs**:
    `"lsp": { "ArkTS": { "command": ["devecocli", "serve", "lsp", "--arkts"], "extensions": [".ets"] } }`
  - MCP-only agents (no LSP client) can bridge via [agent-lsp](https://github.com/blackwell-systems/agent-lsp), an MCP server that wraps any stdio LSP. MCP command: `["agent-lsp", "ets:devecocli,serve,lsp,--arkts"]`.
  - **`serve lsp` is a long-running stdio server, not a shell command — never execute it directly.** Look up how the target agent registers a custom LSP server in its own documentation, then plug in the commands above.
  - **Never wire `serve lsp` and `serve mcp` into the same agent.** Each spawns its own ace-server/clangd, so running both doubles memory. Pick one: direct LSP or MCP — **prefer MCP** (simpler to integrate, initialization built in).

## Recipes

- **Fresh checkout to emulator**:
  `devecocli build` -> `devecocli emulator list` -> `devecocli emulator start "Name"` -> `devecocli run`
- **Diagnose crash**:
  `devecocli log --crash --bundle-name <bundle>` (device), or `devecocli log --crash --path <faultlog file|dir> --format report` (local analysis), or `devecocli log --stack --path <sample_stacks file>` (freeze hotspot analysis)
- **Release build**:
  `devecocli build --product oversea --build-mode release`
- **First-time signing setup** (login authorized; user completes browser authentication):
  `devecocli auth login --no-prompt` -> `devecocli signature generate --product default` -> `devecocli build` -> `devecocli run`
- **One-sentence detection run** (e.g. "测试商城应用内存泄漏"):
  read `AppScope/app.json5` for the bundle name and `devecocli device list` for the serial ->
  `devecocli testing list` -> `devecocli testing install --service MemLeakTest` if `Not installed` ->
  `devecocli testing run MemLeakTest --package <bundleName> --sn <serial> --duration 240 --yes` -> summarize `[REPORT]`

## Troubleshooting

- **"Product / Build mode `<x>` not found"**: Check `build-profile.json5`.
- **"Multiple entry modules" / "No entry module"**: Pass `--modules` (build) or `--module` (run).
- **"No active devices" / "Multiple devices connected"**: Connect/start emulator. Pass `-t <serial>` (device view) or `--device <name|serial>` (run/log).
- **`error:install sign info inconsistent`**: Signing key changed. Run `devecocli run --uninstall` or `devecocli signature generate --force`.
- **`Not logged in. Run devecocli auth login first`**: Run `devecocli auth login --no-prompt` with login authorization (see Setup).
- **`Provision number exceeds limit`**: Test provision quota is full. Delete old test provisions in DevEco Studio (Signing Configs) or AGC console, then retry `devecocli signature generate`.
- **`Invalid AccessToken. Sign in and try again`**: Token expired. Run `devecocli auth login --no-prompt` with login authorization (see Setup).
- **Invalid Skill agent**: Use an ID from the README supported-agent list.
- **`emulator start` / `image download` blocked on agreement**: Follow `emulator license accept` above: use existing agreement acceptance authorization, ask only if missing, and run `devecocli emulator license accept`. Resume the blocked operation only after acceptance succeeds.
- **`image download` failure / timeout**: Do NOT auto-retry. Give the command to the user to run manually in their terminal.
- **`emulator create` timeout**: Treat as user-action step. Ask user to open DevEco Studio -> Device Manager. Check `emulator list` after user confirms. Do NOT auto-retry or edit SDK files.
- **`image list` duplicate OS rows**: `phone`/`foldable`/`widefold`/`triplefold` share the same image. Download/remove ONCE per OS version.
- **`ui layout` missing expected node**: `layout` only returns on-screen nodes. Use `devecocli ui dircfling <direction>` or `devecocli ui swipe <x1> <y1> <x2> <y2>` to scroll the target into view, then retry `ui layout`. Specify `--device <name|serial>` when multiple devices are connected.
- **`未找到 DevEco Testing 安装`**: Install the DevEco Testing client or point `DEVECO_TESTING_HOME` at its install root; `devecocli testing help` confirms the path works.
- **`当前 DevEco Testing 版本不支持 testing`**: The installed client is too old. Run `devecocli testing update`, then retry.
- **`[ERROR] 前置确认未通过`**: `run` hit the confirmation prompt in a non-interactive shell. Add `--yes`.
- **`run` killed mid-test**: The bash timeout was shorter than the test. Re-run with a longer timeout; a killed run produces no report.
- **"Skills marketplace is not available in your region"**: Expected when running `skills list/find/add` outside Chinese mainland (incl. HK/MO). Installed skills still work; `skills remove` and `init` don't touch the network.
- **"CLI online services are not available in your region"**: Commands needing cloud services (login/signature/agreement) abort when GRS is unreachable or the region has no config; local-only commands (`create`/`build`/`device`) are unaffected. Suggest checking `HTTP_PROXY`/`HTTPS_PROXY`. GRS verifies server certificates on every connection, proxied or not — a proxy that re-signs TLS (corporate inspection) fails closed unless its CA is listed in a `NODE_EXTRA_CA_CERTS` PEM file. Use `DEVECO_CLI_DEBUG=1` to inspect country-code detection and GRS resolution. Telemetry is CN-only (silently disabled elsewhere).
