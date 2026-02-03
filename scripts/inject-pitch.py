#!/usr/bin/env python3
"""
Inject canonical solution pitch block into all article HTML files.

Reads the pitch from: /Users/juuso/marketing-engine/marketing-engine/blocks/pitch/solution-pitch.json
Replaces existing pitch sections in:
  - Type A (Tailwind): 46 files with `bg-gradient-to-br from-gray-50 to-gray-100 border-t-2 border-primary`
  - Type B (Basic): ~63 files — injects pitch BEFORE their FAQ section (they only had FAQ before)

Usage:
  python3 scripts/inject-pitch.py          # Run replacements
  python3 scripts/inject-pitch.py --dry    # Dry run (show what would change)

To update the pitch for all articles:
  1. Edit /Users/juuso/marketing-engine/marketing-engine/blocks/pitch/solution-pitch.json
  2. Run: python3 scripts/inject-pitch.py
"""

import json
import os
import re
import sys
import glob

BLOCK_PATH = "/Users/juuso/marketing-engine/marketing-engine/blocks/pitch/solution-pitch.json"
PUBLIC_DIR = "/Users/juuso/easyucp/easy-ucp/server/public"

SKIP_FILES = {
    "landing.html", "dashboard.html", "resources.html",
    "thank-you.html", "privacy.html", "terms.html",
    "component-showcase.html"
}

DRY_RUN = "--dry" in sys.argv


def load_pitch_block():
    with open(BLOCK_PATH, 'r') as f:
        return json.load(f)


def render_pitch_html(block):
    """Render the pitch block JSON to Tailwind HTML."""
    c = block["content"]

    # Build feature cards (2-column grid)
    feature_cards = ""
    for feat in c["features"]:
        feature_cards += f"""
        <div class="bg-white rounded-xl p-6 shadow-sm">
          <h3 class="text-lg font-semibold text-gray-900 mb-2">{feat['title']}</h3>
          <p class="text-gray-600">{feat['description']}</p>
        </div>"""

    # Build description paragraphs
    desc_html = "\n\n".join(c["description_paragraphs"])

    html = f"""  <div class="py-20 bg-gradient-to-br from-gray-50 to-gray-100 border-t-2 border-primary" data-block="solution-pitch" data-block-version="{block['version']}">
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      <h2 class="text-3xl sm:text-4xl font-bold text-gray-900 mb-6 text-center">
        {c['heading']}
      </h2>

      <div class="text-lg text-gray-700 mb-8 text-center max-w-3xl mx-auto">
        {c['intro']}
      </div>

      <div class="prose prose-lg max-w-none text-gray-700 mb-12">
        {desc_html}
      </div>

      <div class="grid md:grid-cols-2 gap-6 mb-12">{feature_cards}
      </div>

      <div class="text-center">
        <a href="{c['cta_url']}" class="inline-flex items-center bg-primary hover:bg-primary-dark text-white px-8 py-3.5 rounded-lg font-semibold text-lg transition shadow-lg shadow-primary/25">
          {c['cta_text']}
          <svg class="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path>
          </svg>
        </a>
      </div>
    </div>
  </div>"""

    return html


def replace_type_a(content, pitch_html):
    """Replace existing Tailwind pitch section in Type A articles."""
    # Pattern: from the opening div with the gradient class to its closing div
    # The section starts with <div class="py-20 bg-gradient-to-br from-gray-50 to-gray-100 border-t-2 border-primary">
    # and ends at the matching closing </div> (the outermost one of this section)
    pattern = re.compile(
        r'<div\s+class="py-20\s+bg-gradient-to-br\s+from-gray-50\s+to-gray-100\s+border-t-2\s+border-primary"'
        r'[^>]*>.*?</div>\s*</div>\s*</div>',
        re.DOTALL
    )

    match = pattern.search(content)
    if match:
        # We need to find the correct closing tag. The section has 3 levels of nesting:
        # <div class="py-20 ...">    (outer)
        #   <div class="max-w-4xl ...">  (container)
        #     <h2>...</h2>
        #     <div>...</div>        (intro)
        #     <div class="prose ...">...</div>  (content)
        #     <div class="grid ...">...</div>   (features)
        #     <div class="text-center">...</div> (cta)
        #   </div>
        # </div>
        #
        # Find the start position and then count div nesting to find the end
        start = content.find('<div class="py-20 bg-gradient-to-br from-gray-50 to-gray-100 border-t-2 border-primary"')
        if start == -1:
            return content, False

        # Count nesting levels to find the closing </div> of the outer wrapper
        depth = 0
        i = start
        end = -1
        while i < len(content):
            if content[i:i+4] == '<div':
                depth += 1
            elif content[i:i+6] == '</div>':
                depth -= 1
                if depth == 0:
                    end = i + 6
                    break
            i += 1

        if end == -1:
            return content, False

        # Replace the section
        content = content[:start] + pitch_html + content[end:]
        return content, True

    return content, False


