const fs = require('fs');
const path = require('path');

// Translation mappings (English -> Arabic)
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
  'Back To Directory': 'العودة إلى الدليل',
  'Back to Directory': 'العودة إلى الدليل',
  'Loading...': 'جاري التحميل...',
  'Add to Cart': 'إضافة إلى السلة',
  'View': 'عرض',
  'Delete': 'حذف',
  'Submit': 'إرسال',
  'Generate Invoice': 'إنشاء فاتورة',
  'Generate Quote': 'إنشاء عرض أسعار',
  'Add New Project': 'إضافة مشروع جديد',
  'Projects': 'المشاريع',
  'Home': 'الصفحة الرئيسية',
  'My Projects': 'مشاريعي',
  'Messages': 'الرسائل',
  'Quotes': 'العروض',
  'Invoices': 'الفواتير',
  'My Orders': 'طلباتي',
  'Marketplace': 'سوق البناء',
  'Subscription': 'الاشتراك',
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
  'Save Profile': 'حفظ الملف الشخصي',
  'Edit': 'تعديل',
  'Download': 'تحميل',
  'No data available': 'لا توجد بيانات متاحة',
  'Quote Conversion': 'تحويل العروض',
  'Recent Projects': 'المشاريع الأخيرة',
  'Your active construction projects': 'مشاريعك الإنشائية النشطة',
  'View All Projects': 'عرض جميع المشاريع',
  'No projects yet. Create your first project.': 'لا توجد مشاريع حتى الآن. أنشئ مشروعك الأول.',
  'Recent Activity': 'النشاط الأخير',
  'No recent activity detected.': 'لم يتم الكشف عن أي نشاط حديث.',
  'Browse and order construction materials': 'تصفح واطلب مواد البناء',
  'Shopping Cart': 'سلة التسوق',
  'Proceed to Checkout': 'متابعة الدفع',
  'Order Placed Successfully!': 'تم طلب الطلبية بنجاح!',
  'Your cart is empty': 'سلتك فارغة',
  'Monthly': 'شهري',
  '3 Months': 'ثلاثة أشهر',
  'Yearly': 'سنوي',
  'Choose Your Plan': 'اختر خطتك',
  'Current Plan': 'الخطة الحالية',
  'Upgrade Now': 'الترقية الآن',
  'Payment History': 'سجل الدفعات',
  'Back to Invoices': 'العودة إلى الفواتير',
  'Generate New Invoice': 'إنشاء فاتورة جديدة',
  'No Marketplace Materials': 'لا توجد مواد سوق',
  'Buy Materials': 'شراء المواد',
  'Payment Progress': 'تقدم الدفع',
  'Project:': 'المشروع:',
  'Unknown Project': 'مشروع غير معروف',
  'Issue Date:': 'تاريخ الإصدار:',
  'Due Date:': 'تاريخ الاستحقاق:',
  'Description of Work / Items:': 'وصف العمل / العناصر:',
  'Total Amount Due': 'المبلغ الإجمالي المستحق',
  'Paid:': 'المدفوع:',
  'Checking...': 'جاري التحقق...',
  'Back to Quotes': 'العودة إلى العروض',
  'Generate New Quote': 'إنشاء عرض أسعار جديد',
  'My Reports': 'تقاريري',
  'Add Report': 'إضافة تقرير',
  'Close Form': 'إغلاق النموذج',
  'You must be logged in to submit a report.': 'يجب أن تكون مسجلاً لتقديم التقرير.',
  'Report submitted. We will notify you soon via email once it is treated.': 'تم تقديم التقرير. سيتم إخطارك قريباً عبر البريد الإلكتروني بعد معالجته.',
};

function updateTrCalls(content) {
  let updated = content;
  // Pattern to find tr() calls with 2 parameters (without Arabic)
  const pattern = /tr\('([^']*)',\s*'([^']*)'\)(?!\s*,\s*')/g;
  
  updated = updated.replace(pattern, (match, en, fr) => {
    const ar = arabicTranslations[en] || en;
    return `tr('${en}', '${fr}', '${ar}')`;
  });
  
  return updated;
}

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      processDirectory(filePath);
    } else if (file.endsWith('.tsx')) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const updated = updateTrCalls(content);
      
      if (content !== updated) {
        fs.writeFileSync(filePath, updated);
        console.log(`✓ Updated: ${filePath}`);
      }
    }
  });
}

const rootDir = path.join(__dirname, 'frontend/src/components');
console.log('Processing all TSX components...');
processDirectory(rootDir);
console.log('✓ Completed!');
