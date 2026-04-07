#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend', 'src', 'components', 'artisan', 'ArtisanHome.tsx');

// Read the file
let content = fs.readFileSync(filePath, 'utf-8');
// Use regex to handle various types of apostrophes/quotes
// According to grep search:
// 1. Activity Timeline at line 684 - no 3rd param
// 2. No activity trend - no 3rd param
// 3. Distribution by project status - no  3rd param

// Try regex replacement for Activity Timeline
let regex1 = /tr\('Activity Timeline \(6 Months\)',\s*'[^']*d.activit[^']*\(6 mois\)'\)/g;
let replacement1 = "tr('Activity Timeline (6 Months)', 'Chronologie d'activité (6 mois)', 'الخط الزمني للنشاط (6 أشهر)')";
content = content.replace(regex1, replacement1);

// Try regex for No activity trend
let regex2 = /tr\('No activity trend yet\. Start creating projects and quotes to unlock this chart\.',\s*'[^']*tendance d.activit[^']*'\)/g;
let replacement2 = "tr('No activity trend yet. Start creating projects and quotes to unlock this chart.', 'Pas encore de tendance d'activité. Commencez à créer des projets et des devis pour débloquer ce graphique.', 'لا توجد اتجاهات نشاط حتى الآن. ابدأ بإنشاء المشاريع والعروض لفتح هذا الرسم البياني.')";
content = content.replace(regex2, replacement2);

// Try regex for Distribution by project status
let regex3 = /tr\('Distribution by project status and execution progress\.',\s*'[^']*Répartition par statut du projet[^']*'\)/g;
let replacement3 = "tr('Distribution by project status and execution progress.', 'Répartition par statut du projet et progression d'exécution.', 'التوزيع حسب حالة المشروع وتقدم التنفيذ.')";
content = content.replace(regex3, replacement3);

// Write back
fs.writeFileSync(filePath, content, 'utf-8');

console.log('✓ Regex replacements attempted');
