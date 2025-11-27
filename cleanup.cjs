#!/usr/bin/env node
/**
 * Auto Illustrator - Image File Cleanup Script
 * 
 * Usage:
 *   node cleanup.js [options]
 * 
 * Options:
 *   --days=N        Retention period in days (default: 1)
 *   --dry-run       Show what would be deleted without actually deleting
 *   --path=/path    Custom path to SillyTavern images folder
 *   --help          Show this help message
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  days: 1,
  dryRun: false,
  customPath: null,
  help: false,
};

for (const arg of args) {
  if (arg.startsWith('--days=')) {
    options.days = parseInt(arg.split('=')[1], 10);
  } else if (arg === '--dry-run') {
    options.dryRun = true;
  } else if (arg.startsWith('--path=')) {
    options.customPath = arg.split('=')[1];
  } else if (arg === '--help' || arg === '-h') {
    options.help = true;
  }
}

if (options.help) {
  console.log(`
Auto Illustrator - Image File Cleanup Script

Usage:
  node cleanup.js [options]

Options:
  --days=N        Retention period in days (default: 1)
  --dry-run       Show what would be deleted without actually deleting
  --path=/path    Custom path to SillyTavern images folder
  --help          Show this help message

Example:
  node cleanup.js --days=1 --dry-run
  node cleanup.js --days=3
  node cleanup.js --path=/root/SillyTavern/data/default-user/user/images
`);
  process.exit(0);
}

function getImagesPath() {
  if (options.customPath) {
    return options.customPath;
  }
  
  const possiblePaths = [
    '/root/SillyTavern/data/default-user/user/images',
    path.join(os.homedir(), 'SillyTavern/data/default-user/user/images'),
    path.join(os.homedir(), 'Documents/SillyTavern/data/default-user/user/images'),
    path.join(__dirname, '../../../../data/default-user/user/images'),
  ];
  
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  
  return null;
}

function extractTimestampFromFilename(filename) {
  const match = filename.match(/(\d{4})-(\d{2})-(\d{2})@(\d{2})h(\d{2})m(\d{2})s/);
  
  if (!match) {
    return null;
  }
  
  const [, year, month, day, hour, minute, second] = match;
  
  return new Date(
    parseInt(year),
    parseInt(month) - 1,
    parseInt(day),
    parseInt(hour),
    parseInt(minute),
    parseInt(second)
  );
}

function findImageFiles(dir, files = []) {
  if (!fs.existsSync(dir)) {
    return files;
  }
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      findImageFiles(fullPath, files);
    } else if (entry.isFile() && /\.(png|jpg|jpeg|webp|gif)$/i.test(entry.name)) {
      files.push(fullPath);
    }
  }
  
  return files;
}

function cleanupEmptyDirs(dir) {
  if (!fs.existsSync(dir)) {
    return;
  }
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const fullPath = path.join(dir, entry.name);
      cleanupEmptyDirs(fullPath);
      
      const remaining = fs.readdirSync(fullPath);
      if (remaining.length === 0) {
        fs.rmdirSync(fullPath);
        console.log(`Removed empty directory: ${entry.name}`);
      }
    }
  }
}

function formatSize(bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

async function cleanup() {
  console.log('=== Auto Illustrator Image Cleanup ===');
  console.log(`Retention period: ${options.days} day(s)`);
  console.log(`Dry run: ${options.dryRun}`);
  console.log('');
  
  const imagesPath = getImagesPath();
  
  if (!imagesPath) {
    console.error('ERROR: Could not find SillyTavern images folder.');
    console.error('Please specify the path manually using --path=/path/to/images');
    process.exit(1);
  }
  
  console.log(`Images folder: ${imagesPath}`);
  console.log('');
  
  const files = findImageFiles(imagesPath);
  console.log(`Found ${files.length} image file(s)`);
  
  const now = new Date();
  const cutoffDate = new Date(now.getTime() - (options.days * 24 * 60 * 60 * 1000));
  console.log(`Cutoff date: ${cutoffDate.toISOString()}`);
  console.log('');
  
  const expiredFiles = [];
  const skippedFiles = [];
  
  for (const file of files) {
    const filename = path.basename(file);
    const timestamp = extractTimestampFromFilename(filename);
    
    if (!timestamp) {
      skippedFiles.push({ file, reason: 'no timestamp in filename' });
      continue;
    }
    
    if (timestamp < cutoffDate) {
      expiredFiles.push({ file, timestamp });
    }
  }
  
  console.log(`Expired files: ${expiredFiles.length}`);
  console.log(`Skipped files (no timestamp): ${skippedFiles.length}`);
  console.log('');
  
  if (expiredFiles.length === 0) {
    console.log('No files to delete.');
    return;
  }
  
  let deletedCount = 0;
  let deletedSize = 0;
  const errors = [];
  
  for (const { file, timestamp } of expiredFiles) {
    const stats = fs.statSync(file);
    const relativePath = path.relative(imagesPath, file);
    
    if (options.dryRun) {
      console.log(`[DRY RUN] Would delete: ${relativePath} (${formatSize(stats.size)})`);
    } else {
      try {
        fs.unlinkSync(file);
        deletedCount++;
        deletedSize += stats.size;
        console.log(`Deleted: ${relativePath}`);
      } catch (error) {
        errors.push({ file: relativePath, error: error.message });
        console.error(`ERROR deleting ${relativePath}: ${error.message}`);
      }
    }
  }
  
  if (!options.dryRun) {
    cleanupEmptyDirs(imagesPath);
  }
  
  console.log('');
  console.log('=== Summary ===');
  if (options.dryRun) {
    console.log(`Would delete: ${expiredFiles.length} file(s)`);
  } else {
    console.log(`Deleted: ${deletedCount} file(s)`);
    console.log(`Freed space: ${formatSize(deletedSize)}`);
    if (errors.length > 0) {
      console.log(`Errors: ${errors.length}`);
    }
  }
}

cleanup().catch(error => {
  console.error('Cleanup failed:', error);
  process.exit(1);
});