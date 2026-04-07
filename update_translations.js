#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend', 'src', 'components', 'artisan', 'ArtisanHome.tsx');

// Read the file
let content = fs.readFileSync(filePath, 'utf-8');
// List of translations to add (from 2 params to 3 params with ar)
const replacements = [
    // 1. Activity Timeline
    {
        old: "tr('Activity Timeline (6 Months)', 'Chronologie d'activité (6 mois)')",
        new: "tr('Activity Timeline (6 Months)', 'Chronologie d'activité (6 mois)', 'الخط الزمني للنشاط (6 أشهر)')"
    },
    // 2. Projects, quotes, and invoices...
    {
        old: "tr('Projects, quotes, and invoices created over time.', 'Projets, devis et factures créés au fil du temps.')",
        new: "tr('Projects, quotes, and invoices created over time.', 'Projets, devis et factures créés au fil du temps.', 'المشاريع والعروض والفواتير التي تم إنشاؤها بمرور الوقت.')"
    },
    // 3. No activity trend yet...
    {
        old: "tr('No activity trend yet. Start creating projects and quotes to unlock this chart.', 'Pas encore de tendance d'activité. Commencez à créer des projets et des devis pour débloquer ce graphique.')",
        new: "tr('No activity trend yet. Start creating projects and quotes to unlock this chart.', 'Pas encore de tendance d'activité. Commencez à créer des projets et des devis pour débloquer ce graphique.', 'لا توجد اتجاهات نشاط حتى الآن. ابدأ بإنشاء المشاريع والعروض لفتح هذا الرسم البياني.')"
    },
    // 4. Project Pipeline
    {
        old: "tr('Project Pipeline', 'Pipeline des projets')",
        new: "tr('Project Pipeline', 'Pipeline des projets', 'خط أنابيب المشروع')"
    },
    // 5. Distribution by project status...
    {
        old: "tr('Distribution by project status and execution progress.', 'Répartition par statut du projet et progression d'exécution.')",
        new: "tr('Distribution by project status and execution progress.', 'Répartition par statut du projet et progression d'exécution.', 'التوزيع حسب حالة المشروع وتقدم التنفيذ.')"
    },
    // 6. No material usage data yet...
    {
        old: "tr('No material usage data yet. Add materials to projects to unlock insights.', 'Aucune donnée d'usage des matériaux pour le moment. Ajoutez des matériaux aux projets pour débloquer des analyses.')",
        new: "tr('No material usage data yet. Add materials to projects to unlock insights.', 'Aucune donnée d'usage des matériaux pour le moment. Ajoutez des matériaux aux projets pour débloquer des analyses.', 'لا توجد بيانات استخدام مواد حتى الآن. أضف مواد إلى المشاريع لفتح التحليلات.')"
    },
];

// Perform replacements
let updatedCount = 0;
replacements.forEach(({ old, new: newValue }) => {
    if (content.includes(old)) {
        content = content.replace(old, newValue);
        updatedCount++;
        console.log(`✓ Updated: ${old.substring(0, 50)}...`);
    } else {
        console.log(`✗ Not found: ${old.substring(0, 50)}...`);
    }
});

// Write the file back
fs.writeFileSync(filePath, content, 'utf-8');

console.log(`\n✓ File updated successfully! ${updatedCount} translations added.`);
