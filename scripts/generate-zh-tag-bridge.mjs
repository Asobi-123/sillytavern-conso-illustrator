import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export const BRIDGE_VERSION = '2026-06-06';

const CATALOG_PATH = 'src/data/tag_catalog.json';
const SOURCE_PATH = 'src/data/zh_visual_concepts.source.json';
const BRIDGE_PATH = 'src/data/zh_tag_bridge.generated.json';
const REPORT_PATH = 'src/data/tag_bridge_report.json';

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function hashObject(value) {
  return crypto.createHash('sha256').update(stableStringify(value)).digest('hex');
}

function uniq(values) {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))];
}

function readableTag(tag) {
  return tag.replace(/_/g, ' ');
}

function tokenTriggers(tokens, source) {
  const tokenMap = source.tokens ?? {};
  const stoplist = new Set(source.tokenStoplist ?? []);
  const triggers = [];
  let covered = 0;

  for (const token of tokens) {
    if (stoplist.has(token)) continue;
    const mapped = tokenMap[token];
    if (!mapped) continue;
    covered++;
    triggers.push(...mapped);
  }

  return {
    triggers: uniq(triggers),
    coverage: tokens.length > 0 ? covered / tokens.length : 0,
  };
}

function mappedTokens(tokens, source) {
  const tokenMap = source.tokens ?? {};
  const stoplist = new Set(source.tokenStoplist ?? []);
  return tokens
    .filter(token => !stoplist.has(token))
    .map(token => ({
      token,
      triggers: tokenMap[token] ?? [],
    }))
    .filter(entry => entry.triggers.length > 0);
}

function combineTokenPhrases(tokens, source) {
  const mapped = mappedTokens(tokens, source);
  const phrases = [];
  if (mapped.length < 2 || mapped.length > 4) return phrases;

  const limited = mapped.map(entry => entry.triggers.slice(0, 3));
  const build = (index, current) => {
    if (index >= limited.length) {
      phrases.push(current.join(''));
      phrases.push(current.join(' '));
      return;
    }
    for (const trigger of limited[index]) {
      build(index + 1, [...current, trigger]);
    }
  };
  build(0, []);
  return phrases;
}

function combineAdjacentTokenPhrases(tokens, source) {
  const tokenMap = source.tokens ?? {};
  const phrases = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    const left = tokenMap[tokens[i]];
    const right = tokenMap[tokens[i + 1]];
    if (!left || !right) continue;
    for (const leftTrigger of left.slice(0, 3)) {
      for (const rightTrigger of right.slice(0, 3)) {
        phrases.push(`${leftTrigger}${rightTrigger}`);
        phrases.push(`${leftTrigger} ${rightTrigger}`);
      }
    }
  }
  return phrases;
}

function categoryRoots(entry, tokens, source) {
  const roots = [];
  const tokenSet = new Set(tokens);
  const add = token => {
    const mapped = source.tokens?.[token];
    if (mapped) roots.push(...mapped);
  };

  if (entry.category === 'hair') {
    add('hair');
    if (tokenSet.has('bangs')) add('bangs');
    if (tokenSet.has('ponytail')) add('ponytail');
    if (tokenSet.has('twintails')) add('twintails');
    if (tokenSet.has('braid')) add('braid');
  }
  if (entry.category === 'eyes') {
    add('eyes');
    if (tokenSet.has('pupils')) add('pupils');
  }
  if (entry.category === 'clothing') {
    add('clothes');
  }
  if (entry.category === 'scene') {
    if (tokenSet.has('background')) add('background');
  }
  if (entry.category === 'camera') {
    if (tokenSet.has('shot')) add('shot');
    if (tokenSet.has('view')) add('view');
    if (tokenSet.has('angle')) add('angle');
  }
  if (entry.category === 'lighting_style') {
    if (tokenSet.has('lighting')) add('lighting');
    if (tokenSet.has('light')) add('light');
  }

  return roots;
}

function bridgeEntry(entry, source) {
  const exact = source.exact?.[entry.tag] ?? [];
  const tokens = entry.tag.split('_').filter(Boolean);
  const tokenResult = tokenTriggers(tokens, source);
  const adjacent = combineAdjacentTokenPhrases(tokens, source);
  const combined = combineTokenPhrases(tokens, source);
  const roots = categoryRoots(entry, tokens, source);
  const tagLabel = entry.label && entry.label !== entry.tag ? entry.label : '';
  const englishAliases = [entry.tag, readableTag(entry.tag), tagLabel];
  const tokenOnlyTriggers =
    tokens.length === 1 && tokenResult.triggers.length > 0
      ? tokenResult.triggers
      : [];
  const rootTriggers = tokens.length === 1 ? roots : [];
  const triggers = uniq([
    ...exact,
    ...combined,
    ...adjacent,
    ...tokenOnlyTriggers,
    ...rootTriggers,
  ]);
  const bridged = triggers.some(trigger => /[\u4e00-\u9fff]/.test(trigger));

  return {
    tag: entry.tag,
    category: entry.category,
    triggers,
    englishAliases: uniq(englishAliases),
    coverage: bridged ? 'bridged' : 'unbridged',
    tokenCoverage: Number(tokenResult.coverage.toFixed(3)),
  };
}

