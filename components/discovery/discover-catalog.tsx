'use client';

import { motion, AnimatePresence } from 'motion/react';
import { Eye, Users } from 'lucide-react';
import { useI18n } from '@/lib/hooks/use-i18n';

export type DiscoverFilter =
  | 'all'
  | 'math'
  | 'cs'
  | 'science'
  | 'arabic'
  | 'business';

interface DiscoverCourse {
  id: string;
  filter: DiscoverFilter;
  views: string;
  students?: string;
  featured?: boolean;
}

const COURSES: DiscoverCourse[] = [
  {
    id: 'limits',
    filter: 'math',
    views: '6.2k',
    students: '82',
    featured: true,
  },
  {
    id: 'db',
    filter: 'cs',
    views: '4.1k',
    students: '56',
    featured: true,
  },
  {
    id: 'bio',
    filter: 'science',
    views: '3.4k',
  },
  {
    id: 'phys',
    filter: 'science',
    views: '2.9k',
  },
  {
    id: 'arabic',
    filter: 'arabic',
    views: '5.0k',
  },
  {
    id: 'biz',
    filter: 'business',
    views: '2.2k',
  },
];

const COURSE_TEXT_AR: Record<
  string,
  {
    title: string;
    description: string;
    tag: string;
    table1?: string;
    row1?: string;
    table2?: string;
    row2?: string;
    table3?: string;
    row3?: string;
    panelLabel?: string;
    rootLetters?: string;
    pattern1?: string;
    pattern2?: string;
  }
> = {
  limits: {
    title: 'النهايات والاتصال',
    description:
      'أتقن النهايات من جانب واحد، والخطوط المقاربة، والاتصال من خلال شروحات مرئية خطوة بخطوة.',
    tag: 'الرياضيات',
  },
  db: {
    title: 'تسوية قواعد البيانات',
    description:
      'حوّل جداول البيانات الفوضوية إلى جداول علائقية منظمة، صيغة قياسية تلو الأخرى.',
    tag: 'علوم الحاسوب',
    table1: 'الطلاب',
    row1: 'الرقم · الاسم · التخصص',
    table2: 'التسجيلات',
    row2: 'رقم_الطالب · رقم_المقرر',
    table3: 'المقررات',
    row3: 'الرقم · العنوان · الساعات',
    panelLabel: 'الصيغة القياسية',
  },
  bio: {
    title: 'تركيب الخلية',
    description: 'استكشف عضيات الخلية طبقة تلو طبقة، من الغشاء إلى النواة.',
    tag: 'الأحياء',
  },
  phys: {
    title: 'قوانين نيوتن',
    description: 'اشعر بقوى الدفع والجذب وراء كل مسألة حركة.',
    tag: 'الفيزياء',
  },
  arabic: {
    title: 'الصرف العربي — Arabic Morphology',
    description:
      'حلّل الكلمات إلى جذرها ووزنها، بالعربية والإنجليزية جنباً إلى جنب.',
    tag: 'اللغة العربية',
    rootLetters: 'ك ت ب',
    pattern1: 'فَعَلَ',
    pattern2: 'كَاتِب',
  },
  biz: {
    title: 'الوسط والتباين',
    description:
      'حوّل البيانات الخام إلى قرارات باستخدام المقاييس الإحصائية الأساسية.',
    tag: 'الأعمال',
  },
};

function MathVisual() {
  return (
    <svg viewBox="0 0 400 190" className="h-[80%] w-[88%]">
      <defs>
        <radialGradient id="m-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#C68EFD" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#C68EFD" stopOpacity="0" />
        </radialGradient>
      </defs>
      <line x1="30" y1="160" x2="380" y2="160" stroke="#8F87F1" strokeOpacity="0.35" strokeWidth="1.5" />
      <line x1="30" y1="20" x2="30" y2="160" stroke="#8F87F1" strokeOpacity="0.35" strokeWidth="1.5" />
      <line x1="30" y1="55" x2="380" y2="55" stroke="#E9A5F1" strokeDasharray="3 6" strokeWidth="1.5" strokeOpacity="0.8" />
      <path d="M40,155 C 110,150 150,60 230,56 C 290,53 330,55 375,55" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      <circle cx="230" cy="56" r="20" fill="url(#m-glow)" />
      <circle cx="230" cy="56" r="5" fill="#fff" />
      <text x="335" y="48" fill="#E9A5F1" fontSize="12" fontFamily="Inter, sans-serif" fontWeight="600">
        L
      </text>
    </svg>
  );
}

