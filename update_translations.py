#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import re

file_path = r"frontend\src\components\artisan\ArtisanHome.tsx"

# Read the file
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# List of translations to add (from 2 params to 3 params with ar)
replacements = [
    # 1. Activity Timeline
    ("tr('Activity Timeline (6 Months)', 'Chronologie d'activité (6 mois)')", 
     "tr('Activity Timeline (6 Months)', 'Chronologie d'activité (6 mois)', 'الخط الزمني للنشاط (6 أشهر)')"),
    
    # 2. Projects, quotes, and invoices...
    ("tr('Projects, quotes, and invoices created over time.', 'Projets, devis et factures créés au fil du temps.')",
     "tr('Projects, quotes, and invoices created over time.', 'Projets, devis et factures créés au fil du temps.', 'المشاريع والعروض والفواتير التي تم إنشاؤها بمرور الوقت.')"),
    
    # 3. No activity trend yet...
    ("tr('No activity trend yet. Start creating projects and quotes to unlock this chart.', 'Pas encore de tendance d'activité. Commencez à créer des projets et des devis pour débloquer ce graphique.')",
     "tr('No activity trend yet. Start creating projects and quotes to unlock this chart.', 'Pas encore de tendance d'activité. Commencez à créer des projets et des devis pour débloquer ce graphique.', 'لا توجد اتجاهات نشاط حتى الآن. ابدأ بإنشاء المشاريع والعروض لفتح هذا الرسم البياني.')"),
    
    # 4. Project Pipeline
    ("tr('Project Pipeline', 'Pipeline des projets')",
     "tr('Project Pipeline', 'Pipeline des projets', 'خط أنابيب المشروع')"),
    
    # 5. Distribution by project status...
    ("tr('Distribution by project status and execution progress.', 'Répartition par statut du projet et progression d'exécution.')",
     "tr('Distribution by project status and execution progress.', 'Répartition par statut du projet et progression d'exécution.', 'التوزيع حسب حالة المشروع وتقدم التنفيذ.')"),
    
    # 6. No material usage data yet...
    ("tr('No material usage data yet. Add materials to projects to unlock insights.', 'Aucune donnée d'usage des matériaux pour le moment. Ajoutez des matériaux aux projets pour débloquer des analyses.')",
     "tr('No material usage data yet. Add materials to projects to unlock insights.', 'Aucune donnée d'usage des matériaux pour le moment. Ajoutez des matériaux aux projets pour débloquer des analyses.', 'لا توجد بيانات استخدام مواد حتى الآن. أضف مواد إلى المشاريع لفتح التحليلات.')"),
]

# Perform replacements
updated_count = 0
for old, new in replacements:
    if old in content:
        content = content.replace(old, new)
        updated_count += 1
        print(f"✓ Updated: {old[:50]}...")

# Write the file back
with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"\n✓ File updated successfully! {updated_count} translations added.")
