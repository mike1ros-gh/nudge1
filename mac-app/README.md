# mac-app/

A native macOS menu bar app that runs the worker locally on your own Mac — a free alternative to hosting it on Railway/Render/Fly. It launches `npm run worker` as a child process, keeps the Mac awake while it runs (with a choice of sleep modes), and can optionally start at login. Build it with `./build.sh`; see [../docs/setup.md](../docs/setup.md) for the full walkthrough.
