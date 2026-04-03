#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend', 'src', 'components', 'artisan', 'ArtisanHome.tsx');

// Read the file
let content = fs.readFileSync(filePath, 'utf-8');

// More replacements with special character handling
const replacements = [
    // Activity Timeline
    {
        old: `tr('Activity Timeline (6 Months)', 'Chronologie d'activité (6 mois)')`,
        new: `tr('Activity Timeline (6 Months)', 'Chronologie d'activité (6 mois)', 'الخط الزمني للنشاط (6 أشهر)')`
    },
    // No activity trend
    {
        old: `tr('No activity trend yet. Start creating projects and quotes to unlock this chart.', 'Pas encore de tendance d'activité. Commencez à créer des projets et des devis pour débloquer ce graphique.')`,
        new: `tr('No activity trend yet. Start creating projects and quotes to unlock this chart.', 'Pas encore de tendance d'activité. Commencez à créer des projets et des devis pour débloquer ce graphique.', 'لا توجد اتجاهات نشاط حتى الآن. ابدأ بإنشاء المشاريع والعروض لفتح هذا الرسم البياني.')`
    },
    // Distribution by project status
    {
        old: `tr('Distribution by project status and execution progress.', 'Répartition par statut du projet et progression d'exécution.')`,
        new: `tr('Distribution by project status and execution progress.', 'Répartition par statut du projet et progression d'exécution.', 'التوزيع حسب حالة المشروع وتقدم التنفيذ.')`
    },
];

let updatedCount = 0;
replacements.forEach(({ old, new: newValue }) => {
    if (content.includes(old)) {
        content = content.replace(old, newValue);
        updatedCount++;
        console.log(`✓ Updated: ${old.substring(0, 60)}...`);
    } else {
        console.log(`✗ Not found (exact match): ${old.substring(0, 60)}...`);
    }
});

// Write the file back
fs.writeFileSync(filePath, content, 'utf-8');
console.log(`\n✓ Total replacements: ${updatedCount}`);
