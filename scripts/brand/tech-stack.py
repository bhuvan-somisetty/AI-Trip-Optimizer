"""Generates docs/assets/tech-stack.svg, the tech-stack image shown in the README.

Run: python scripts/brand/tech-stack.py
Edit GROUPS below when the stack changes, then re-run and commit the SVG.
Logos come from Simple Icons (CC0, scripts/brand/icons/<slug>.svg); a tool without a logo
there gets a lettered badge. Adapted from OpenSourceX's generator.
"""
import re
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ICONS = Path(__file__).resolve().parent / "icons"
OUT = ROOT / "docs/assets/tech-stack.svg"

# (label, detail, simple-icons slug or None, colour)
GROUPS = [
    ("Frontend", [
        ("Next.js", "16 · App Router", "nextdotjs", "#ffffff"),
        ("React", "19", "react", "#61dafb"),
        ("TypeScript", "5", "typescript", "#3178c6"),
        ("Tailwind CSS", "4", "tailwindcss", "#06b6d4"),
        ("shadcn/ui", "components", "shadcnui", "#ffffff"),
        ("React Query", "server state", "reactquery", "#ff4154"),
    ]),
    ("Backend", [
        ("FastAPI", "Python 3.11", "fastapi", "#009688"),
        ("SQLModel", "+ Alembic", "sqlalchemy", "#d71f00"),
        ("Pydantic", "validation", None, "#e92063"),
        ("JWT", "python-jose", None, "#d63aff"),
        ("Google", "sign-in", "google", "#4285f4"),
        ("Python", "3.11", "python", "#3776ab"),
    ]),
    ("AI pipeline", [
        ("LangGraph", "3-node graph", "langchain", "#1c9a8a"),
        ("Gemini", "3.5 Flash-Lite", "googlegemini", "#8e75b2"),
        ("Guardrail", "numbers check", None, "#c0405f"),
    ]),
    ("Data", [
        ("PostgreSQL", "16", "postgresql", "#6d8fe8"),
        ("Neon", "serverless", "neon", "#00e599"),
        ("Docker", "local dev", "docker", "#2496ed"),
    ]),
    ("Quality", [
        ("pytest", "188 tests", "pytest", "#0a9edc"),
        ("Vitest", "32 tests", "vitest", "#729b1b"),
        ("ESLint", "9", "eslint", "#8080f2"),
    ]),
    ("Platform", [
        ("Vercel", "web + API", "vercel", "#ffffff"),
        ("GitHub Actions", "CI on every PR", "githubactions", "#2088ff"),
    ]),
]
LIVE = ["Travelpayouts flight fares", "Google Hotels via SerpApi", "Gemini (OpenAI-compatible API)",
        "Google Identity Services"]
AUTOMATION = ["Template rationale when the LLM is off", "Nearest fare dates when a day has none",
              "Hotels optional, never fail a run", "Every action in the audit trail"]

W = 1280
PAD = 48
GAP = 22
COLS = 3
CARD_W = (W - 2 * PAD - (COLS - 1) * GAP) / COLS
TILE_W, TILE_H, TILE_GAP = 108, 112, 10
PER_ROW = 3
FONT = "'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif"


def path_of(slug):
    svg = (ICONS / f"{slug}.svg").read_text(encoding="utf-8")
    return re.search(r'<path d="([^"]+)"', svg).group(1)


def tile(x, y, label, detail, slug, colour):
    cx = x + TILE_W / 2
    out = [f'<rect x="{x}" y="{y}" width="{TILE_W}" height="{TILE_H}" rx="16" fill="#1b1419" '
           f'stroke="#ffffff" stroke-opacity="0.07"/>']
    # icon well
    out.append(f'<rect x="{cx - 24}" y="{y + 14}" width="48" height="48" rx="13" fill="{colour}" '
               f'fill-opacity="0.12"/>')
    if slug:
        s = 26 / 24
        out.append(f'<path transform="translate({cx - 13} {y + 25}) scale({s:.4f})" '
                   f'd="{path_of(slug)}" fill="{colour}"/>')
    else:
        letters = "".join(w[0] for w in label.replace(".", " ").split()[:2]).upper()[:2]
        out.append(f'<text x="{cx}" y="{y + 45}" text-anchor="middle" font-family="{FONT}" '
                   f'font-size="19" font-weight="800" fill="{colour}">{escape(letters)}</text>')
    out.append(f'<text x="{cx}" y="{y + 82}" text-anchor="middle" font-family="{FONT}" '
               f'font-size="13.5" font-weight="700" fill="#f4eef0">{escape(label)}</text>')
    out.append(f'<text x="{cx}" y="{y + 99}" text-anchor="middle" font-family="{FONT}" '
               f'font-size="11" fill="#a99ca3">{escape(detail)}</text>')
    return out