function categoryCounts(entries) {
  const counts = {};
  for (const entry of entries) {
    counts[entry.category] = (counts[entry.category] ?? 0) + 1;
  }
  return counts;
}

function categoryCoverage(entries, bridgedTags) {
  const totals = {};
  const bridged = {};
  for (const entry of entries) {
    totals[entry.category] = (totals[entry.category] ?? 0) + 1;
    if (bridgedTags.has(entry.tag)) {
      bridged[entry.category] = (bridged[entry.category] ?? 0) + 1;
    }
  }
  const result = {};
  for (const category of Object.keys(totals).sort()) {
    result[category] = {
      total: totals[category],
      bridged: bridged[category] ?? 0,
      unbridged: totals[category] - (bridged[category] ?? 0),
      ratio: Number(((bridged[category] ?? 0) / totals[category]).toFixed(4)),
    };
  }
  return result;
}

export async function generateZhTagBridge(root) {
  const catalogPath = path.join(root, CATALOG_PATH);
  const sourcePath = path.join(root, SOURCE_PATH);
  const bridgePath = path.join(root, BRIDGE_PATH);
  const reportPath = path.join(root, REPORT_PATH);
  const catalog = JSON.parse(await fs.readFile(catalogPath, 'utf8'));
  const source = JSON.parse(await fs.readFile(sourcePath, 'utf8'));
  const entries = catalog.entries.filter(
    entry => entry.category !== 'undesired_content'
  );
  const bridgeEntries = entries.map(entry => bridgeEntry(entry, source));
  const bridgedTags = new Set(
    bridgeEntries
      .filter(entry => entry.coverage === 'bridged')
      .map(entry => entry.tag)
  );
  const unbridgedEntries = entries
    .filter(entry => !bridgedTags.has(entry.tag))
    .sort((a, b) => b.postCount - a.postCount);
  const catalogHash = hashObject({
    metadata: catalog.metadata,
    entries: catalog.entries,
  });
  const sourceHash = hashObject(source);

  const bridge = {
    metadata: {
      version: BRIDGE_VERSION,
      generatedAt: new Date().toISOString(),
      catalogVersion: catalog.metadata.version,
      catalogHash,
      sourceHash,
      totalTags: entries.length,
      bridgedTags: bridgedTags.size,
      unbridgedTags: entries.length - bridgedTags.size,
    },
    entries: bridgeEntries,
  };

  const report = {
    metadata: {
      generatedAt: bridge.metadata.generatedAt,
      bridgeVersion: BRIDGE_VERSION,
      catalogVersion: catalog.metadata.version,
      catalogHash,
      sourceHash,
    },
    summary: {
      catalogTags: catalog.entries.length,
      candidateTags: entries.length,
      bridgedTags: bridgedTags.size,
      unbridgedTags: entries.length - bridgedTags.size,
      bridgedRatio: Number((bridgedTags.size / entries.length).toFixed(4)),
      categories: categoryCoverage(entries, bridgedTags),
      catalogCategories: categoryCounts(catalog.entries),
    },
    unbridgedHighFrequency: unbridgedEntries.slice(0, 300).map(entry => ({
      tag: entry.tag,
      label: entry.label,
      category: entry.category,
      postCount: entry.postCount,
    })),
  };

  await fs.mkdir(path.dirname(bridgePath), {recursive: true});
  await fs.writeFile(bridgePath, `${JSON.stringify(bridge, null, 2)}\n`);
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  return {
    bridgePath,
    reportPath,
    total: entries.length,
    bridged: bridgedTags.size,
    unbridged: entries.length - bridgedTags.size,
  };
}

async function main() {
  const root = path.resolve(import.meta.dirname, '..');
  const result = await generateZhTagBridge(root);
  console.log(
    `Wrote zh bridge ${result.bridged}/${result.total} bridged; ${result.unbridged} unbridged`
  );
  console.log(path.relative(root, result.bridgePath));
  console.log(path.relative(root, result.reportPath));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
