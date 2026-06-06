import fs from 'node:fs/promises';
import path from 'node:path';
import {generateZhTagBridge} from './generate-zh-tag-bridge.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const JSON_OUT = path.join(ROOT, 'src/data/tag_catalog.json');

const SOURCE_URL =
  'https://danbooru.donmai.us/tags.json?search%5Bcategory%5D=0&search%5Border%5D=count';
const LIMIT = 100;
const PAGES = Number.parseInt(process.env.TAG_CATALOG_PAGES || '80', 10);
const MIN_POST_COUNT = Number.parseInt(
  process.env.TAG_CATALOG_MIN_POST_COUNT || '1000',
  10
);

const CATEGORY_RULES = [
  {
    id: 'subject',
    patterns: [
      /^(?:\d|multiple|solo|duo|trio|group|crowd)/,
      /(?:girl|boy|woman|man|person|people|human|child|adult|female|male)$/,
    ],
  },
  {id: 'hair', patterns: [/hair/, /bangs/, /ponytail/, /braid/, /twintails/]},
  {id: 'eyes', patterns: [/eyes?$/, /pupils?$/, /heterochromia/]},
  {
    id: 'expression',
    patterns: [
      /smile/,
      /blush/,
      /cry/,
      /angry/,
      /sad/,
      /laugh/,
      /mouth/,
      /tears?/,
      /expression/,
    ],
  },
  {
    id: 'pose_action',
    patterns: [
      /sitting/,
      /standing/,
      /lying/,
      /running/,
      /walking/,
      /holding/,
      /looking/,
      /reaching/,
      /hug/,
      /kiss/,
      /pose/,
      /hand/,
      /arm/,
      /leg/,
    ],
  },
  {
    id: 'clothing',
    patterns: [
      /shirt/,
      /skirt/,
      /dress/,
      /uniform/,
      /jacket/,
      /sleeves?/,
      /pants/,
      /shorts/,
      /shoes?/,
      /socks?/,
      /gloves?/,
      /hat$/,
      /ribbon/,
      /tie$/,
      /collar/,
      /coat/,
      /hoodie/,
      /swimsuit/,
      /armor/,
      /kimono/,
    ],
  },
  {
    id: 'scene',
    patterns: [
      /background/,
      /indoors?/,
      /outdoors?/,
      /room/,
      /bed/,
      /chair/,
      /school/,
      /street/,
      /city/,
      /forest/,
      /sky/,
      /cloud/,
      /water/,
      /flower/,
      /tree/,
      /window/,
      /door/,
      /beach/,
      /garden/,
      /night/,
      /sunset/,
    ],
  },
  {
    id: 'camera',
    patterns: [
      /close.?up/,
      /cowboy_shot/,
      /wide_shot/,
      /medium_shot/,
      /full_body/,
      /upper_body/,
      /lower_body/,
      /portrait/,
      /from_(?:above|below|side|behind)/,
      /view$/,
      /angle/,
      /focus/,
      /depth_of_field/,
      /perspective/,
      /composition/,
    ],
  },
  {
    id: 'lighting_style',
    patterns: [
      /light/,
      /shadow/,
      /glow/,
      /bokeh/,
      /monochrome/,
      /color/,
      /gradient/,
      /silhouette/,
      /aesthetic/,
      /quality/,
      /highres/,
      /masterpiece/,
    ],
  },
  {
    id: 'undesired_content',
    patterns: [
      /bad_/,
      /lowres/,
      /worst_quality/,
      /low_quality/,
      /jpeg_artifacts/,
      /watermark/,
      /signature/,
      /text$/,
      /error/,
      /blurry/,
    ],
  },
];

const BLOCKLIST_PATTERNS = [
  /^(?:commentary|translation_request|translated|check_translation)$/,
  /^artist_/,
  /^copyright_/,
  /_(?:name|username)$/,
];

function classify(name) {
  for (const rule of CATEGORY_RULES) {
    if (rule.patterns.some(pattern => pattern.test(name))) {
      return rule.id;
    }
  }
  return 'general';
}

function displayName(name) {
  return name.replace(/_/g, ' ');
}

function shouldKeep(tag) {
  if (!tag || tag.is_deprecated) return false;
  if (tag.category !== 0) return false;
  if (tag.post_count < MIN_POST_COUNT) return false;
  if (BLOCKLIST_PATTERNS.some(pattern => pattern.test(tag.name))) return false;
  return true;
}

async function fetchPage(page) {
  const url = `${SOURCE_URL}&limit=${LIMIT}&page=${page}`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'sillytavern-conso-illustrator tag catalog updater',
    },
  });
  if (!response.ok) {
    throw new Error(`Danbooru tag fetch failed: ${response.status}`);
  }
  return response.json();
}

async function main() {
  const allTags = [];
  for (let page = 1; page <= PAGES; page++) {
    const tags = await fetchPage(page);
    if (!Array.isArray(tags) || tags.length === 0) break;
    allTags.push(...tags);
  }

  const entries = allTags
    .filter(shouldKeep)
    .map(tag => ({
      tag: tag.name,
      label: displayName(tag.name),
      category: classify(tag.name),
      postCount: tag.post_count,
    }));

  const catalog = {
    metadata: {
      version: new Date().toISOString().slice(0, 7),
      source: 'danbooru-tags-general',
      generatedAt: new Date().toISOString(),
      sourceUrl: SOURCE_URL,
      sourceCategory: 'general',
      sourcePages: PAGES,
      minPostCount: MIN_POST_COUNT,
      totalFetched: allTags.length,
      includedTags: entries.length,
    },
    categories: [
      'subject',
      'hair',
      'eyes',
      'expression',
      'pose_action',
      'clothing',
      'scene',
      'camera',
      'lighting_style',
      'undesired_content',
      'general',
    ],
    entries,
  };

  await fs.mkdir(path.dirname(JSON_OUT), {recursive: true});
  await fs.writeFile(JSON_OUT, `${JSON.stringify(catalog, null, 2)}\n`);
  console.log(
    `Wrote ${entries.length} tags to ${path.relative(ROOT, JSON_OUT)}`
  );

  const bridgeResult = await generateZhTagBridge(ROOT);
  console.log(
    `Wrote zh bridge ${bridgeResult.bridged}/${bridgeResult.total} bridged; ${bridgeResult.unbridged} unbridged`
  );
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
