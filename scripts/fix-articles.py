#!/usr/bin/env python3
"""
Fix false claims in Easy UCP resource articles.

Targets:
1. Branding: "Easy UCP Hub" → "Easy UCP"
2. False URL: "www.ucp-commerce.com" → "easyucp.com"
3. ACP/multi-protocol claims (Easy UCP only supports UCP)
4. Checkout/payment claims for Easy UCP (we only do discovery + redirect)
5. Fix CTA links to point to main site signup
6. Fix solution pitch sections with false capability claims
"""

import os
import re
import glob

PUBLIC_DIR = "/Users/juuso/easyucp/easy-ucp/server/public"

# Files to skip (not SEO articles)
SKIP_FILES = {
    "landing.html", "dashboard.html", "resources.html",
    "thank-you.html", "privacy.html", "terms.html",
    "component-showcase.html"
}

# Track changes
stats = {
    "files_processed": 0,
    "files_changed": 0,
    "replacements": {}
}

def count_replacement(name):
    stats["replacements"][name] = stats["replacements"].get(name, 0) + 1


# ============================================================
# REPLACEMENT RULES
# ============================================================

# Phase 1: Safe global string replacements
GLOBAL_REPLACEMENTS = [
    # Branding
    ("Easy UCP Hub", "Easy UCP", "branding"),

    # False URL references
    ("www.ucp-commerce.com", "easyucp.com", "url_fix"),
    ("ucp-commerce.com/", "easyucp.com/", "url_fix"),

    # ACP multi-protocol claims (Easy UCP only supports UCP)
    (
        "Connect to both UCP (Google Gemini) and ACP (ChatGPT) protocols simultaneously, maximizing your AI shopping visibility across all major platforms from day one.",
        "Make your products discoverable by AI shopping agents like ChatGPT, Claude, and Gemini through UCP-compliant product endpoints. Maximize your AI shopping visibility from day one.",
        "acp_claim"
    ),
    (
        "connect your store to both UCP (Google Gemini) and ACP (OpenAI ChatGPT) protocols simultaneously",
        "make your store discoverable by AI shopping agents like ChatGPT, Claude, and Gemini through UCP-compliant endpoints",
        "acp_claim"
    ),
    (
        "both UCP (Google Gemini) and ACP (ChatGPT) protocols",
        "the UCP protocol for AI shopping agents including ChatGPT, Claude, and Gemini",
        "acp_claim"
    ),
    (
        "both UCP (Google Gemini) and ACP (OpenAI ChatGPT)",
        "the UCP protocol for AI shopping agents",
        "acp_claim"
    ),
    (
        "both UCP and ACP protocols simultaneously",
        "the UCP protocol for AI agents",
        "acp_claim"
    ),
    (
        "both UCP and ACP protocols",
        "the UCP protocol",
        "acp_claim"
    ),
    (
        "UCP and ACP protocols",
        "the UCP protocol",
        "acp_claim"
    ),
    (
        "Instant Multi-Protocol Support",
        "AI Product Discovery",
        "acp_claim"
    ),
    (
        "Multi-Protocol Support",
        "UCP Product Discovery",
        "acp_claim"
    ),
    (
        "multi-protocol support",
        "UCP product discovery",
        "acp_claim"
    ),
    (
        "multi-protocol",
        "UCP-based",
        "acp_claim"
    ),

    # Fix universal translation claims
    (
        "universal translation between your existing store and both UCP and ACP protocols",
        "UCP-compliant product discovery endpoints for your store",
        "capability_fix"
    ),
    (
        "universal translation between your existing store and the UCP protocol",
        "UCP-compliant product discovery endpoints for your store",
        "capability_fix"
    ),
    (
        "<strong>universal translation</strong> between your existing store and the UCP protocol",
        "<strong>UCP-compliant product discovery</strong> for your store",
        "capability_fix"
    ),
    (
        "provides <strong>universal translation</strong>",
        "provides <strong>UCP-compliant product discovery</strong>",
        "capability_fix"
    ),

    # Fix "instant UCP compliance" → more honest
    (
        "provides <strong>instant UCP compliance</strong>",
        "creates <strong>UCP-compliant product endpoints</strong>",
        "capability_fix"
    ),

    # Fix CTA links - article pages don't have #signup, link to main site
    ('href="#signup"', 'href="/#signup"', "cta_link"),
    ('href="#cta"', 'href="/#signup"', "cta_link"),

    # Fix FAQ text about implementation
    (
        "This includes our team setting up your UCP endpoint, configuring your product catalog, testing the integration, and going live.",
        "Upload your product catalog (CSV or JSON), and we generate UCP-compliant endpoints. AI agents can then discover and recommend your products.",
        "faq_fix"
    ),

    # Fix FAQ about platform support
    (
        "we can integrate UCP for your store regardless of your platform choice",
        "you can upload your product catalog and get UCP-compliant endpoints regardless of your platform",
        "faq_fix"
    ),

    # Fix FAQ about lifetime access
    (
        "our multi-platform approach means you&#039;re never locked in&#x2014;migrate platforms without losing UCP integration",
        "our platform-agnostic approach means you&#039;re never locked in&#x2014;your product catalog works regardless of which e-commerce platform you use",
        "faq_fix"
    ),
    (
        "our multi-platform approach means you're never locked in—migrate platforms without losing UCP integration",
        "our platform-agnostic approach means you're never locked in—your product catalog works regardless of which e-commerce platform you use",
        "faq_fix"
    ),

    # Fix "captured months or years of AI commerce sales" - we only do discovery
    (
        "you&#039;ve already captured months or years of AI commerce sales",
        "you&#039;ve already been visible to AI shopping agents for months or years",
        "capability_fix"
    ),
    (
        "you've already captured months or years of AI commerce sales",
        "you've already been visible to AI shopping agents for months or years",
        "capability_fix"
    ),

    # Fix checkout-related claims specific to Easy UCP
    (
        "Easy UCP handles all technical complexity—RESTful APIs, checkout sessions, product data exposure, and real-time synchronization",
        "Easy UCP handles the technical complexity of UCP compliance—product catalog endpoints, AI agent discovery, and structured product data",
        "capability_fix"
    ),
    (
        "Easy UCP handles all technical complexity&#x2014;RESTful APIs, checkout sessions, product data exposure, and real-time synchronization",
        "Easy UCP handles the technical complexity of UCP compliance&#x2014;product catalog endpoints, AI agent discovery, and structured product data",
        "capability_fix"
    ),
]

