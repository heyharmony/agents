# Harmony Agents

Repository of AI agents for the Harmony marketplace. Each agent is a specialized AI assistant with defined inputs, outputs, and behavior.

## Structure

```
agents/
├── {agent-name}/
│   ├── AGENT.md              # Agent definition (frontmatter + description)
│   ├── README.md             # Brief overview
│   ├── icon/                 # Optional: agent icon
│   │   └── icon.png
│   └── images/               # Optional: cover image + screenshots
│       ├── cover.png
│       ├── screenshot-1.png
│       └── screenshot-2.png
├── scripts/
│   ├── build-index.js        # Generates index.json from all agents
│   └── enrich-frontmatter.js # One-time script to add missing frontmatter fields
├── index.json                # Auto-generated index of all agents (do not edit manually)
└── .github/workflows/
    └── build-index.yml       # CI: regenerates index.json on push to main
```

## AGENT.md Format

Each agent has an `AGENT.md` file with YAML frontmatter and a markdown body:

```yaml
---
name: Content Writer
description: Produces publication-ready written content from a topic or brief.
category: "Communication"
author: "Harmony"
version: "1.0.0"
icon: "sparkles"
cover: ""
screenshots: []
---

# Content Writer

## Description
...

## Triggers
- Manual invocation

## Inputs
| Name | Type | Required | Description |
|------|------|----------|-------------|
| brief | string | Yes | Topic or content brief |
| tone | string | No | Desired tone |

## Outputs
Formatted content with headline, body, and CTA.
```

### Frontmatter Fields

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Human-readable agent name |
| `description` | Yes | One-line description |
| `category` | Yes | Category for marketplace grouping |
| `author` | Yes | Author name (default: "Harmony") |
| `version` | Yes | Semantic version (default: "1.0.0") |
| `icon` | No | Icon name or URL (populated by CI from `icon/` folder) |
| `cover` | No | Cover image URL (populated by CI from `images/cover.png`) |
| `screenshots` | No | Screenshot URLs (populated by CI from `images/screenshot-*.png`) |

## How It Works

Same pipeline as the [skills repo](https://github.com/heyharmony/skills):

1. **Push to `main`** triggers GitHub Actions
2. `scripts/build-index.js` scans all `agents/*/AGENT.md` files
3. Parses frontmatter, extracts prompt body, processes images
4. Generates `index.json` and commits it
5. Harmony backend fetches `index.json` via GitHub API → caches in Redis → serves via `/api/marketplace/agents`

### Image Handling

Same conventions as skills:

- `icon/` → First image file becomes the agent icon
- `images/cover.png` → Cover image
- `images/screenshot-*.png` → Screenshots (sorted alphabetically)

## Adding a New Agent

1. Create a new folder under `agents/` with a kebab-case name
2. Add `AGENT.md` with frontmatter and body (Description, Triggers, Inputs, Outputs)
3. Add `README.md` with a brief overview
4. Optionally add images in `icon/` and `images/`
5. Open a PR to `main`
6. After merge, CI regenerates `index.json`

## GitHub Secrets (for CI)

| Secret | Description |
|--------|-------------|
| `AWS_ACCESS_KEY_ID` | R2/S3 access key for image uploads |
| `AWS_SECRET_ACCESS_KEY` | R2/S3 secret key |
| `AWS_REGION` | Bucket region (e.g., `auto` for R2) |
| `AWS_S3_BUCKET_NAME` | Bucket name (e.g., `public-media`) |
| `CDN_BASE_URL` | Public CDN URL (e.g., `https://public-media.heyharmony.com`) |
