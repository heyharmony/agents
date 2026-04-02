#!/usr/bin/env node
/**
 * Enriches AGENT.md frontmatter with category, author, version, cover, screenshots, icon.
 */

const fs = require('fs');
const path = require('path');

const AGENTS_DIR = path.join(__dirname, '..', 'agents');

const CATEGORY_MAP = {
  'content-writer': 'Communication',
  'creative-brainstormer': 'Strategy',
  'data-analyst': 'Strategy',
  'strategic-advisor': 'Strategy',
};

function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return null;
  return { yaml: match[1], body: match[2] };
}

function hasField(yaml, field) {
  return new RegExp(`^${field}:`, 'm').test(yaml);
}

function addField(yaml, field, value) {
  if (hasField(yaml, field)) return yaml;
  if (typeof value === 'string') return `${yaml}\n${field}: "${value}"`;
  return `${yaml}\n${field}: ${JSON.stringify(value)}`;
}

function enrichAgent(folder) {
  const filePath = path.join(AGENTS_DIR, folder, 'AGENT.md');
  if (!fs.existsSync(filePath)) return false;

  const raw = fs.readFileSync(filePath, 'utf-8');
  const parsed = parseFrontmatter(raw);
  if (!parsed) return false;

  let { yaml } = parsed;
  const { body } = parsed;

  const category = CATEGORY_MAP[folder] || 'General';
  if (!hasField(yaml, 'category')) yaml = addField(yaml, 'category', category);
  if (!hasField(yaml, 'author')) yaml = addField(yaml, 'author', 'Harmony');
  if (!hasField(yaml, 'version')) yaml = addField(yaml, 'version', '1.0.0');
  if (!hasField(yaml, 'icon')) yaml = addField(yaml, 'icon', 'sparkles');
  if (!hasField(yaml, 'cover')) yaml = addField(yaml, 'cover', '');
  if (!hasField(yaml, 'screenshots')) yaml = `${yaml}\nscreenshots: []`;

  const updated = `---\n${yaml}\n---\n${body}`;
  if (updated !== raw) {
    fs.writeFileSync(filePath, updated, 'utf-8');
    return true;
  }
  return false;
}

const folders = fs.readdirSync(AGENTS_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

let updated = 0;
for (const folder of folders) {
  if (enrichAgent(folder)) updated++;
}

console.log(`Done: ${updated} agents updated`);