def chips(x, y, items, width):
    out, cx, cy = [], x, y
    for it in items:
        w = 16 + len(it) * 7.1
        if cx + w > x + width:
            cx, cy = x, cy + 34
        out.append(f'<rect x="{cx}" y="{cy}" width="{w:.0f}" height="26" rx="13" fill="#1b1419" '
                   f'stroke="#c0405f" stroke-opacity="0.35"/>')
        out.append(f'<text x="{cx + w / 2:.0f}" y="{cy + 17.5}" text-anchor="middle" '
                   f'font-family="{FONT}" font-size="12" fill="#e9dfe3">{escape(it)}</text>')
        cx += w + 8
    return out, cy + 26


def build():
    body = []
    y = 150
    for r in range(0, len(GROUPS), COLS):
        row = GROUPS[r:r + COLS]
        rows = max((len(items) + PER_ROW - 1) // PER_ROW for _, items in row)
        card_h = 58 + rows * TILE_H + (rows - 1) * TILE_GAP + 22
        for c, (title, items) in enumerate(row):
            x = PAD + c * (CARD_W + GAP)
            body.append(f'<rect x="{x:.1f}" y="{y}" width="{CARD_W:.1f}" height="{card_h}" rx="22" '
                        f'fill="#120d11" stroke="#ffffff" stroke-opacity="0.08"/>')
            body.append(f'<rect x="{x + 22:.1f}" y="{y + 26}" width="4" height="16" rx="2" '
                        f'fill="#c0405f"/>')
            body.append(f'<text x="{x + 34:.1f}" y="{y + 39}" font-family="{FONT}" font-size="15" '
                        f'font-weight="800" letter-spacing="0.6" fill="#ffffff">'
                        f'{escape(title.upper())}</text>')
            inner = PER_ROW * TILE_W + (PER_ROW - 1) * TILE_GAP
            x0 = x + (CARD_W - inner) / 2
            for i, (label, detail, slug, colour) in enumerate(items):
                tx = x0 + (i % PER_ROW) * (TILE_W + TILE_GAP)
                ty = y + 58 + (i // PER_ROW) * (TILE_H + TILE_GAP)
                body += tile(round(tx, 1), ty, label, detail, slug, colour)
        y += card_h + GAP

    # strips: live data and automation
    for title, items in (("LIVE DATA", LIVE), ("FAILS SAFELY", AUTOMATION)):
        body.append(f'<text x="{PAD}" y="{y + 18}" font-family="{FONT}" font-size="12.5" '
                    f'font-weight="800" letter-spacing="1.4" fill="#c0405f">{title}</text>')
        part, end = chips(PAD + 190, y, items, W - 2 * PAD - 190)
        body += part
        y = end + 18

    h = y + 34
    head = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{h}" viewBox="0 0 {W} {h}" '
        f'role="img" aria-label="AI Trip Optimizer tech stack">',
        "<title>AI Trip Optimizer tech stack</title>",
        "<defs>",
        '<radialGradient id="g1" cx="12%" cy="0%" r="60%"><stop offset="0" stop-color="#800020" '
        'stop-opacity="0.55"/><stop offset="1" stop-color="#800020" stop-opacity="0"/></radialGradient>',
        '<radialGradient id="g2" cx="95%" cy="100%" r="55%"><stop offset="0" stop-color="#800020" '
        'stop-opacity="0.35"/><stop offset="1" stop-color="#800020" stop-opacity="0"/></radialGradient>',
        "</defs>",
        f'<rect width="{W}" height="{h}" rx="28" fill="#09070a"/>',
        f'<rect width="{W}" height="{h}" rx="28" fill="url(#g1)"/>',
        f'<rect width="{W}" height="{h}" rx="28" fill="url(#g2)"/>',
        f'<text x="{PAD}" y="74" font-family="{FONT}" font-size="34" font-weight="800" '
        f'fill="#ffffff" letter-spacing="-0.5">Built with</text>',
        f'<text x="{PAD + 182}" y="74" font-family="Georgia, serif" font-style="italic" '
        f'font-size="34" fill="#e58aa0">modern, free-tier tools</text>',
        f'<text x="{PAD}" y="108" font-family="{FONT}" font-size="15.5" fill="#b8aab1">'
        "Next.js and FastAPI on Vercel · PostgreSQL on Neon · LangGraph with Gemini behind a "
        "numbers guardrail · real fares · zero running cost</text>",
    ]
    foot = [f'<text x="{W - PAD}" y="{h - 22}" text-anchor="end" font-family="{FONT}" '
            f'font-size="12" fill="#7d7077">ai-trip-optimizer.vercel.app</text>', "</svg>"]
    OUT.write_text("\n".join(head + body + foot) + "\n", encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)} ({W}x{h})")


if __name__ == "__main__":
    build()