# Phase 2: Regex-based replacements (for patterns with variation)
REGEX_REPLACEMENTS = [
    # Fix ACP references in various contexts
    (
        r'(?:and|&amp;)\s+ACP\s*\((?:OpenAI\s+)?ChatGPT\)',
        'for AI agents like ChatGPT, Claude, and Gemini',
        "acp_regex"
    ),

    # Fix "our solution provides..." claims about translation
    (
        r'our solution provides\s+<strong>universal translation</strong>',
        'our solution provides <strong>UCP-compliant product discovery</strong>',
        "capability_regex"
    ),

    # Fix JSON-LD author name
    (
        r'"name":\s*"Easy UCP Hub"',
        '"name": "Easy UCP"',
        "jsonld_fix"
    ),

    # Fix any remaining "UCP and ACP" without "both"
    (
        r'UCP\s+and\s+ACP',
        'UCP',
        "acp_regex"
    ),
]


def process_file(filepath):
    """Apply all replacements to a single file."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content

    # Phase 1: String replacements
    for old, new, category in GLOBAL_REPLACEMENTS:
        if old in content:
            count = content.count(old)
            content = content.replace(old, new)
            for _ in range(count):
                count_replacement(category)

    # Phase 2: Regex replacements
    for pattern, replacement, category in REGEX_REPLACEMENTS:
        matches = re.findall(pattern, content)
        if matches:
            content = re.sub(pattern, replacement, content)
            for _ in matches:
                count_replacement(category)

    # Check if anything changed
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False


def main():
    html_files = glob.glob(os.path.join(PUBLIC_DIR, "*.html"))

    for filepath in sorted(html_files):
        filename = os.path.basename(filepath)
        if filename in SKIP_FILES:
            continue

        stats["files_processed"] += 1

        if process_file(filepath):
            stats["files_changed"] += 1
            print(f"  FIXED: {filename}")

    # Summary
    print(f"\n{'='*50}")
    print(f"SUMMARY")
    print(f"{'='*50}")
    print(f"Files processed: {stats['files_processed']}")
    print(f"Files changed:   {stats['files_changed']}")
    print(f"\nReplacements by category:")
    for cat, count in sorted(stats["replacements"].items()):
        print(f"  {cat}: {count}")

    total = sum(stats["replacements"].values())
    print(f"\nTotal replacements: {total}")


if __name__ == "__main__":
    main()