function DbVisual() {
  const text = COURSE_TEXT_AR.db;
  return (
    <div className="flex w-full items-center gap-6 px-5 pb-4 pt-10">
      <div className="flex flex-1 flex-col gap-2.5">
        <div className="rounded-[10px] border-[1.5px] border-[#E1D5FA] bg-white px-2.5 py-1.5 text-[10.5px] font-bold text-[#3E2870] shadow-sm">
          {text.table1}
          <div className="mt-[3px] text-[9.5px] font-medium text-[#9A93AC]">{text.row1}</div>
        </div>
        <div className="rounded-[10px] border-[1.5px] border-[#E1D5FA] bg-white px-2.5 py-1.5 text-[10.5px] font-bold text-[#3E2870] shadow-sm">
          {text.table2}
          <div className="mt-[3px] text-[9.5px] font-medium text-[#9A93AC]">{text.row2}</div>
        </div>
        <div className="rounded-[10px] border-[1.5px] border-[#E1D5FA] bg-white px-2.5 py-1.5 text-[10.5px] font-bold text-[#3E2870] shadow-sm">
          {text.table3}
          <div className="mt-[3px] text-[9.5px] font-medium text-[#9A93AC]">{text.row3}</div>
        </div>
      </div>
      <div className="min-w-[96px] rounded-xl bg-white p-2.5 text-[10px] text-[#6E6580] shadow-md">
        <div className="mb-1.5 text-[10px] font-bold text-[#53358F]">{text.panelLabel}</div>
        <div className="flex gap-1">
          <span className="flex-1 rounded-md bg-[#F1EAFE] py-1 text-center text-[9px] font-bold text-[#53358F]">1NF</span>
          <span className="flex-1 rounded-md bg-[#F1EAFE] py-1 text-center text-[9px] font-bold text-[#53358F]">2NF</span>
          <span className="flex-1 rounded-md bg-[#53358F] py-1 text-center text-[9px] font-bold text-white">3NF</span>
        </div>
      </div>
    </div>
  );
}

function BioVisual() {
  return (
    <svg className="h-[80%] w-[70%]" viewBox="0 0 160 160">
      <ellipse cx="80" cy="80" rx="62" ry="52" fill="none" stroke="#E9A5F1" strokeWidth="3" />
      <circle cx="80" cy="80" r="22" fill="#8F87F1" fillOpacity="0.85" />
      <circle cx="88" cy="76" r="6" fill="#3E2870" />
      <ellipse cx="45" cy="55" rx="10" ry="6" fill="#C68EFD" />
      <ellipse cx="118" cy="100" rx="12" ry="7" fill="#C68EFD" />
      <ellipse cx="55" cy="112" rx="9" ry="5" fill="#FED2E2" stroke="#E9A5F1" />
    </svg>
  );
}

