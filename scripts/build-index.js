#!/usr/bin/env node
/**
 * Generates index.json + individual {id}.json files from all AGENT.md files.
 *
 * Image handling (when CDN env vars are set):
 *   1. Scans icon/ and images/ folders in each agent
 *   2. Uploads new images to the CDN bucket (public-media on R2)
 *   3. Updates AGENT.md frontmatter with CDN URLs
 *
 * Output:
 *   - index.json        (all agents, for bulk fetch)
 *   - dist/{id}.json    (per-agent, for individual fetch)
 *
 * CI uploads these to the internal-resources R2 bucket in a separate step.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const AGENTS_DIR = path.join(__dirname, '..', 'agents');
const OUTPUT_PATH = path.join(__dirname, '..', 'index.json');
const DIST_DIR = path.join(__dirname, '..', 'dist');
const MARKER_FILE = 'AGENT.md';

// CDN config
const CDN_BUCKET = process.env.CDN_BUCKET || '';
const CDN_BASE_URL = (process.env.CDN_BASE_URL || '').replace(/\/$/, '');
const CDN_ENDPOINT = process.env.CDN_ENDPOINT || '';
const CDN_ACCESS_KEY = process.env.CDN_ACCESS_KEY || '';
const CDN_SECRET_KEY = process.env.CDN_SECRET_KEY || '';
let CDN_ENABLED = !!(CDN_BUCKET && CDN_BASE_URL && CDN_ACCESS_KEY);

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp']);

// ---------------------------------------------------------------------------
// Minimal frontmatter parser
// ---------------------------------------------------------------------------

function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { data: {}, content: raw };

  const yamlBlock = match[1];
  const content = match[2];
  const data = {};

  for (const line of yamlBlock.split('\n')) {
    const kvMatch = line.trimEnd().match(/^(\w[\w-]*):\s*(.+)$/);
    if (kvMatch) {
      data[kvMatch[1]] = parseYamlValue(kvMatch[2].trim());
    }
  }

  return { data, content };
}

function parseYamlValue(val) {
  if (!val) return '';
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    return val.slice(1, -1);
  }
  if (val === 'true') return true;
  if (val === 'false') return false;
  if (val === 'null') return null;
  return val;
}

// ---------------------------------------------------------------------------
// CDN helpers
// ---------------------------------------------------------------------------

const CDN_FLAGS = CDN_ENDPOINT ? `--endpoint-url "${CDN_ENDPOINT}"` : '';

function cdnKeyExists(key) {
  try {
    execSync(
      `AWS_ACCESS_KEY_ID="${CDN_ACCESS_KEY}" AWS_SECRET_ACCESS_KEY="${CDN_SECRET_KEY}" AWS_REGION=auto aws s3api head-object --bucket "${CDN_BUCKET}" --key "${key}" ${CDN_FLAGS} 2>/dev/null`,
      { stdio: 'pipe' },
    );
    return true;
  } catch {
    return false;
  }
}

function uploadToCdn(localPath, key) {
  const ext = path.extname(localPath).toLowerCase();
  const types = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
  const contentType = types[ext] || 'application/octet-stream';
  try {
    execSync(
      `AWS_ACCESS_KEY_ID="${CDN_ACCESS_KEY}" AWS_SECRET_ACCESS_KEY="${CDN_SECRET_KEY}" AWS_REGION=auto aws s3 cp "${localPath}" "s3://${CDN_BUCKET}/${key}" ${CDN_FLAGS} --content-type "${contentType}" --cache-control "public, max-age=31536000, immutable"`,
      { stdio: 'pipe' },
    );
    return true;
  } catch (err) {
    console.warn(`  Failed to upload ${localPath}: ${err.message}`);
    return false;
  }
}

function cdnUrl(key) {
  return `${CDN_BASE_URL}/${key}`;
}

// ---------------------------------------------------------------------------
// Process images
// ---------------------------------------------------------------------------

function processImages(folder) {
  const result = { icon: null, cover: null, screenshots: [] };
  const agentDir = path.join(AGENTS_DIR, folder);

  const iconDir = path.join(agentDir, 'icon');
  if (fs.existsSync(iconDir)) {
    const files = fs.readdirSync(iconDir).filter(f => IMAGE_EXTENSIONS.has(path.extname(f).toLowerCase())).sort();
    if (files.length > 0) {
      const key = `marketplace/agents/${folder}/icon/${files[0]}`;
      if (CDN_ENABLED) {
        if (!cdnKeyExists(key)) {
          console.log(`  Uploading icon: ${files[0]}`);
          uploadToCdn(path.join(iconDir, files[0]), key);
        }
        result.icon = cdnUrl(key);
      }
    }
  }

  const imagesDir = path.join(agentDir, 'images');
  if (fs.existsSync(imagesDir)) {
    const files = fs.readdirSync(imagesDir).filter(f => IMAGE_EXTENSIONS.has(path.extname(f).toLowerCase())).sort();
    for (const file of files) {
      const key = `marketplace/agents/${folder}/images/${file}`;
      const baseName = path.basename(file, path.extname(file)).toLowerCase();
      if (CDN_ENABLED) {
        if (!cdnKeyExists(key)) {
          console.log(`  Uploading image: ${file}`);
          uploadToCdn(path.join(imagesDir, file), key);
        }
        const url = cdnUrl(key);
        if (baseName === 'cover') {
          result.cover = url;
        } else {
          result.screenshots.push(url);
        }
      }
    }
  }

  return result;
}

function updateAgentMdWithUrls(folder, media) {
  if (!media.icon && !media.cover && media.screenshots.length === 0) return;

  const filePath = path.join(AGENTS_DIR, folder, MARKER_FILE);
  const raw = fs.readFileSync(filePath, 'utf-8');
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return;

  let yaml = match[1];
  const body = match[2];

  if (media.icon) {
    yaml = yaml.replace(/^icon:.*$/m, `icon: "${media.icon}"`);
    if (!/^icon:/m.test(yaml)) yaml += `\nicon: "${media.icon}"`;
  }
  if (media.cover) {
    yaml = yaml.replace(/^cover:.*$/m, `cover: "${media.cover}"`);
    if (!/^cover:/m.test(yaml)) yaml += `\ncover: "${media.cover}"`;
  }
  if (media.screenshots.length > 0) {
    yaml = yaml.replace(/^screenshots:.*$(\n\s+-.*$)*/m, '');
    yaml = yaml.trimEnd();
    yaml += '\nscreenshots:';
    for (const url of media.screenshots) {
      yaml += `\n  - "${url}"`;
    }
  }

  const updated = `---\n${yaml}\n---\n${body}`;
  if (updated !== raw) {
    fs.writeFileSync(filePath, updated, 'utf-8');
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function buildIndex() {
  if (!fs.existsSync(AGENTS_DIR)) {
    console.error(`Agents directory not found: ${AGENTS_DIR}`);
    process.exit(1);
  }

  if (CDN_ENABLED) {
    try {
      execSync(
        `AWS_ACCESS_KEY_ID="${CDN_ACCESS_KEY}" AWS_SECRET_ACCESS_KEY="${CDN_SECRET_KEY}" AWS_REGION=auto aws s3api list-objects-v2 --bucket "${CDN_BUCKET}" --max-items 1 ${CDN_FLAGS} 2>/dev/null`,
        { stdio: 'pipe' },
      );
      console.log(`CDN uploads enabled: bucket=${CDN_BUCKET}, cdn=${CDN_BASE_URL}`);
    } catch {
      console.warn('CDN access check failed — disabling image uploads.');
      CDN_ENABLED = false;
    }
  }
  if (!CDN_ENABLED) {
    console.log('CDN uploads disabled. Images will be skipped.');
  }

  const folders = fs.readdirSync(AGENTS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  fs.mkdirSync(DIST_DIR, { recursive: true });

  const items = [];

  for (const folder of folders) {
    const markerPath = path.join(AGENTS_DIR, folder, MARKER_FILE);
    if (!fs.existsSync(markerPath)) continue;

    const media = processImages(folder);
    if (CDN_ENABLED) {
      updateAgentMdWithUrls(folder, media);
    }

    const raw = fs.readFileSync(markerPath, 'utf-8');
    const { data: fm, content: body } = parseFrontmatter(raw);

    const name = fm.name || fm.title;
    if (!name) {
      console.warn(`Skipping ${folder}: missing "name" or "title" in frontmatter`);
      continue;
    }

    const item = {
      id: folder,
      name,
      description: fm.description || '',
      category: fm.category || null,
      author: fm.author || null,
      version: fm.version || null,
      icon: media.icon || fm.icon || null,
      cover: media.cover || fm.cover || null,
      screenshots: media.screenshots.length > 0
        ? media.screenshots
        : (fm.screenshots && fm.screenshots.length > 0 ? fm.screenshots : null),
      prompt: body.trim(),
    };

    items.push(item);

    fs.writeFileSync(
      path.join(DIST_DIR, `${folder}.json`),
      JSON.stringify(item, null, 2),
      'utf-8',
    );
  }

  const index = {
    version: 1,
    generated_at: new Date().toISOString(),
    count: items.length,
    items,
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(index, null, 2), 'utf-8');
  console.log(`Generated index.json: ${items.length} agents, ${items.length} individual JSONs in dist/`);
}

buildIndex();
