const fs = require('fs');
const path = require('path');

function fixTrFunctionDefinitions(content) {
  let modified = false;
  
  // Pattern 1: const tr = (en: string, fr: string) =>
  if (content.includes('const tr = (en: string, fr: string) =>')) {
    content = content.replace(
      /const tr = \(en: string, fr: string\) => \(language === 'fr' \? fr : en\)/g,
      `const tr = (en: string, fr: string, ar: string = en) => (language === 'ar' ? ar : language === 'fr' ? fr : en)`
    );
    modified = true;
  }
  
  // Pattern 2: const tr = (en: string, fr: string) => (
  if (content.includes('const tr = (en: string, fr: string) => (')) {
    content = content.replace(
      /const tr = \(en: string, fr: string\) => \(/g,
      `const tr = (en: string, fr: string, ar: string = en) => (`
    );
    modified = true;
  }
  
  return { content, modified };
}

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  let filesUpdated = 0;
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      filesUpdated += processDirectory(filePath);
    } else if (file.endsWith('.tsx')) {
      try {
        let content = fs.readFileSync(filePath, 'utf-8');
        const { content: updated, modified } = fixTrFunctionDefinitions(content);
        
        if (modified) {
          fs.writeFileSync(filePath, updated);
          console.log(`✓ Updated tr() definition: ${filePath}`);
          filesUpdated++;
        }
      } catch (error) {
        // Silently skip errors
      }
    }
  });
  
  return filesUpdated;
}

const rootDir = path.join(__dirname, 'frontend/src/components');
console.log('Updating all tr() function definitions to include Arabic parameter...\n');
const updated = processDirectory(rootDir);
console.log(`\n✓ Updated ${updated} files with tr() function definitions.`);