def inject_type_b(content, pitch_html):
    """Inject pitch section before FAQ in Type B (basic) articles."""
    # Type B articles have: <section class="section"> <div class="container"> <div class="faq">
    # We inject the pitch BEFORE this FAQ section

    # Check if this file already has the pitch block (idempotent)
    if 'data-block="solution-pitch"' in content:
        return content, False

    # Find the FAQ section
    faq_pattern = re.compile(
        r'(<section\s+class="section">\s*<div\s+class="container">\s*<div\s+class="faq">)',
        re.DOTALL
    )

    match = faq_pattern.search(content)
    if match:
        # Insert pitch HTML before the FAQ section
        insert_pos = match.start()
        # Add Tailwind CDN if not present (Type B uses inline CSS, need Tailwind for pitch)
        needs_tailwind = 'cdn.tailwindcss.com' not in content
        tailwind_inject = ""
        if needs_tailwind:
            tailwind_inject = '\n  <script src="https://cdn.tailwindcss.com"></script>\n  <script>tailwind.config={theme:{extend:{colors:{primary:"#14B8A6","primary-dark":"#0D9488"}}}}</script>'
            # Insert before </head>
            content = content.replace('</head>', tailwind_inject + '\n</head>')

        content = content[:insert_pos] + "\n" + pitch_html + "\n\n    " + content[insert_pos:]
        return content, True

    return content, False


def main():
    block = load_pitch_block()
    pitch_html = render_pitch_html(block)

    stats = {"type_a": 0, "type_b": 0, "skipped": 0, "unchanged": 0}

    html_files = sorted(glob.glob(os.path.join(PUBLIC_DIR, "*.html")))
    # Also include /marketing/ subdirectory
    html_files += sorted(glob.glob(os.path.join(PUBLIC_DIR, "marketing", "*.html")))

    for filepath in html_files:
        filename = os.path.basename(filepath)
        if filename in SKIP_FILES:
            stats["skipped"] += 1
            continue

        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        # Already has the standardized pitch block? Skip (idempotent)
        if 'data-block="solution-pitch"' in content:
            stats["unchanged"] += 1
            continue

        original = content

        # Try Type A first (Tailwind pitch section)
        if 'bg-gradient-to-br from-gray-50 to-gray-100 border-t-2 border-primary' in content:
            content, changed = replace_type_a(content, pitch_html)
            if changed:
                stats["type_a"] += 1
                if DRY_RUN:
                    print(f"  [DRY] Would replace Type A pitch: {os.path.relpath(filepath, PUBLIC_DIR)}")
                else:
                    with open(filepath, 'w', encoding='utf-8') as f:
                        f.write(content)
                    print(f"  Type A: {os.path.relpath(filepath, PUBLIC_DIR)}")
                continue

        # Try Type B (basic template - inject before FAQ)
        if '<div class="faq">' in content:
            content, changed = inject_type_b(content, pitch_html)
            if changed:
                stats["type_b"] += 1
                if DRY_RUN:
                    print(f"  [DRY] Would inject Type B pitch: {os.path.relpath(filepath, PUBLIC_DIR)}")
                else:
                    with open(filepath, 'w', encoding='utf-8') as f:
                        f.write(content)
                    print(f"  Type B: {os.path.relpath(filepath, PUBLIC_DIR)}")
                continue

        stats["unchanged"] += 1

    print(f"\n{'='*50}")
    print(f"PITCH INJECTION {'(DRY RUN) ' if DRY_RUN else ''}SUMMARY")
    print(f"{'='*50}")
    print(f"Type A replaced:  {stats['type_a']}")
    print(f"Type B injected:  {stats['type_b']}")
    print(f"Skipped (non-article): {stats['skipped']}")
    print(f"Unchanged:        {stats['unchanged']}")
    print(f"Total processed:  {sum(stats.values())}")
    print(f"\nPitch block version: {block['version']}")
    print(f"To update: edit {BLOCK_PATH}")
    print(f"Then run: python3 scripts/inject-pitch.py")


if __name__ == "__main__":
    main()
