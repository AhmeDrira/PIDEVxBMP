const fs = require('fs');
const path = require('path');

function checkFileLocalization(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Check for useLanguage import
    const hasUseLanguage = /import.*useLanguage.*from.*LanguageContext/.test(content);
    
    // Check for tr() function
    const hasTr = /const tr = \(en: string, fr: string, ar: string = en\)/.test(content);
    
    // Count tr() calls with 3 parameters
    const trCalls = (content.match(/tr\('[^']*',\s*'[^']*',\s*'[^']*'\)/g) || []).length;
    
    // Count tr() calls with 2 parameters (not fully localized)
    const twoParamCalls = (content.match(/tr\('[^']*',\s*'[^']*'\)(?!\s*,\s*')/g) || []).length;
    
    return {
      path: filePath,
      hasUseLanguage,
      hasTr,
      trCalls,
      twoParamCalls,
      isFullyLocalized: hasUseLanguage && hasTr && twoParamCalls === 0
    };
  } catch (error) {
    return { path: filePath, error: error.message };
  }
}

function analyzeDirectory(dir, results = [], prefix = '') {
  if (prefix.length > 0 && !prefix.includes('artisan') && !prefix.includes('expert') && !prefix.includes('manufacturer') 
      && !prefix.includes('auth') && !prefix.includes('dashboards') && !prefix.includes('admin') 
      && !prefix.includes('knowledge') && !prefix.includes('marketplace')) {
    return results;
  }
  
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    const newPrefix = prefix ? `${prefix}/${file}` : file;
    
    if (stat.isDirectory()) {
      analyzeDirectory(filePath, results, newPrefix);
    } else if (file.endsWith('.tsx') && !file.match(/^(index|\.)/)) {
      results.push(checkFileLocalization(filePath));
    }
  });
  
  return results;
}

function categorizeResults(results) {
  const categories = {
    fullyLocalized: [],
    partiallyLocalized: [],
    notLocalized: [],
    errors: []
  };
  
  results.forEach(result => {
    if (result.error) {
      categories.errors.push(result);
    } else if (result.isFullyLocalized) {
      categories.fullyLocalized.push(result);
    } else if (result.hasUseLanguage || result.hasTr) {
      categories.partiallyLocalized.push(result);
    } else {
      categories.notLocalized.push(result);
    }
  });
  
  return categories;
}

const rootDir = path.join(__dirname, 'frontend/src/components');
console.log('Analyzing localization status of all page components...\n');

const results = analyzeDirectory(rootDir);
const categories = categorizeResults(results);

console.log(`${'='.repeat(80)}`);
console.log('FRONTEND LOCALIZATION ANALYSIS REPORT');
console.log(`${'='.repeat(80)}\n`);

console.log(`📊 SUMMARY:`);
console.log(`  Total components analyzed: ${results.length}`);
console.log(`  ✅ Fully localized (EN/FR/AR): ${categories.fullyLocalized.length}`);
console.log(`  🟡 Partially localized: ${categories.partiallyLocalized.length}`);
console.log(`  ❌ Not localized: ${categories.notLocalized.length}`);
console.log(`  ⚠️  Errors: ${categories.errors.length}`);
console.log(`\n`);

console.log(`${'='.repeat(80)}`);
console.log('✅ FULLY LOCALIZED COMPONENTS');
console.log(`${'='.repeat(80)}`);
categories.fullyLocalized.forEach(comp => {
  console.log(`  ✓ ${path.basename(comp.path)} (${comp.trCalls} tr() calls)`);
});
console.log('');

if (categories.partiallyLocalized.length > 0) {
  console.log(`${'='.repeat(80)}`);
  console.log('🟡 PARTIALLY LOCALIZED COMPONENTS');
  console.log(`${'='.repeat(80)}`);
  categories.partiallyLocalized.forEach(comp => {
    const status = !comp.hasTr ? '(missing tr function)' : comp.twoParamCalls > 0 ? `(${comp.twoParamCalls} 2-param calls)` : '(mixed)';
    console.log(`  🟡 ${path.basename(comp.path)} ${status} - ${comp.trCalls} 3-param calls`);
  });
  console.log('');
}

if (categories.notLocalized.length > 0) {
  console.log(`${'='.repeat(80)}`);
  console.log('❌ NOT LOCALIZED COMPONENTS');
  console.log(`${'='.repeat(80)}`);
  categories.notLocalized.forEach(comp => {
    console.log(`  ✗ ${path.basename(comp.path)}`);
  });
  console.log('');
}

console.log(`${'='.repeat(80)}`);
console.log(`OVERALL LOCALIZATION COVERAGE: ${Math.round((categories.fullyLocalized.length / results.length) * 100)}%`);
console.log(`${'='.repeat(80)}\n`);
