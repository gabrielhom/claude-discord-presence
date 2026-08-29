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
- **Live status** from Claude Code hooks: your prompt (`💬`), file being edited (`✏️`), command running (`⚙️`), search (`🔍`), subagents (`🤖`), idle (`💤`).
- Zero config: ships with a default Discord application ("Vibe Coding" — Discord rejects "Claude" in app names, so bring your own app if you want a different title).

## Install

```bash
npm install -g claude-discord-presence
claude-discord-presence setup
```

Open a new `claude` session — it's on your profile. Requires Node ≥ 18 and the Discord **desktop** app (on WSL: Node installed on the Windows side too, e.g. `winget install OpenJS.NodeJS`).

```bash
claude-discord-presence status     # active sessions
claude-discord-presence uninstall  # removes hooks, stops daemons
```

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

`setup` adds hooks (`SessionStart`, `UserPromptSubmit`, `PreToolUse`, `Stop`, `SessionEnd`) to `~/.claude/settings.json`. Each hook writes a small JSON state file in the temp dir; `SessionStart` spawns one detached daemon per session that watches the file and pushes `SET_ACTIVITY` to Discord; `SessionEnd` kills it. On WSL the state file is reached via `\\wsl.localhost\...` by the Windows-side daemon. Daemons also exit on their own if the state file goes stale (8h) — e.g. Claude was killed hard.

## License

MIT
