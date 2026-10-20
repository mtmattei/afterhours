"""Package a verified Uno publish and a local shared-world launcher."""
from pathlib import Path
import argparse
import re
import subprocess
import zipfile

root = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser()
parser.add_argument("--publish", type=Path, default=root / "release/uno")
parser.add_argument("--output", type=Path, default=root / "release/afterhours-uno-wasm.zip")
args = parser.parse_args()
publish = args.publish.resolve()
subprocess.run(["node", str(root / "scripts/verify-uno.mjs"), str(publish)], check=True)
webroot = publish / "wwwroot" if (publish / "wwwroot/index.html").is_file() else publish
active = re.search(r"(package_[a-f0-9]+)/uno-bootstrap\.js", (webroot / "index.html").read_text()).group(1)
args.output.parent.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(args.output, "w", zipfile.ZIP_DEFLATED) as archive:
    for file in sorted(webroot.rglob("*")):
        if not file.is_file():
            continue
        relative = file.relative_to(webroot)
        # Repeated publishes may leave older, unused hashed package directories.
        if relative.parts[0].startswith("package_") and relative.parts[0] != active:
            continue
        archive.write(file, "afterhours-uno/wwwroot/" + relative.as_posix())
    for name in ["server.mjs", "session-core.mjs", "dist/game-core.js", "dist/furniture.js"]:
        archive.write(root / name, "afterhours-uno/service/" + name)
    for name in ["README.md", "RELEASE-NOTES.txt", "REMAKE-ROADMAP.txt"]:
        archive.write(root / name, "afterhours-uno/source-" + name)
    archive.writestr("afterhours-uno/Launch-Afterhours.mjs", """import {fileURLToPath} from 'node:url';
process.env.AFTERHOURS_STATIC=fileURLToPath(new URL('./wwwroot/',import.meta.url));
process.env.AFTERHOURS_DATA=fileURLToPath(new URL('./local-data/',import.meta.url));
await import('./service/server.mjs');
""")
    archive.writestr("afterhours-uno/PLAY.txt", """AFTERHOURS — UNO PLATFORM WEBASSEMBLY

1. Extract this archive to a folder.
2. Install Node.js 22 or newer if needed.
3. Open a terminal in the extracted afterhours-uno folder.
4. Run: node Launch-Afterhours.mjs
5. Open http://127.0.0.1:4176 in your browser.

No .NET installation or build step is required to play this compiled release.
The launcher serves the Uno application and its optional local shared world.
Join shared world creates a separate guest character. Open localhost:4176
in another tab for a second guest. The service is accessible on this computer.
Shared saves live in local-data/world.json. Keep backups and keep it private.
Press Ctrl+C in the terminal to stop.

For static hosting, deploy the contents of wwwroot at the site's root.
Static hosting alone supports solo play. A public shared world needs the
separately deployed service and the release work listed in source-README.md.
This is a playable development build, not the completed public game.
""")
with zipfile.ZipFile(args.output) as archive:
    assert archive.testzip() is None
print(f"Packaged {args.output.resolve()} ({args.output.stat().st_size:,} bytes)")
