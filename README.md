# claude-discord-presence

Discord Rich Presence for the [Claude Code](https://claude.com/claude-code) CLI. Shows what you're working on, live.

```
Playing Vibe Coding
📁 my-project (main)
✏️ server.ts
01:23:45 elapsed
```

- **Zero dependencies** — talks Discord IPC directly.
- **Works on WSL2** — Discord runs on Windows behind a named pipe that Linux processes can't see; this detects WSL and runs the tiny daemon with Windows `node.exe` instead. Also works natively on Linux (incl. Flatpak/Snap Discord), macOS and Windows.
- **Multi-session aware** — one daemon for all your Claude sessions; the card shows the one you touched last plus `· +N sessions`, elapsed time since the first one started.
- **Live status** from Claude Code hooks: your prompt (`💬`), file being edited (`✏️`), command running (`⚙️`), search (`🔍`), subagents (`🤖`), idle (`💤`).
- Zero config: ships with a default Discord application ("Vibe Coding" — Discord rejects "Claude" in app names, so bring your own app if you want a different title).

## Install

**As a Claude Code plugin** (recommended — no settings.json edits, auto-updates):

```
/plugin marketplace add gabrielhom/claude-discord-presence
/plugin install claude-discord-presence@claude-discord-presence
```

**Or via npm:**

```bash
npm install -g claude-discord-presence
claude-discord-presence setup       # writes hooks to ~/.claude/settings.json
claude-discord-presence status      # daemon + active sessions
claude-discord-presence uninstall   # removes hooks, stops daemon
```

Pick one, not both. Open a new `claude` session — it's on your profile. Requires Node ≥ 18 and the Discord **desktop** app (on WSL: Node installed on the Windows side too, e.g. `winget install OpenJS.NodeJS`).

## Config (optional)

`~/.claude/claude-discord-presence.json`:

```json
{
  "clientId": "your-discord-application-id",
  "showPrompt": false,
  "largeImage": "my-art-asset-key"
}
```

- `clientId` — use your own app from the [Developer Portal](https://discord.com/developers/applications) to control the name/icon. Env `CLAUDE_PRESENCE_CLIENT_ID` also works.
- `showPrompt` — set `false` to show `💬 Prompting` instead of your prompt text (default `true`).
- `largeImage` — key of an image uploaded under your app's *Rich Presence → Art Assets*. Default: none (Discord shows the app icon).

## How it works

Hooks (`SessionStart`, `UserPromptSubmit`, `PreToolUse`, `Stop`, `SessionEnd`) each write a small JSON state file per session in the temp dir. `SessionStart` spawns a single detached daemon (if none is running) that watches the directory, composes one activity from all sessions and pushes `SET_ACTIVITY` to Discord. `SessionEnd` deletes the session's file; the daemon exits once none remain. On WSL the directory is reached via `\\wsl.localhost\...` by the Windows-side daemon. Stale files (8h without update — e.g. Claude was killed hard) are dropped automatically.

## License

MIT
