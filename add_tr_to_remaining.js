const fs = require('fs');
const path = require('path');

// Components that need tr() function added
const componentsToFix = [
  'AdminActionLogs.tsx',
  'AdminAddSubAdminPage.tsx',
  'NotificationBell.tsx',
  'ArtisanMessages.tsx',
  'ArtisanNotificationBell.tsx',
  'ArtisanOrders.tsx',
  'RegisterLeftSection.tsx',
  'ExpertKnowledgeLibrary.tsx',
  'ExpertMarketplace.tsx',
  'ExpertMessages.tsx',
  'ExpertPayments.tsx',
  'ManufacturerOrders.tsx',
  'ManufacturerProducts.tsx'
];

function addTrFunctionToComponent(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  // Check if tr function already exists
  if (content.includes('const tr = ') || content.includes('const { tr }')) {
    return false;
  }
  
  // Find the function component declaration and add tr function right after
  const lines = content.split('\n');
  let insertIndex = -1;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('export default function') || line.includes('export function') || 
        line.match(/^export const \w+ = \(/)) {
      // Find the opening brace
      for (let j = i; j < Math.min(i + 5, lines.length); j++) {
        if (lines[j].includes('{')) {
          insertIndex = j + 1;
          break;
        }
      }
      break;
    }
  }
  
  if (insertIndex === -1) {
    return false;
  }
  
  // Check if useLanguage is imported
  if (!content.includes('useLanguage')) {
    // Add the import
    const lastImportIndex = content.lastIndexOf('import ');
    if (lastImportIndex !== -1) {
      const nextNewline = content.indexOf('\n', lastImportIndex);
      if (nextNewline !== -1) {
        content = content.slice(0, nextNewline + 1) + `import { useLanguage } from '../../context/LanguageContext';\n` + content.slice(nextNewline + 1);
        // Rebuild lines after import
        lines.splice(0, lines.length, ...content.split('\n'));
      }
    }
  }
  
  // Insert tr function
  const trFunction = `  const { language } = useLanguage();
  const tr = (en: string, fr: string, ar: string = en) => (language === 'ar' ? ar : language === 'fr' ? fr : en);`;
  
  lines.splice(insertIndex, 0, trFunction);
  
  fs.writeFileSync(filePath, lines.join('\n'));
  return true;
}

function findComponentFile(componentName, baseDir) {
  const searchPath = (dir) => {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        const result = searchPath(filePath);
        if (result) return result;
      } else if (file === componentName) {
        return filePath;
      }
    }
    return null;
  };
  
  return searchPath(baseDir);
}

const rootDir = path.join(__dirname, 'frontend/src/components');
console.log('Adding tr() function to remaining 13 partially localized components...\n');

let fixed = 0;
componentsToFix.forEach(componentName => {
  const filePath = findComponentFile(componentName, rootDir);
  if (filePath) {
    try {
      if (addTrFunctionToComponent(filePath)) {
        console.log(`✓ Added tr() function to: ${componentName}`);
        fixed++;
      } else {
        console.log(`⚠ Skipped (already has tr): ${componentName}`);
      }
    } catch (error) {
      console.log(`✗ Error processing ${componentName}: ${error.message}`);
    }
  } else {
    console.log(`✗ Not found: ${componentName}`);
  }
});

console.log(`\n✓ Fixed ${fixed} components!`);