function PhysicsVisual() {
  return (
    <svg className="h-[75%] w-[70%]" viewBox="0 0 160 140">
      <rect x="62" y="55" width="40" height="40" rx="6" fill="#53358F" />
      <line x1="102" y1="75" x2="150" y2="75" stroke="#8F87F1" strokeWidth="3" strokeLinecap="round" />
      <path d="M150,75 l-10,-6 m10,6 l-10,6" stroke="#8F87F1" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="62" y1="75" x2="18" y2="75" stroke="#E9A5F1" strokeWidth="3" strokeLinecap="round" />
      <path d="M18,75 l10,-6 m-10,6 l10,6" stroke="#E9A5F1" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="82" y1="55" x2="82" y2="22" stroke="#C68EFD" strokeWidth="3" strokeLinecap="round" />
      <path d="M82,22 l-6,10 m6,-10 l6,10" stroke="#C68EFD" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArabicVisual() {
  const text = COURSE_TEXT_AR.arabic;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="text-[34px] font-bold text-[#3E2870]" dir="rtl" style={{ fontFamily: 'var(--font-arabic), Tajawal, sans-serif' }}>
        {text.rootLetters}
      </div>
      <div className="flex gap-1.5">
        <span className="rounded-lg border-[1.5px] border-[#F4C9DE] bg-white px-2.5 py-[3px] text-xs font-bold text-[#8A3D75]" style={{ fontFamily: 'var(--font-arabic), Tajawal, sans-serif' }}>
          {text.pattern1}
        </span>
        <span className="rounded-lg border-[1.5px] border-[#F4C9DE] bg-white px-2.5 py-[3px] text-xs font-bold text-[#8A3D75]" style={{ fontFamily: 'var(--font-arabic), Tajawal, sans-serif' }}>
          {text.pattern2}
        </span>
      </div>
    </div>
  );
}

function BusinessVisual() {
  return (
    <svg className="h-[75%] w-[75%]" viewBox="0 0 160 120">
      <path d="M10,100 C 40,100 45,20 80,20 C 115,20 120,100 150,100" fill="none" stroke="#53358F" strokeWidth="3" />
      <path d="M60,100 L60,60 Q80,20 100,60 L100,100 Z" fill="#C68EFD" fillOpacity="0.4" />
      <line x1="10" y1="100" x2="150" y2="100" stroke="#B9B1CE" strokeWidth="1.5" />
    </svg>
  );
}

function CourseVisual({ id }: { id: string }) {
  switch (id) {
    case 'limits':
      return <MathVisual />;
    case 'db':
      return <DbVisual />;
    case 'bio':
      return <BioVisual />;
    case 'phys':
      return <PhysicsVisual />;
    case 'arabic':
      return <ArabicVisual />;
    case 'biz':
      return <BusinessVisual />;
    default:
      return null;
  }
}

function visualClass(id: string): string {
  switch (id) {
    case 'limits':
      return 'masar-discover-visual-math';
    case 'db':
      return 'masar-discover-visual-db';
    case 'bio':
      return 'masar-discover-visual-bio';
    case 'phys':
      return 'masar-discover-visual-phys';
    case 'arabic':
      return 'masar-discover-visual-arabic';
    case 'biz':
      return 'masar-discover-visual-biz';
    default:
      return '';
  }
}

function tagVariant(id: string): string {
  switch (id) {
    case 'limits':
      return 'glass';
    case 'db':
    case 'phys':
    case 'biz':
      return 'light';
    case 'bio':
    case 'arabic':
      return 'blush';
    default:
      return 'light';
  }
}

function CourseCard({
  course,
  featured = false,
}: {
  course: DiscoverCourse;
  featured?: boolean;
}) {
  const text = COURSE_TEXT_AR[course.id];
  const variant = tagVariant(course.id);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25 }}
      className={`masar-discover-card group ${featured ? 'masar-discover-featured' : ''}`}
    >
      <div className={`masar-discover-visual ${visualClass(course.id)} ${featured ? 'h-[190px]' : 'h-[140px]'}`}>
        <span className={`masar-discover-tag masar-discover-tag-${variant}`}>{text.tag}</span>
        <div className="masar-discover-stats">
          <span className="masar-discover-stat">
            <Eye className="size-[11px]" />
            {course.views}
          </span>
          {course.students && (
            <span className="masar-discover-stat">
              <Users className="size-[11px]" />
              {course.students}
            </span>
          )}
        </div>
        <CourseVisual id={course.id} />
      </div>
      <div className="masar-discover-body">
        <h3>{text.title}</h3>
        <p>{text.description}</p>
      </div>
    </motion.div>
  );
}

export function DiscoverCatalog({ activeFilter }: { activeFilter: DiscoverFilter }) {
  const { t } = useI18n();

  const filtered = COURSES.filter(
    (c) => activeFilter === 'all' || c.filter === activeFilter,
  );
  const featured = filtered.filter((c) => c.featured);
  const regular = filtered.filter((c) => !c.featured);

  return (
    <div className="masar-discover-catalog">
      <AnimatePresence mode="wait">
        {featured.length > 0 && (
          <motion.div
            key={`featured-${activeFilter}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="masar-discover-grid-top"
          >
            {featured.map((course) => (
              <CourseCard key={course.id} course={course} featured />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {regular.length > 0 && (
          <motion.div
            key={`regular-${activeFilter}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="masar-discover-grid-bottom"
          >
            {regular.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {filtered.length === 0 && (
        <div className="py-16 text-center text-sm text-muted-foreground">
          {t('classroom.searchEmpty')}
        </div>
      )}
    </div>
  );
}
