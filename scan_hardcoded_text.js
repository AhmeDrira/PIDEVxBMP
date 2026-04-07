const fs = require('fs');
const path = require('path');

// Comprehensive dictionary of translations
const translations = {
  'Home': ['Accueil', 'الصفحة الرئيسية'],
  'Dashboard': ['Tableau de bord', 'لوحة التحكم'],
  'Projects': ['Projets', 'المشاريع'],
  'My Projects': ['Mes projets', 'مشاريعي'],
  'Quotes': ['Devis', 'العروض'],
  'Invoices': ['Factures', 'الفواتير'],
  'Messages': ['Messages', 'الرسائل'],
  'Marketplace': ['Place de marche', 'سوق البناء'],
  'Products': ['Produits', 'المنتجات'],
  'Profile': ['Profil', 'الملف الشخصي'],
  'Settings': ['Parametres', 'الإعدادات'],
  'Logout': ['Se deconnecter', 'تسجيل الخروج'],
  'Loading...': ['Chargement...', 'جاري التحميل...'],
  'Error': ['Erreur', 'خطأ'],
  'Success': ['Succes', 'نجح'],
  'Save': ['Enregistrer', 'حفظ'],
  'Cancel': ['Annuler', 'إلغاء'],
  'Delete': ['Supprimer', 'حذف'],
  'Edit': ['Modifier', 'تعديل'],
  'Add': ['Ajouter', 'إضافة'],
  'Create': ['Creer', 'إنشاء'],
  'Submit': ['Soumettre', 'إرسال'],
  'Next': ['Suivant', 'التالي'],
  'Previous': ['Precedent', 'السابق'],
  'Back': ['Retour', 'العودة'],
  'Search': ['Rechercher', 'البحث'],
  'Filter': ['Filtrer', 'تصفية'],
  'No data available': ['Aucune donnee disponible', 'لا توجد بيانات متاحة'],
  'No results found': ['Aucun resultat trouve', 'لم يتم العثور على نتائج'],
  'Orders': ['Commandes', 'الطلبات'],
  'My Orders': ['Mes commandes', 'طلباتي'],
  'Details': ['Details', 'التفاصيل'],
  'Status': ['Statut', 'الحالة'],
  'Date': ['Date', 'التاريخ'],
  'Total': ['Total', 'المجموع'],
  'Amount': ['Montant', 'المبلغ'],
  'Price': ['Prix', 'السعر'],
  'Quantity': ['Quantite', 'الكمية'],
  'Description': ['Description', 'الوصف'],
  'Category': ['Categorie', 'الفئة'],
  'Yes': ['Oui', 'نعم'],
  'No': ['Non', 'لا'],
  'Pending': ['En attente', 'قيد الانتظار'],
  'Completed': ['Termine', 'مكتمل'],
  'Active': ['Actif', 'نشط'],
  'Inactive': ['Inactif', 'غير نشط'],
  'Language': ['Langue', 'اللغة'],
  'Theme': ['Theme', 'المظهر'],
  'Dark Mode': ['Mode sombre', 'الوضع الليلي'],
  'Light Mode': ['Mode clair', 'الوضع الفاتح'],
  'English': ['Anglais', 'الإنجليزية'],
  'French': ['Francais', 'الفرنسية'],
  'Arabic': ['Arabe', 'العربية'],
  'Subscription': ['Abonnement', 'الاشتراك'],
  'Plan': ['Plan', 'الخطة'],
  'Monthly': ['Mensuel', 'شهري'],
  'Quarterly': ['Trimestriel', 'فصلي'],
  'Yearly': ['Annuel', 'سنوي'],
  'Payment': ['Paiement', 'الدفع'],
  'Account': ['Compte', 'الحساب'],
  'Help': ['Aide', 'مساعدة'],
  'Support': ['Support', 'الدعم'],
  'Contact Us': ['Nous contacter', 'اتصل بنا'],
  'FAQ': ['FAQ', 'الأسئلة الشائعة'],
  'About': ['A propos', 'معلومات'],
  'Terms': ['Conditions', 'الشروط'],
  'Privacy': ['Confidentialite', 'الخصوصية'],
  'Download': ['Telecharger', 'تحميل'],
  'Upload': ['Telecharger', 'تحميل'],
  'Share': ['Partager', 'مشاركة'],
  'Print': ['Imprimer', 'طباعة'],
  'Export': ['Exporter', 'تصدير'],
  'Import': ['Importer', 'استيراد'],
  'Refresh': ['Actualiser', 'تحديث'],
  'Notifications': ['Notifications', 'التنبيهات'],
  'Welcome': ['Bienvenue', 'مرحبا'],
  'Login': ['Connexion', 'تسجيل الدخول'],
  'Register': ['S\'inscrire', 'التسجيل'],
  'Email': ['Email', 'البريد الإلكتروني'],
  'Password': ['Mot de passe', 'كلمة المرور'],
  'Username': ['Nom d\'utilisateur', 'اسم المستخدم'],
  'Phone': ['Telephone', 'الهاتف'],
  'Address': ['Adresse', 'العنوان'],
  'City': ['Ville', 'المدينة'],
  'Country': ['Pays', 'البلد'],
  'Zip Code': ['Code postal', 'الرمز البريدي'],
  'First Name': ['Prenom', 'الاسم الأول'],
  'Last Name': ['Nom', 'الاسم الأخير'],
  'Full Name': ['Nom complet', 'الاسم الكامل'],
  'Company': ['Entreprise', 'الشركة'],
  'Website': ['Site web', 'الموقع'],
  'Social Media': ['Reseaux sociaux', 'وسائل التواصل الاجتماعي'],
};

