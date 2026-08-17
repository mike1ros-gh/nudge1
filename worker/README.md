# worker/

The long-running process that actually sends DMs: consumes the BullMQ send queue and runs the comment-polling reconciler. This can't run on Vercel (serverless functions are short-lived) — it needs an always-on process, either a host like Railway/Render/Fly or the desktop app in `mac-app/`. See [../docs/setup.md](../docs/setup.md).
