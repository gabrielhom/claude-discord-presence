# Changelog

All notable changes to this project. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [SemVer](https://semver.org/).

## [0.5.0] - 2026-08-30

### Added
- Sleeping Clawd: after 5 minutes idle the card swaps from the notification bell to `clawd-sleeping.gif`. The daemon does the swap (hooks can't fire on a timer), so it works with no extra hook events; a `largeImage` config override still wins.

## [0.4.2] - 2026-08-30

### Fixed
- State files are now written atomically (temp file + rename). Parallel hooks could race on the same file and leave it corrupted, which made the daemon exit as if no sessions remained and silently dropped every later update for that session until the next `SessionStart`. (#5)

## [0.4.1] - 2026-08-30

### Fixed
- Token count on the waiting line no longer includes cache tokens, which re-counted the whole context every turn and inflated the number; it now sums only real input + output tokens. (#4)

## [0.4.0] - 2026-08-30

### Added
- Animated status GIFs on the card: typing while prompting, building while running tools, notification while waiting for input. Served from this repo; `largeImage` in the config still overrides them.
- Session stats on the waiting line: model, prompt count and total tokens (e.g. `💤 Opus 4.7 · 12 prompts · 1.2M tok`), parsed from the session transcript locally.

## [0.3.1] - 2026-08-29

### Fixed
- Daemon no longer deletes a session file it fails to parse (a hook may be mid-write); it retries on the next tick. Sessions could previously vanish from the card until the next `SessionStart`. (#2)
- State directory is created `0700` and state/log files `0600`, so other local users can't read repo, branch or prompt data. (#3)

## [0.3.0] - 2026-08-29

### Changed
- **Privacy-safe defaults.** The card no longer shows raw shell commands, search patterns or full URLs. Bash/subagent steps show Claude's short description; WebFetch shows the hostname only; Grep/Glob show just the icon.
- `showPrompt` now defaults to `false` (`💬 Prompting`). Set it to `true` to show the first 110 chars of your prompt.

### Added
- `showProject` option: `false` hides repo name and branch (`📁 a project`).
- README **Privacy** section listing exactly what leaves your machine.
- CI: `npm test` on Linux, macOS and Windows, Node 18 and 22. (#1)

## [0.2.1] - 2026-08-29

### Added
- Ships as a Claude Code plugin (`/plugin marketplace add gabrielhom/claude-discord-presence`).
- Single daemon aggregating all sessions: the card shows the most recently active one plus `· +N sessions`, elapsed since the first started.

### Fixed
- Plugin manifest: `hooks/hooks.json` is auto-loaded.

## [0.1.2] - 2026-08-29

### Changed
- Default to the Discord app icon instead of a hardcoded art asset key.

## [0.1.1] - 2026-08-29

### Added
- Initial release: Discord Rich Presence for Claude Code via hooks, zero dependencies, WSL2-aware (daemon runs on Windows `node.exe`), Linux (incl. Flatpak/Snap), macOS and Windows.
- Default Discord application ("Vibe Coding"); bring your own via `clientId`.

[0.4.0]: https://github.com/gabrielhom/claude-discord-presence/compare/v0.3.1...v0.4.0
[0.3.1]: https://github.com/gabrielhom/claude-discord-presence/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/gabrielhom/claude-discord-presence/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/gabrielhom/claude-discord-presence/compare/v0.1.2...v0.2.1
[0.1.2]: https://github.com/gabrielhom/claude-discord-presence/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/gabrielhom/claude-discord-presence/releases/tag/v0.1.1
