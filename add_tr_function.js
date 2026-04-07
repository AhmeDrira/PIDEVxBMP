const fs = require('fs');
const path = require('path');

function hasTrFunction(content) {
  return /const tr = \(en:|const\s+\{.*?tr.*?\}/.test(content);
}

function hasUseLanguageImport(content) {
  return /import.*useLanguage.*from.*LanguageContext/.test(content);
}

function addUseLanguageHook(content) {
  // Find the last import statement
  const lastImportMatch = content.lastIndexOf("import ");
  if (lastImportMatch === -1) return content;
  // Find the end of the last import
  const lastImportEnd = content.indexOf('\n', lastImportMatch);
  if (lastImportEnd === -1) return content;
  
  // Check if useLanguage is already imported
  if (hasUseLanguageImport(content)) {
    return content;
  }
  
  // Add the import after the last import statement
  const newImport = `\nimport { useLanguage } from '../../context/LanguageContext';`;
  return content.slice(0, lastImportEnd + 1) + newImport + content.slice(lastImportEnd + 1);
}

function addTrFunction(content) {
  // Find the function component declaration
  const componentMatch = content.match(/export\s+(default\s+)?function\s+(\w+)\s*\({|const\s+(\w+)\s*=\s*\({|const\s+(\w+)\s*:\s*React\.FC.*?\s*=\s*\(/);
  
  if (!componentMatch) return null;
  
  // Find where to insert the tr function (after the function declaration opening)
  const funcStart = componentMatch.index + componentMatch[0].length;
  const nextNewLine = content.indexOf('\n', funcStart);
  
  if (nextNewLine === -1) return null;
  
  const trFunction = `\n  const { language } = useLanguage();
  const tr = (en: string, fr: string, ar: string = en) => (language === 'ar' ? ar : language === 'fr' ? fr : en);`;
  
  return content.slice(0, nextNewLine + 1) + trFunction + content.slice(nextNewLine + 1);
}

function processFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf-8');
    let modified = false;
    
    // Add useLanguage import if missing
    if (!hasUseLanguageImport(content)) {
      content = addUseLanguageHook(content);
      modified = true;
    }
    
    // Add tr function if missing
    if (!hasTrFunction(content)) {
      const updated = addTrFunction(content);
      if (updated) {
        content = updated;
        modified = true;
      }
    }
    
    if (modified) {
      fs.writeFileSync(filePath, content);
      return true;
    }
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
  }
  
  return false;
}

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  let count = 0;
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      count += processDirectory(filePath);
    } else if (file.endsWith('.tsx') && !file.startsWith('index')) {
      // Skip UI component files and small helper components
      if (!file.match(/^(buttons?|inputs?|cards?|labels?|badges?|avatar|checkbox|dropdown|modal|dialog|icon|tooltip|password|form)/i)) {
        if (processFile(filePath)) {
          console.log(`✓ Added hooks to: ${filePath}`);
          count++;
        }
      }
    }
  });
  
  return count;
}

const rootDir = path.join(__dirname, 'frontend/src/components');
console.log('Adding useLanguage hook and tr() function to TSX components...');
const updated = processDirectory(rootDir);
console.log(`✓ Completed! Updated ${updated} files.`);