function getTranslation(en, translations) {
  if (translations[en]) {
    return translations[en];
  }
  return [en, en]; // If not found, use English for both
}
// test
function findHardcodedText(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const issues = [];
  // Find text in h1, h2, h3 tags
  const hTagPattern = /<h[1-3][^>]*>([^<]+)<\/h[1-3]>/g;
  let match;
  while ((match = hTagPattern.exec(content)) !== null) {
    const text = match[1].trim();
    if (text && !text.includes('{') && text.length > 2) {
      issues.push({
        type: 'heading',
        text: text,
        line: content.substring(0, match.index).split('\n').length
      });
    }
  }
  
  // Find text in buttons and strong tags
  const buttonPattern = /<(button|strong|Button|a)[^>]*>([^<{]+)<\/(button|strong|Button|a)>/g;
  while ((match = buttonPattern.exec(content)) !== null) {
    const text = match[2].trim();
    if (text && text.length > 2 && !text.match(/^[\d\s]+$/) && text.length < 100) {
      issues.push({
        type: 'element',
        text: text,
        tag: match[1],
        line: content.substring(0, match.index).split('\n').length
      });
    }
  }
  
  return issues;
}

function processComponentFile(filePath) {
  try {
    if (!filePath.includes('components/artisan') && !filePath.includes('components/expert') && 
        !filePath.includes('components/manufacturer') && !filePath.includes('components/auth') &&
        !filePath.includes('components/dashboards') && !filePath.includes('components/admin') &&
        !filePath.includes('components/knowledge')) {
      return null;
    }
    
    const issues = findHardcodedText(filePath);
    return issues.length > 0 ? { file: filePath, issues } : null;
  } catch (error) {
    console.error(`Error processing ${filePath}: ${error.message}`);
    return null;
  }
}

function processDirectory(dir, results = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      processDirectory(filePath, results);
    } else if (file.endsWith('.tsx')) {
      const result = processComponentFile(filePath);
      if (result) {
        results.push(result);
      }
    }
  });
  
  return results;
}

const rootDir = path.join(__dirname, 'frontend/src/components');
console.log('Scanning for hardcoded text in page components...\n');
const findings = processDirectory(rootDir);

if (findings.length > 0) {
  console.log(`Found ${findings.length} files with potential hardcoded text:\n`);
  findings.slice(0, 20).forEach(finding => {
    console.log(`📄 ${path.relative(rootDir, finding.file)}`);
    finding.issues.slice(0, 3).forEach(issue => {
      console.log(`   Line ${issue.line}: "${issue.text}"`);
    });
    if (finding.issues.length > 3) {
      console.log(`   ... and ${finding.issues.length - 3} more`);
    }
    console.log('');
  });
  
  if (findings.length > 20) {
    console.log(`... and ${findings.length - 20} more files\n`);
  }
} else {
  console.log('No hardcoded text found in main page components.');
}

console.log(`\nTotal files analyzed: ${findings.length}`);
console.log('\nNote: Review these manually or use the tr() wrapper to localize them.');
