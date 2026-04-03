const fs = require('fs');
const path = require('path');

const arabicTranslations = {
  'Image must be less than 5MB': 'يجب أن تكون الصورة أقل من 5 ميجابايت',
  'Security error: Unable to find token.': 'خطأ أمان: لا يمكن العثور على الرمز.',
  'Profile updated successfully': 'تم تحديث الملف الشخصي بنجاح',
  'Failed to save profile': 'فشل حفظ الملف الشخصي',
  'Loading profile...': 'جاري تحميل الملف الشخصي...',
  'Cancel': 'إلغاء',
  'Edit Profile': 'تعديل الملف الشخصي',
  'Profile Information': 'معلومات الملف الشخصي',
  'First Name': 'الاسم الأول',
  'First name': 'الاسم الأول',
  'Last Name': 'الاسم الأخير',
  'Last name': 'الاسم الأخير',
  'Phone Number': 'رقم الهاتف',
  'Years of Experience': 'سنوات الخبرة',
  'Specialization': 'التخصص',
  'Select a specialization...': 'اختر التخصص...',
  'Location (Tunisia)': 'الموقع (تونس)',
  'Select one or more governorates.': 'اختر واحد أو أكثر من الولايات.',
  'Bio': 'النبذة الشخصية',
  'Tell us about yourself, your skills and experience...': 'أخبرنا عنك ومهاراتك وخبرتك...',
  'Skills & Expertise': 'المهارات والخبرة',
  'Add a skill (e.g. Brickwork)...': 'أضف مهارة (مثل البناء بالطوب)...',
  'Certifications': 'الشهادات',
  'Add a certification (e.g. OSHA Safety Certified)...': 'أضف شهادة (مثل معتمد السلامة)...',
  'Saving...': 'جاري الحفظ...',
  'Save Changes': 'حفظ التغييرات',
  'Click to change photo': 'انقر لتغيير الصورة',
  'Email': 'البريد الإلكتروني',
  'Phone': 'الهاتف',
  'Member Since': 'عضو منذ',
  'Back to Directory': 'العودة إلى الدليل',
  'Loading...': 'جاري التحميل...',
  'Add to Cart': 'إضافة إلى السلة',
  'View': 'عرض',
  'Delete': 'حذف',
  'Submit': 'إرسال',
  'Generate Invoice': 'إنشاء فاتورة',
  'Generate Quote': 'إنشاء عرض أسعار',
  'Add New Project': 'إضافة مشروع جديد',
  'Back to Portfolio': 'العودة إلى المحفظة',
  'Add New Portfolio Project': 'إضافة مشروع محفظة جديد',
  'Add an external project and upload local images/videos from your computer.': 'أضف مشروعاً خارجياً وحمّل صوراً/مقاطع فيديو محلية من جهاز الكمبيوتر الخاص بك.',
  'Project Title': 'عنوان المشروع',
  'Location': 'الموقع',
  'Description': 'الوصف',
  'Completed Date': 'تاريخ الانتهاء',
  'Project Media (local files)': 'وسائط المشروع (ملفات محلية)',
  'Import Images / Videos From PC': 'استيراد صور / مقاطع فيديو من الكمبيوتر',
  'Upload photo': 'تحميل صورة',
  'Company Name': 'اسم الشركة',
  'View All Projects': 'عرض جميع المشاريع',
  'No projects yet. Create your first project.': 'لا توجد مشاريع حتى الآن. أنشئ مشروعك الأول.',
  'Recent Activity': 'النشاط الأخير',
  'No recent activity detected.': 'لم يتم الكشف عن أي نشاط حديث.',
  'Back to Invoices': 'العودة إلى الفواتير',
  'Generate New Invoice': 'إنشاء فاتورة جديدة',
  'Back to Quotes': 'العودة إلى العروض',
  'Generate New Quote': 'إنشاء عرض أسعار جديد',
  'My Reports': 'تقاريري',
  'Add Report': 'إضافة تقرير',
  'Close Form': 'إغلاق النموذج',
  'You must be logged in to submit a report.': 'يجب أن تكون مسجلاً لتقديم التقرير.',
  'Report submitted. We will notify you soon via email once it is treated.': 'تم تقديم التقرير. سيتم إخطارك قريباً عبر البريد الإلكتروني بعد معالجته.',
  'years of experience': 'سنوات الخبرة',
  'View Portfolio': 'عرض المحفظة',
  'Contact Artisan': 'اتصل بالحرفي',
  'Reviews': 'التقييمات',
  'Projects Done': 'المشاريع المنجزة',
  'Years Experience': 'سنوات الخبرة',
  'Contact Information': 'معلومات التواصل',
  'About': 'معلومات',
  'Certifications': 'الشهادات',
  'Portfolio': 'المحفظة',
  'Statistics': 'الإحصائيات',
  'Rating': 'التقييم',
  'Send Message': 'إرسال رسالة',
  'Experience': 'الخبرة',
  'Completed Projects': 'المشاريع المنجزة',
};

function fixTwoParameterTr(content) {
  // Pattern to find tr calls with exactly 2 parameters (don't already have Arabic)
  // This pattern looks for: tr('...', '...') but NOT: tr('...', '...', '...')
  const pattern = /tr\('([^']*)',\s*'([^']*)'\)(?!\s*,\s*')/g;
  
  let modified = false;
  const updated = content.replace(pattern, (match, en, fr) => {
    const ar = arabicTranslations[en] || en;
    modified = true;
    return `tr('${en}', '${fr}', '${ar}')`;
  });
  
  return { updated, modified };
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
        const { updated, modified } = fixTwoParameterTr(content);
        
        if (modified) {
          fs.writeFileSync(filePath, updated);
          console.log(`✓ Fixed: ${filePath}`);
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
console.log('Fixing remaining 2-parameter tr() calls to add Arabic...\n');
const updated = processDirectory(rootDir);
console.log(`\n✓ Fixed ${updated} files with remaining 2-parameter tr() calls.`);
