#!/usr/bin/env node
/**
 * Generates index.json from all AGENT.md files in the agents/ directory.
 * Parses YAML frontmatter and includes the full markdown body as "prompt".
 *
 * When S3 credentials are available (CI), uploads images from icon/ and images/
 * folders to CDN and includes their URLs in the index.
 *
 * Run locally:  node scripts/build-index.js
 * Run in CI:    node scripts/build-index.js  (with AWS env vars set)
 * Output:       index.json at repo root
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ASSETS_DIR = path.join(__dirname, '..', 'agents');
const OUTPUT_PATH = path.join(__dirname, '..', 'index.json');
const MARKER_FILE = 'AGENT.md';
const ASSET_KIND = 'agents';

// S3/CDN config from environment (set in GitHub Actions)
const S3_BUCKET = process.env.AWS_S3_BUCKET_NAME || '';
const S3_REGION = process.env.AWS_REGION || 'eu-north-1';
const CDN_BASE_URL = (process.env.CDN_BASE_URL || '').replace(/\/$/, '');
const S3_ENABLED = !!(S3_BUCKET && CDN_BASE_URL);

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
// S3 upload helpers
// ---------------------------------------------------------------------------

function s3KeyExists(s3Key) {
  try {
    execSync(
      `aws s3api head-object --bucket "${S3_BUCKET}" --key "${s3Key}" --region "${S3_REGION}" 2>/dev/null`,
      { stdio: 'pipe' },
    );
    return true;
  } catch {
    return false;
  }
}

function uploadToS3(localPath, s3Key) {
  const contentType = getContentType(localPath);
  try {
    execSync(
      `aws s3 cp "${localPath}" "s3://${S3_BUCKET}/${s3Key}" --region "${S3_REGION}" --content-type "${contentType}" --cache-control "public, max-age=31536000, immutable"`,
      { stdio: 'pipe' },
    );
    return true;
  } catch (err) {
    console.error(`  Failed to upload ${localPath}: ${err.message}`);
    return false;
  }
}

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp',
  };
  return types[ext] || 'application/octet-stream';
}

function cdnUrl(s3Key) {
  return `${CDN_BASE_URL}/${s3Key}`;
}

// ---------------------------------------------------------------------------
// Image processing
// ---------------------------------------------------------------------------

function processImages(folder) {
  const result = { icon: null, cover: null, screenshots: [] };
  const assetDir = path.join(ASSETS_DIR, folder);

  // Icon
  const iconDir = path.join(assetDir, 'icon');
  if (fs.existsSync(iconDir)) {
    const iconFiles = fs.readdirSync(iconDir)
      .filter((f) => IMAGE_EXTENSIONS.has(path.extname(f).toLowerCase()))
      .sort();

    if (iconFiles.length > 0) {
      const localPath = path.join(iconDir, iconFiles[0]);
      const s3Key = `marketplace/${ASSET_KIND}/${folder}/icon/${iconFiles[0]}`;

      if (S3_ENABLED) {
        if (!s3KeyExists(s3Key)) {
          console.log(`  Uploading icon: ${iconFiles[0]}`);
          uploadToS3(localPath, s3Key);
        }
        result.icon = cdnUrl(s3Key);
      } else {
        result.icon = `icon/${iconFiles[0]}`;
      }
    }
  }

  // Images (cover + screenshots)
  const imagesDir = path.join(assetDir, 'images');
  if (fs.existsSync(imagesDir)) {
    const imageFiles = fs.readdirSync(imagesDir)
      .filter((f) => IMAGE_EXTENSIONS.has(path.extname(f).toLowerCase()))
      .sort();

    for (const file of imageFiles) {
      const localPath = path.join(imagesDir, file);
      const s3Key = `marketplace/${ASSET_KIND}/${folder}/images/${file}`;
      const baseName = path.basename(file, path.extname(file)).toLowerCase();

      let url;
      if (S3_ENABLED) {
        if (!s3KeyExists(s3Key)) {
          console.log(`  Uploading image: ${file}`);
          uploadToS3(localPath, s3Key);
        }
        url = cdnUrl(s3Key);
      } else {
        url = `images/${file}`;
      }

      if (baseName === 'cover') {
        result.cover = url;
      } else {
        result.screenshots.push(url);
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function buildIndex() {
  if (!fs.existsSync(ASSETS_DIR)) {
    console.error(`Agents directory not found: ${ASSETS_DIR}`);
    process.exit(1);
  }

  if (S3_ENABLED) {
    console.log(`S3 uploads enabled: bucket=${S3_BUCKET}, cdn=${CDN_BASE_URL}`);
  } else {
    console.log('S3 uploads disabled. Using local paths.');
  }

  const folders = fs.readdirSync(ASSETS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  const items = [];

  for (const folder of folders) {
    const markerPath = path.join(ASSETS_DIR, folder, MARKER_FILE);
    if (!fs.existsSync(markerPath)) continue;

    const raw = fs.readFileSync(markerPath, 'utf-8');
    const { data: fm, content: body } = parseFrontmatter(raw);

    const name = fm.name || fm.title;
    if (!name) {
      console.warn(`Skipping ${folder}: missing "name" or "title" in frontmatter`);
      continue;
    }

    const media = processImages(folder);

    items.push({
      id: folder,
      name,
      description: fm.description || '',
      category: fm.category || null,
      author: fm.author || null,
      version: fm.version || null,
      icon: media.icon || fm.icon || null,
      cover: media.cover || fm.cover || null,
      screenshots: media.screenshots.length > 0 ? media.screenshots : fm.screenshots || null,
      prompt: body.trim(),
    });
  }

  const index = {
    version: 1,
    generated_at: new Date().toISOString(),
    count: items.length,
    items,
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(index, null, 2), 'utf-8');
  console.log(`Generated index.json: ${items.length} agents`);
}

buildIndex();
