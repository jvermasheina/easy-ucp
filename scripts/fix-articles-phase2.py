#!/usr/bin/env python3
"""
Phase 2: Fix remaining false claims after Phase 1 global replacements.
Targets:
1. Remaining Easy UCP Hub in thank-you.html, component-showcase.html, /marketing/
2. Easy UCP-specific ACP capability claims (not educational ACP content)
3. Specific article fixes for deeply embedded false claims
"""

import os
import re
import glob

PUBLIC_DIR = "/Users/juuso/easyucp/easy-ucp/server/public"
stats = {"changes": 0}

def fix_file(filepath, replacements):
    """Apply targeted replacements to a specific file."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    original = content
    for old, new in replacements:
        content = content.replace(old, new)
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        stats["changes"] += 1
        print(f"  FIXED: {os.path.relpath(filepath, PUBLIC_DIR)}")

# ============================================================
# 1. Fix remaining Easy UCP Hub references
# ============================================================
for f in ["thank-you.html", "component-showcase.html"]:
    path = os.path.join(PUBLIC_DIR, f)
    if os.path.exists(path):
        fix_file(path, [("Easy UCP Hub", "Easy UCP")])

# Fix /marketing/ subdirectory
for f in glob.glob(os.path.join(PUBLIC_DIR, "marketing", "*.html")):
    fix_file(f, [
        ("Easy UCP Hub", "Easy UCP"),
        ("www.ucp-commerce.com", "easyucp.com"),
        ("ucp-commerce.com/", "easyucp.com/"),
    ])

# ============================================================
# 2. Fix Easy UCP-specific ACP claims (not educational content)
# These are cases where Easy UCP is claimed to support ACP
# ============================================================

# woocommerce-chatgpt-integration-ucp-guide.html - heavy ACP claims about Easy UCP
f = os.path.join(PUBLIC_DIR, "woocommerce-chatgpt-integration-ucp-guide.html")
if os.path.exists(f):
    fix_file(f, [
        # Solution pitch section - false Easy UCP ACP claims
        (
            "and ACP protocol translation so you can focus on selling",
            "so you can focus on selling"
        ),
        (
            '<strong>Dual Protocol Coverage</strong>: We connect you to both <a href="https://developers.google.com/merchant/ucp" class="text-primary hover:text-primary-dark underline" target="_blank" rel="noopener">UCP (Google Gemini)</a> and <a href="https://easyucp.com/" class="text-primary hover:text-primary-dark underline" target="_blank" rel="noopener">ACP (OpenAI ChatGPT)</a> protocols simultaneously. Your products become discoverable across all major AI shopping platforms with a single integration.',
            '<strong>AI Shopping Discovery</strong>: We make your products discoverable through <a href="https://developers.google.com/merchant/ucp" class="text-primary hover:text-primary-dark underline" target="_blank" rel="noopener">UCP-compliant endpoints</a> that AI shopping agents like ChatGPT, Claude, and Gemini can access. Your products become visible across all major AI platforms with a single integration.'
        ),
        (
            '<h3 class="text-lg font-semibold text-gray-900 mb-2">Dual Protocol: UCP + ACP Coverage</h3>',
            '<h3 class="text-lg font-semibold text-gray-900 mb-2">AI Shopping Discovery</h3>'
        ),
        (
            '<p class="text-gray-600">Connect to both Google Gemini (UCP) and ChatGPT (ACP) with one integration. Maximum AI platform reach.</p>',
            '<p class="text-gray-600">Make your products discoverable by AI shopping agents like ChatGPT, Claude, and Gemini through UCP-compliant endpoints.</p>'
        ),
    ])

# connect-store-to-chatgpt.html
f = os.path.join(PUBLIC_DIR, "connect-store-to-chatgpt.html")
if os.path.exists(f):
    fix_file(f, [
        (
            '<span class="text-gray-700">ACP protocol enables ChatGPT integration while UCP handles Google Gemini</span>',
            '<span class="text-gray-700">UCP protocol enables product discovery by AI agents including ChatGPT, Claude, and Gemini</span>'
        ),
        (
            '<h3 class="text-lg font-semibold text-gray-900 mb-2">Multi-Protocol Coverage</h3>',
            '<h3 class="text-lg font-semibold text-gray-900 mb-2">AI Agent Discovery</h3>'
        ),
        (
            '<p class="text-gray-600">Connect to both ChatGPT (ACP) and Google Gemini (UCP) simultaneously. Write once, sell everywhere across all major AI shopping platforms.</p>',
            '<p class="text-gray-600">Make your products discoverable by ChatGPT, Claude, and Gemini through UCP-compliant endpoints. Upload once, be visible everywhere.</p>'
        ),
    ])

# enable-conversational-commerce.html
f = os.path.join(PUBLIC_DIR, "enable-conversational-commerce.html")
if os.path.exists(f):
    with open(f, 'r', encoding='utf-8') as fh:
        content = fh.read()
    # Fix ACP claims in solution pitch
    content = content.replace(
        "can connect your store to the UCP protocol simultaneously",
        "makes your products discoverable through UCP-compliant endpoints"
    )
    # Remove any remaining dual protocol capability claims about Easy UCP
    content = re.sub(
        r'connect(?:s|ing)?\s+(?:your\s+store\s+)?to\s+(?:both\s+)?(?:the\s+)?UCP\s+(?:protocol\s+)?(?:and\s+)?ACP',
        'make your products discoverable through UCP',
        content,
        flags=re.IGNORECASE
    )
    with open(f, 'w', encoding='utf-8') as fh:
        fh.write(content)
    stats["changes"] += 1
    print(f"  FIXED: enable-conversational-commerce.html")

# Fix remaining articles with ACP in solution/pitch sections
for filename in [
    "integrate-ucp-with-woocommerce.html",
    "shopify-agentic-commerce-ucp-guide.html",
    "agentic-commerce-explained.html",
    "ucp-for-magento.html",
    "magento-universal-commerce-protocol.html",
    "shopify-universal-commerce-protocol.html",
    "set-up-universal-commerce-protocol.html",
]:
    f = os.path.join(PUBLIC_DIR, filename)
    if os.path.exists(f):
        with open(f, 'r', encoding='utf-8') as fh:
            content = fh.read()
        original = content

        # Fix any "Easy UCP" + ACP combination claims
        content = re.sub(
            r'Easy UCP(?:\s+is\s+|\s+)(?:the\s+)?(?:universal\s+)?(?:protocol\s+)?bridge[^.]*ACP[^.]*\.',
            'Easy UCP makes your products discoverable by AI shopping agents through UCP-compliant endpoints.',
            content
        )

        # Fix "Dual Protocol" feature cards
        content = content.replace(
            "Dual Protocol Coverage",
            "AI Shopping Discovery"
        )
        content = content.replace(
            "Dual Protocol",
            "AI Discovery"
        )

        # Fix connect to ACP claims in Easy UCP context
        content = re.sub(
            r'(?:Connect|connect)(?:s|ing)?\s+to\s+(?:both\s+)?(?:Google\s+Gemini\s*\(UCP\)\s*and\s*ChatGPT\s*\(ACP\)|ChatGPT\s*\(ACP\)\s*and\s*Google\s*Gemini\s*\(UCP\))',
            'Make your products discoverable by AI agents like ChatGPT, Claude, and Gemini',
            content
        )

        if content != original:
            with open(f, 'w', encoding='utf-8') as fh:
                fh.write(content)
            stats["changes"] += 1
            print(f"  FIXED: {filename}")

# ============================================================
# 3. Fix "connect-store-to-ai-agents.html" ACP references
# ============================================================
f = os.path.join(PUBLIC_DIR, "connect-store-to-ai-agents.html")
if os.path.exists(f):
    with open(f, 'r', encoding='utf-8') as fh:
        content = fh.read()
    original = content

    # These are educational ACP references in the body,
    # but check for Easy UCP capability claims
    content = re.sub(
        r'Easy UCP[^.]*ACP[^.]*\.',
        'Easy UCP makes your products discoverable by AI agents through UCP-compliant endpoints.',
        content
    )

    if content != original:
        with open(f, 'w', encoding='utf-8') as fh:
            fh.write(content)
        stats["changes"] += 1
        print(f"  FIXED: connect-store-to-ai-agents.html")

print(f"\nPhase 2 complete: {stats['changes']} files fixed")
