import { plural } from "../plural";
import type { Messages } from "./en";

/** Keeps Latin legal references such as "§§ 187, 188 BGB" in their order inside Arabic text */
const ltr = (text: string) => `⁦${text}⁩`;

/** Modern Standard Arabic in simple words. German terms stay in Latin script. */
export const ar: Messages = {
  app: {
    nav: { upload: "رفع رسالة", documents: "رسائلي", settings: "الإعدادات" },
    language: "اللغة",
  },

  common: {
    loading: "جارٍ التحميل…",
    saving: "جارٍ الحفظ…",
    saved: "تم الحفظ.",
    cancel: "إلغاء",
    delete: "حذف",
    remove: "إزالة",
    tryAgain: "حاول مرة أخرى",
    starting: "جارٍ البدء…",
  },

  status: { UPLOADED: "في الانتظار", PROCESSING: "قيد المعالجة", DONE: "جاهزة", FAILED: "فشلت" },

  processing: {
    preprocessing: "جارٍ تجهيز الملف",
    extracting: "جارٍ قراءة الرسالة وتحليلها",
    translating: "جارٍ ترجمة النتائج",
    saving: "جارٍ حفظ النتائج",
    retrying: "خدمة الذكاء الاصطناعي مشغولة، ستتم المحاولة مرة أخرى بعد قليل",
    processing: "قيد المعالجة…",
    queued: "في قائمة الانتظار…",
  },

  upload: {
    title: "افهم رسالتك الرسمية",
    intro:
      "ارفع رسالة من Finanzamt أو Jobcenter أو Ausländerbehörde أو أي جهة رسمية أخرى. " +
      "سنشرحها لك بكلمات بسيطة، ونخبرك بما عليك فعله وما هو الموعد النهائي.",
    drop: "اسحب الرسالة إلى هنا أو انقر لاختيار ملف",
    hint: "PDF أو JPG أو PNG · حتى 10 ميغابايت",
    uploading: "جارٍ الرفع…",
    invalidType: "يمكن رفع ملفات PDF وJPG وPNG فقط.",
    tooLarge: "الملف كبير جدًا (الحد الأقصى 10 ميغابايت).",
    disclaimer: "BriefKlar لا يقدّم استشارة قانونية. تحقّق دائمًا من المواعيد النهائية المهمة بنفسك.",
  },

  documents: {
    title: "رسائلي",
    empty: "لا توجد رسائل بعد.",
    uploadFirst: "ارفع رسالتك الأولى",
  },

  detail: {
    deletePermanently: "حذف نهائي",
    deleting: "جارٍ الحذف…",
    noWorkerBefore: "لا توجد عملية تعمل في الخلفية، لذلك لا يمكن معالجة هذه الرسالة. شغّل التطبيق بالأمر",
    noWorkerAfter: ".",
    originalLetter: "الرسالة الأصلية",
    failed: "فشلت المعالجة.",
    noAnalysis: "لا يوجد تحليل لهذه الرسالة.",
  },

  analysis: {
    urgency: { LOW: "غير عاجلة", MEDIUM: "مطلوب منك إجراء", HIGH: "عاجلة" },
    senderTypes: {
      FINANZAMT: "مكتب الضرائب (Finanzamt)",
      JOBCENTER: "مركز العمل (Jobcenter)",
      AGENTUR_FUER_ARBEIT: "وكالة العمل (Agentur für Arbeit)",
      AUSLAENDERBEHOERDE: "دائرة الأجانب (Ausländerbehörde)",
      BUERGERAMT: "مكتب المواطنين (Bürgeramt)",
      KRANKENKASSE: "التأمين الصحي (Krankenkasse)",
      RUNDFUNKBEITRAG: "رسوم البث (Rundfunkbeitrag)",
      FAMILIENKASSE: "صندوق إعانات الأسرة (Familienkasse)",
      COURT: "محكمة",
      EMPLOYER: "صاحب العمل",
      LANDLORD: "المؤجِّر",
      COMPANY: "شركة",
      OTHER: "أخرى",
    },
    letterTypes: {
      BESCHEID: "قرار رسمي (Bescheid)",
      MAHNUNG: "تذكير بالدفع (Mahnung)",
      AUFFORDERUNG: "طلب لاتخاذ إجراء",
      TERMIN: "موعد",
      KUENDIGUNG: "إنهاء عقد (Kündigung)",
      INVOICE: "فاتورة",
      INFO: "معلومات / تأكيد",
      OTHER: "أخرى",
    },
    deadlineKinds: {
      PAYMENT: "الدفع",
      RESPONSE: "الرد",
      OBJECTION: "الاعتراض (Widerspruch)",
      APPOINTMENT: "موعد",
      DOCUMENTS: "إرسال مستندات",
      OTHER: "أخرى",
    },
    fields: {
      summary: "الملخص",
      sender: "المرسِل",
      letterType: "نوع الرسالة",
      letterDate: "تاريخ الرسالة",
      subject: "الموضوع",
      references: "الأرقام المرجعية",
      amounts: "المبالغ",
      deadlines: "المواعيد النهائية",
      requiredActions: "ما عليك فعله",
      requiredDocuments: "المستندات المطلوبة",
      objectionPossible: "حق الاعتراض",
      urgency: "درجة الاستعجال",
    },
    sections: {
      explained: "شرح بكلمات بسيطة",
      todo: "ما عليك فعله",
      deadlines: "المواعيد النهائية",
      amounts: "المبالغ",
      documents: "المستندات المطلوب إرسالها",
      references: "الأرقام المرجعية",
      reply: "اكتب ردًا باللغة الألمانية",
    },
    notOfficial: "لا يبدو هذا رسالة رسمية. قد لا تكون النتائج مفيدة.",
    uncertain: (fields: string) =>
      `يرجى التحقق من: ${fields}. كانت بعض أجزاء الرسالة صعبة القراءة أو غير واضحة.`,
    nothingToDo: "لا يلزمك فعل شيء. هذه الرسالة للعلم فقط.",
    estimated: "تقديري",
    howCalculated: "كيف حُسب هذا التاريخ",
    undated: "تعذّر حساب التاريخ، يرجى الرجوع إلى الرسالة",
    objectionRight:
      "يحق لك الاعتراض على هذا القرار (Widerspruch / Einspruch). تحقّق من الموعد النهائي في الرسالة.",
    footer: (model: string, version: string) =>
      `حلّلها ${model} (${version}). BriefKlar لا يقدّم استشارة قانونية. ` +
      "تحقّق دائمًا من التفاصيل المهمة في الرسالة الأصلية.",
    translating: (language: string) => `جارٍ ترجمة التحليل إلى ${language}…`,
    translationFailed: "تعذّرت ترجمة التحليل، لذلك يظهر باللغة الإنجليزية.",
  },

  deadlineSteps: {
    START_ASSUMED: () => "لا تذكر الرسالة متى تبدأ المهلة، لذلك يُفترض أنها تبدأ يوم التسليم.",
    RECEIVED_ON: (date: string) => `استلمت الرسالة يوم ${date}.`,
    STARTS_ON_LETTER_DATE: (date: string) => `تبدأ المهلة من تاريخ الرسالة: ${date}.`,
    DEEMED_DELIVERY: (days: number, letterDate: string, deliveryDate: string) =>
      `الرسالة التي ترسلها جهة رسمية بالبريد تُعدّ مُسلَّمة في اليوم ${days === 4 ? "الرابع" : "الثالث"} ` +
      `بعد إرسالها (${ltr("§ 122 AO, § 41 VwVfG, § 37 SGB X")}). إذا أُرسلت بتاريخ الرسالة (${letterDate})، ` +
      `فهذا اليوم هو ${deliveryDate}.`,
    COUNTED_FROM_LETTER_DATE: (date: string) =>
      `لا تذكر الرسالة متى وصلت إليك. للاحتياط تُحسب المهلة من تاريخ الرسالة: ${date}. ` +
      "إذا استلمتها لاحقًا، فقد يكون موعدك النهائي لاحقًا أيضًا.",
    YELLOW_ENVELOPE: () =>
      "إذا وصلت الرسالة في ظرف أصفر (Zustellung)، فتاريخ التسليم مكتوب على الظرف.",
    DELIVERY_MOVED: (date: string, reason: string, movedTo: string) =>
      `يوافق ${date} ${reason}، لذلك يُنقل يوم التسليم إلى يوم العمل التالي: ${movedTo}.`,
    PERIOD_ENDS: (period: string, start: string, end: string) =>
      `مدة ${period} بعد ${start} تنتهي يوم ${end} (${ltr("§§ 187, 188 BGB")}).`,
    DEADLINE_MOVED: (date: string, reason: string, movedTo: string) =>
      `يوافق ${date} ${reason}، لذلك يُنقل الموعد النهائي إلى يوم العمل التالي: ${movedTo} (${ltr("§ 193 BGB")}).`,
    REGIONAL_HOLIDAY: (date: string, states: string) =>
      `يوم ${date} عطلة رسمية في بعض الولايات الألمانية (${states}). ` +
      "إذا كنت تسكن في إحداها، فالموعد النهائي هو يوم العمل التالي.",
  },

  nonWorkingDay: {
    SATURDAY: "يوم سبت",
    SUNDAY: "يوم أحد",
    holiday: (name: string) => `عطلة رسمية (${name})`,
  },

  period: (amount: number, unit) =>
    plural("ar", amount, {
      DAY: { zero: "# يوم", one: "يوم واحد", two: "يومين", few: "# أيام", many: "# يومًا", other: "# يوم" },
      WEEK: {
        zero: "# أسبوع",
        one: "أسبوع واحد",
        two: "أسبوعين",
        few: "# أسابيع",
        many: "# أسبوعًا",
        other: "# أسبوع",
      },
      MONTH: { zero: "# شهر", one: "شهر واحد", two: "شهرين", few: "# أشهر", many: "# شهرًا", other: "# شهر" },
      YEAR: { zero: "# سنة", one: "سنة واحدة", two: "سنتين", few: "# سنوات", many: "# سنة", other: "# سنة" },
    }[unit]),

  holidays: {
    NEW_YEAR: "رأس السنة الميلادية",
    EPIPHANY: "عيد الغطاس",
    WOMENS_DAY: "اليوم العالمي للمرأة",
    GOOD_FRIDAY: "الجمعة العظيمة",
    EASTER_MONDAY: "اثنين الفصح",
    LABOUR_DAY: "عيد العمال",
    LIBERATION_DAY: "يوم التحرير",
    ASCENSION_DAY: "عيد الصعود",
    WHIT_MONDAY: "اثنين العنصرة",
    CORPUS_CHRISTI: "عيد القربان المقدس",
    ASSUMPTION_DAY: "عيد انتقال العذراء",
    CHILDRENS_DAY: "اليوم العالمي للطفل",
    GERMAN_UNITY_DAY: "يوم الوحدة الألمانية",
    REFORMATION_DAY: "يوم الإصلاح",
    ALL_SAINTS_DAY: "عيد جميع القديسين",
    REPENTANCE_DAY: "يوم التوبة والصلاة",
    CHRISTMAS_DAY: "عيد الميلاد",
    BOXING_DAY: "ثاني أيام عيد الميلاد",
  },

  explanation: {
    language: "لغة الشرح",
    explain: "اشرح بكلمات بسيطة",
    reading: "جارٍ قراءة الرسالة…",
    writing: "جارٍ الكتابة…",
    writtenBy: (model: string) =>
      `كتبه ${model}. تحقّق من الأسماء والمبالغ والتواريخ في الرسالة الأصلية.`,
  },

  receivedDate: {
    question: "متى وصلت الرسالة؟",
    use: "استخدم هذا التاريخ",
    hint:
      "عندها تُحسب المهل التي تبدأ بالتسليم من هذا اليوم بدلًا من تاريخ مُفترض. " +
      "إذا وصلت في ظرف أصفر (Zustellung)، فاستخدم التاريخ المكتوب عليه.",
    noState: "العطل الرسمية الخاصة بولايتك غير محسوبة بعد.",
    setState: "اختر ولايتك",
  },

  replies: {
    types: {
      OBJECTION: "اعتراض (Widerspruch / Einspruch)",
      EXTENSION_REQUEST: "طلب مهلة إضافية (Fristverlängerung)",
      SEND_DOCUMENTS: "رسالة مرافقة للمستندات",
      INSTALLMENT_PLAN: "طلب الدفع بالتقسيط (Ratenzahlung)",
      QUESTION: "طرح سؤال (Rückfrage)",
    },
    hints: {
      OBJECTION: "لماذا لا توافق؟ اترك الحقل فارغًا لتعترض الآن وترسل الأسباب لاحقًا.",
      EXTENSION_REQUEST: "لماذا تحتاج إلى وقت إضافي، وحتى متى؟",
      SEND_DOCUMENTS: "هل تريد إضافة شيء عن المستندات؟ (اختياري)",
      INSTALLMENT_PLAN: "كم يمكنك أن تدفع شهريًا، ولماذا لا يمكنك الدفع دفعة واحدة؟",
      QUESTION: "ماذا تريد أن تسأل؟",
    },
    ownLanguage: "يمكنك الكتابة بلغتك.",
    type: "نوع الرد",
    translationLanguage: "لغة الترجمة",
    translationOption: (language: string) => `الترجمة: ${language}`,
    notes: "ملاحظاتك للرد",
    write: "اكتب مسودة بالألمانية",
    writing: "جارٍ كتابة المسودة…",
    copy: "انسخ النص الألماني",
    copied: "تم النسخ",
    deleteDraft: "حذف المسودة",
    letter: "رسالة الرد بالألمانية",
    save: "حفظ التغييرات",
    undo: "التراجع عن التغييرات",
    whatItSays: (language: string) => `ماذا تقول الرسالة (${language})`,
    warnings: {
      NO_OBJECTION_RIGHT: () => "لا تذكر الرسالة حقًا في الاعتراض. تحقّق أولًا مما إذا كان الاعتراض ممكنًا.",
      OBJECTION_DEADLINE_PASSED: (date: string) =>
        `ربما انتهت مهلة الاعتراض (${date}). اطلب المساعدة بسرعة: الاعتراضات المتأخرة تُرفض عادةً.`,
      OBJECTION_DEADLINE: (date: string) =>
        `يجب أن تصل الرسالة حتى ${date}. وقّعها واحتفظ بإثبات الإرسال ` +
        "(مثل Einwurf-Einschreiben أو تقرير الفاكس).",
      REQUEST_ONLY: () => "هذا طلب فقط: يبقى الموعد النهائي ساريًا حتى يوافق المرسِل.",
      FILL_PLACEHOLDERS: (placeholders: string) => `املأ قبل الإرسال: ${placeholders}`,
    },
  },

  settings: {
    title: "الإعدادات",
    state: "الولاية الألمانية (Bundesland)",
    stateHint:
      "إذا انتهت مهلة في يوم عطلة رسمية، تُنقل إلى يوم العمل التالي. بعض العطل موجودة في بعض الولايات " +
      "فقط، لذلك قد تغيّر ولايتك الموعد النهائي. بدون اختيار ولاية تُحسب العطل الوطنية فقط.",
    stateNotSet: "غير محددة (العطل الوطنية فقط)",
    language: "لغتك",
    languageHint:
      "يظهر BriefKlar بهذه اللغة: الصفحات، وتحليل رسائلك، والشروحات، وترجمات مسودات الردود.",
  },

  errors: {
    NOT_FOUND: "هذه الصفحة أو هذا العنصر غير موجود.",
    NOT_AUTHENTICATED: "لم تقم بتسجيل الدخول.",
    INVALID_BODY: "الطلب غير صالح.",
    INVALID_PARAM: "الطلب غير صالح.",
    INVALID_LANGUAGE: "هذه اللغة غير مدعومة.",
    INTERNAL: "حدث خطأ من جهتنا. يرجى المحاولة مرة أخرى.",
    NO_FILE: "لم يتم رفع أي ملف.",
    UNSUPPORTED_TYPE: "يمكن رفع ملفات PDF وJPG وPNG فقط.",
    LIMIT_FILE_SIZE: "الملف كبير جدًا (الحد الأقصى 10 ميغابايت).",
    DOCUMENT_NOT_FOUND: "لم يتم العثور على هذه الرسالة.",
    ACTION_ITEM_NOT_FOUND: "لم يتم العثور على هذه المهمة.",
    DRAFT_NOT_FOUND: "لم يتم العثور على هذه المسودة.",
    ALREADY_PROCESSING: "هذه الرسالة قيد المعالجة. حاول مرة أخرى بعد قليل.",
    NOT_ANALYZED: "لم يتم تحليل هذه الرسالة بعد.",
    INVALID_DATE: "هذا التاريخ غير موجود.",
    DATE_IN_FUTURE: "لا يمكن أن يكون تاريخ الاستلام في المستقبل.",
    DATE_BEFORE_LETTER: "لا يمكن أن تكون الرسالة قد وصلت قبل تاريخها.",
    REMINDER_NOT_FOUND: "لم يتم العثور على هذا التذكير.",
    DATE_IN_PAST: "هذا التاريخ في الماضي.",
    AI_RATE_LIMITED: "خدمة الذكاء الاصطناعي تتلقى طلبات كثيرة الآن. يرجى المحاولة بعد بضع دقائق.",
    AI_OVERLOADED: "خدمة الذكاء الاصطناعي مشغولة جدًا الآن. يرجى المحاولة بعد بضع دقائق.",
    AI_KEY_REJECTED: "رفضت خدمة الذكاء الاصطناعي مفتاح API. تحقّق من GEMINI_API_KEY.",
    AI_MODEL_NOT_FOUND: "لم يتم العثور على نموذج الذكاء الاصطناعي المحدد. تحقّق من GEMINI_MODEL.",
    AI_FAILED: "لم تتمكن خدمة الذكاء الاصطناعي من معالجة هذا الطلب.",
    AI_INCOMPLETE: "أعاد الذكاء الاصطناعي إجابة غير مكتملة. يرجى المحاولة مرة أخرى.",
    PROCESSING_FAILED: "حدث خطأ أثناء معالجة هذه الرسالة.",
    connectionLost: "انقطع الاتصال. يرجى المحاولة مرة أخرى.",
    requestFailed: "فشل الطلب. يرجى المحاولة مرة أخرى.",
  },
};
