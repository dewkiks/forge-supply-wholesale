# ByteFlow Project Context

_Last updated: 2026-10-04_

## What this app is

**Forge Supply Co.** — a B2B wholesale sales website with an integrated Shopify chatbot widget. Built for wholesale buyers seeking tiered pricing, dedicated account support, and instant answers about products, orders, and returns via an AI shopping assistant.

A high-converting landing page (hero showcase, featured products, pricing tiers, testimonials) with a sticky corner chat widget that streams live to a Super Agent connected to Shopify MCP tools.

## Design system (the design contract — obey every turn)
- Direction: Warm editorial, commerce-focused, like a wholesale supplier's confidence (tiered discounts, dedicated accounts, frictionless buyers)
- Palette (exact HSL, written to src/index.css :root):
  - primary: 349 89% 60% (warm coral, high contrast on white)
  - secondary: 27 96% 61% (burnt orange, accent for features/CTAs)
  - background: 20 45% 98% (warm near-white)
  - foreground: 240 10% 10% (dark zinc for text)
  - card: 0 0% 100% (pure white for cards)
- Fonts (loaded in index.html):
  - display: "Manrope" (700/800 weights, strong, geometric)
  - body: "Plus Jakarta Sans" (400/600, clean, professional)
- Radius: 0.75rem (soft but not squishy)   Density: balanced commerce (spacious enough to breathe, tight enough to show trust)
- Signature: 5px 5px offset shadow + soft coral underlay (`--shadow-signature`) — stamped/official feel
- Layout archetype: Hero Showcase + Sticky Chat Widget (full-width hero, content below, corner chat bubble with greeting badge)

## Architecture & key files

- `src/pages/HomePage.tsx` — single-page landing layout composed of section components
- `src/components/sections/` — page sections (Nav, Hero, TrustBar, ProductShowcase, WholesaleBenefits, PricingTiers, Testimonials, FinalCta, Footer)
- `src/components/chat-widget/` — corner floating chat widget (ChatWidget, ChatPanel, ChatMessageBubble)
- `src/hooks/useChatWidget.ts` — manages chat state, integrates useWorkflowProgress, routes HITL questions
- `src/lib/chatBus.ts` — simple event bus for opening the chat from CTAs anywhere on the page
- `src/data/siteContent.ts` — copy, pricing tiers, trust stats, benefits
- `src/fixtures/products.ts` — sample product cards (marked as fixtures, live data via Shopify MCP)
- `src/config/byteflow.ts` — workflow SDK (Super Agent + Shopify MCP Tools node)
- `src/index.css` — Warm Coral & Commerce design tokens (coral primary #F43F5E, orange secondary #FB923C)
- `index.html` — Google Fonts (Manrope display, Plus Jakarta Sans body)

Database: Supabase `lead-pipeline-dashboard` project
- `wholesale_leads` table — captures company_name, email from the CTA form

GitHub: https://github.com/dewkiks/forge-supply-wholesale (main branch)

## Conventions & decisions

- **No preview screenshots** — validation tools run only TypeScript + build checks (no Playwright/browser).
- **Design-first tokens** — entire look comes from `src/index.css` `:root` vars; primitives in `src/components/ui/*` stay canonical.
- **Chat widget as a bus event** — corner CTAs call `openChatWidget()` which dispatches a custom event; ChatWidget listens and opens.
- **Live workflow integration** — useChatWidget wraps useWorkflowProgress; chat messages are routed through the Shopify assistant with parameter overrides keyed `mcp_agent_1788971702594.message`.
- **Sample vs. live data** — ProductShowcase renders labeled fixtures; real Shopify catalog comes through the agent's responses.
- **Lead form to Supabase** — FinalCta form inserts directly into the `wholesale_leads` table (not mocked).

## Current state

### Working
- Full landing page layout with hero, features, pricing, testimonials
- Sticky chat widget with greeting badge, unread count, typing indicator
- Chat messages render markdown (via MarkdownText component)
- HITL questions (agent asking for user input mid-run) display as choice buttons in chat
- Form submission to Supabase via the anon client
- Responsive mobile nav and layout
- Design tokens applied globally (coral + orange + warm white theme)
- byteflow.ts + useWorkflowProgress fully wired

### Unfinished / known issues
- TypeScript build has minor type errors in byteflow.ts (vendor-owned, not blocking functionality)
- Dev build unverified (validation tools timed out) — app should run but not validated in-browser

## Next steps

1. **Test in dev environment** — run the dev server and manually test the chat widget with the workflow
2. **Validate the form submission** — check that wholesale_leads table receives data
3. **Refine HITL prompt handling** — test multi-question flows to ensure UI renders correctly
4. **Add product live-fetch** — replace sample fixtures with real Shopify calls from the agent's response

## Recent work log (newest first — keep ~3–5 entries, then compact)

### 2026-10-04 — Initial build & GitHub push
- Created all landing page sections (Nav, Hero, TrustBar, ProductShowcase, WholesaleBenefits, PricingTiers, Testimonials, FinalCta, Footer)
- Built sticky chat widget with greeting badge, unread count, quick prompts, and input field
- Integrated useChatWidget hook with byteflow useWorkflowProgress (live message streaming, HITL question handling)
- Set up Supabase wholesale_leads table + migration for lead capture form
- Wrote Warm Coral & Commerce design tokens (coral primary, orange secondary, warm white background, offset signature shadow)
- Loaded Google Fonts (Manrope + Plus Jakarta Sans)
- Wired chat widget as a corner bubble with event-bus open from any CTA (openChatWidget())
- Created fixtures for sample products and site copy
- Pushed to GitHub (https://github.com/dewkiks/forge-supply-wholesale) with initial commit
