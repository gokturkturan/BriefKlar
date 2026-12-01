import { plural } from "../plural";
import type { Messages } from "./en";

export const tr: Messages = {
  app: {
    nav: { upload: "Yükle", documents: "Mektuplarım", settings: "Ayarlar", reminders: "Hatırlatıcılar" },
    language: "Dil",
    dueReminders: (count) => `Zamanı gelen hatırlatıcılar: ${count}`,
  },

  common: {
    loading: "Yükleniyor…",
    saving: "Kaydediliyor…",
    saved: "Kaydedildi.",
    cancel: "Vazgeç",
    delete: "Sil",
    remove: "Kaldır",
    tryAgain: "Tekrar dene",
    starting: "Başlatılıyor…",
  },

  status: { UPLOADED: "Sırada", PROCESSING: "İşleniyor", DONE: "Hazır", FAILED: "Başarısız" },

  processing: {
    preprocessing: "Dosya hazırlanıyor",
    extracting: "Mektup okunuyor ve inceleniyor",
    translating: "Sonuçlar çevriliyor",
    saving: "Sonuçlar kaydediliyor",
    retrying: "Yapay zekâ servisi şu an yoğun, birazdan tekrar denenecek",
    processing: "İşleniyor…",
    queued: "Sırada bekliyor…",
  },

  upload: {
    title: "Resmî mektubunuzu anlayın",
    intro:
      "Finanzamt, Jobcenter, Ausländerbehörde veya başka bir kurumdan gelen mektubu yükleyin. " +
      "Size sade bir dille açıklayalım; ne yapmanız gerektiğini ve son tarihi söyleyelim.",
    drop: "Mektubu buraya bırakın veya dosya seçmek için tıklayın",
    hint: "PDF, JPG veya PNG · en fazla 10 MB",
    uploading: "Yükleniyor…",
    invalidType: "Yalnızca PDF, JPG ve PNG dosyaları destekleniyor.",
    tooLarge: "Dosya çok büyük (en fazla 10 MB).",
    disclaimer: "BriefKlar hukuki danışmanlık vermez. Önemli son tarihleri her zaman kendiniz de kontrol edin.",
  },

  documents: {
    title: "Mektuplarım",
    empty: "Henüz mektup yok.",
    uploadFirst: "İlk mektubunuzu yükleyin",
  },

  detail: {
    deletePermanently: "Kalıcı olarak sil",
    deleting: "Siliniyor…",
    noWorkerBefore: "Arka planda çalışan bir işlemci yok, bu yüzden mektup işlenemiyor. Uygulamayı şu komutla başlatın:",
    noWorkerAfter: "",
    originalLetter: "Orijinal mektup",
    failed: "İşlem başarısız oldu.",
    noAnalysis: "Bu mektup için bir analiz yok.",
  },

  analysis: {
    urgency: { LOW: "Acil değil", MEDIUM: "Bir şey yapmanız gerekiyor", HIGH: "Acil" },
    senderTypes: {
      FINANZAMT: "Vergi dairesi (Finanzamt)",
      JOBCENTER: "Jobcenter",
      AGENTUR_FUER_ARBEIT: "İş ajansı (Agentur für Arbeit)",
      AUSLAENDERBEHOERDE: "Yabancılar dairesi (Ausländerbehörde)",
      BUERGERAMT: "Vatandaşlık bürosu (Bürgeramt)",
      KRANKENKASSE: "Sağlık sigortası (Krankenkasse)",
      RUNDFUNKBEITRAG: "Yayın ücreti (Rundfunkbeitrag)",
      FAMILIENKASSE: "Aile yardımları kurumu (Familienkasse)",
      COURT: "Mahkeme",
      EMPLOYER: "İşveren",
      LANDLORD: "Ev sahibi",
      COMPANY: "Şirket",
      OTHER: "Diğer",
    },
    letterTypes: {
      BESCHEID: "Resmî karar (Bescheid)",
      MAHNUNG: "Ödeme hatırlatması (Mahnung)",
      AUFFORDERUNG: "Bir şey yapmanız isteniyor",
      TERMIN: "Randevu",
      KUENDIGUNG: "Sözleşmenin feshi (Kündigung)",
      INVOICE: "Fatura",
      INFO: "Bilgilendirme / onay",
      OTHER: "Diğer",
    },
    deadlineKinds: {
      PAYMENT: "Ödeme",
      RESPONSE: "Cevap",
      OBJECTION: "İtiraz (Widerspruch)",
      APPOINTMENT: "Randevu",
      DOCUMENTS: "Belge gönderme",
      OTHER: "Diğer",
    },
    fields: {
      summary: "özet",
      sender: "gönderen",
      letterType: "mektup türü",
      letterDate: "mektup tarihi",
      subject: "konu",
      references: "dosya ve referans numaraları",
      amounts: "tutarlar",
      deadlines: "son tarihler",
      requiredActions: "yapmanız gerekenler",
      requiredDocuments: "gönderilecek belgeler",
      objectionPossible: "itiraz hakkı",
      urgency: "aciliyet",
    },
    sections: {
      explained: "Sade dille açıklama",
      todo: "Yapmanız gerekenler",
      deadlines: "Son tarihler",
      amounts: "Tutarlar",
      documents: "Gönderilecek belgeler",
      references: "Dosya ve referans numaraları",
      reply: "Almanca cevap yazın",
      chat: "Bu mektup hakkında sorun",
    },
    notOfficial: "Bu resmî bir mektup gibi görünmüyor. Sonuçlar işinize yaramayabilir.",
    uncertain: (fields: string) =>
      `Lütfen kontrol edin: ${fields}. Mektubun bazı kısımları zor okunuyordu veya belirsizdi.`,
    nothingToDo: "Yapmanız gereken bir şey yok. Bu mektup bilgilendirme amaçlı.",
    estimated: "Tahmini",
    howCalculated: "Bu tarih nasıl hesaplandı?",
    undated: "tarih hesaplanamadı, lütfen mektuba bakın",
    objectionRight:
      "Bu karara itiraz etme hakkınız var (Widerspruch / Einspruch). Son tarihi mektupta kontrol edin.",
    footer: (model: string, version: string) =>
      `${model} (${version}) tarafından analiz edildi. BriefKlar hukuki danışmanlık vermez. ` +
      "Önemli bilgileri her zaman orijinal mektupta kontrol edin.",
    translating: (language: string) => `Analiz ${language} diline çevriliyor…`,
    translationFailed: "Analiz çevrilemedi, bu yüzden İngilizce gösteriliyor.",
  },

  deadlineSteps: {
    START_ASSUMED: () =>
      "Mektupta sürenin ne zaman başladığı yazmıyor, bu yüzden tebliğ gününde başladığı varsayıldı.",
    RECEIVED_ON: (date: string) => `Mektubu ${date} tarihinde aldınız.`,
    STARTS_ON_LETTER_DATE: (date: string) => `Süre, mektubun tarihiyle başlıyor: ${date}.`,
    DEEMED_DELIVERY: (days: number, letterDate: string, deliveryDate: string) =>
      `Bir kurumun postayla gönderdiği mektup, postaya verildikten sonraki ${days}. günde tebliğ edilmiş sayılır ` +
      `(§ 122 AO, § 41 VwVfG, § 37 SGB X). Mektubun, üzerindeki tarihte (${letterDate}) postaya verildiği ` +
      `varsayılırsa bu gün ${deliveryDate} olur.`,
    COUNTED_FROM_LETTER_DATE: (date: string) =>
      `Mektupta size ne zaman ulaştığı yazmıyor. Güvenli tarafta kalmak için süre mektubun tarihinden ` +
      `sayıldı: ${date}. Mektubu daha geç aldıysanız son tarihiniz de daha geç olabilir.`,
    YELLOW_ENVELOPE: () =>
      "Mektup sarı bir zarfla (Zustellung) geldiyse tebliğ tarihi zarfın üzerinde yazar.",
    DELIVERY_MOVED: (date: string, reason: string, movedTo: string) =>
      `${date} ${reason}, bu yüzden tebliğ günü bir sonraki iş gününe kayıyor: ${movedTo}.`,
    PERIOD_ENDS: (period: string, start: string, end: string) =>
      `${start} tarihinden itibaren ${period} süre ${end} tarihinde bitiyor (§§ 187, 188 BGB).`,
    DEADLINE_MOVED: (date: string, reason: string, movedTo: string) =>
      `${date} ${reason}, bu yüzden son tarih bir sonraki iş gününe kayıyor: ${movedTo} (§ 193 BGB).`,
    REGIONAL_HOLIDAY: (date: string, states: string) =>
      `${date} bazı eyaletlerde resmî tatil (${states}). ` +
      "Bu eyaletlerden birinde yaşıyorsanız son tarih bir sonraki iş günüdür.",
  },

  nonWorkingDay: {
    SATURDAY: "cumartesiye denk geliyor",
    SUNDAY: "pazara denk geliyor",
    holiday: (name: string) => `resmî tatile denk geliyor (${name})`,
  },

  // Only used as "2 haftalık süre"; nouns stay singular after a number
  period: (amount: number, unit) =>
    plural("tr", amount, {
      DAY: { other: "# günlük" },
      WEEK: { other: "# haftalık" },
      MONTH: { other: "# aylık" },
      YEAR: { other: "# yıllık" },
    }[unit]),

  holidays: {
    NEW_YEAR: "Yılbaşı",
    EPIPHANY: "Üç Kral Yortusu",
    WOMENS_DAY: "Dünya Kadınlar Günü",
    GOOD_FRIDAY: "Kutsal Cuma",
    EASTER_MONDAY: "Paskalya Pazartesisi",
    LABOUR_DAY: "Emek ve Dayanışma Günü",
    LIBERATION_DAY: "Kurtuluş Günü",
    ASCENSION_DAY: "İsa'nın Göğe Yükselişi",
    WHIT_MONDAY: "Pentekost Pazartesisi",
    CORPUS_CHRISTI: "Kutsal Beden Bayramı",
    ASSUMPTION_DAY: "Meryem'in Göğe Yükselişi",
    CHILDRENS_DAY: "Dünya Çocuk Günü",
    GERMAN_UNITY_DAY: "Alman Birliği Günü",
    REFORMATION_DAY: "Reform Günü",
    ALL_SAINTS_DAY: "Azizler Günü",
    REPENTANCE_DAY: "Tövbe ve Dua Günü",
    CHRISTMAS_DAY: "Noel",
    BOXING_DAY: "Noel'in ikinci günü",
  },

  explanation: {
    language: "Açıklamanın dili",
    explain: "Sade dille açıkla",
    reading: "Mektup okunuyor…",
    writing: "Yazılıyor…",
    writtenBy: (model: string) =>
      `${model} tarafından yazıldı. İsimleri, tutarları ve tarihleri orijinal mektupta kontrol edin.`,
  },

  receivedDate: {
    question: "Mektup ne zaman geldi?",
    use: "Bu tarihi kullan",
    hint:
      "Tebliğle başlayan süreler, tahmini bir tarih yerine bu günden itibaren sayılır. " +
      "Sarı zarfla (Zustellung) geldiyse zarfın üzerindeki tarihi girin.",
    noState: "Eyaletinizin resmî tatilleri henüz hesaba katılmıyor.",
    setState: "Eyaletinizi seçin",
  },

  replies: {
    types: {
      OBJECTION: "İtiraz (Widerspruch / Einspruch)",
      EXTENSION_REQUEST: "Ek süre isteme (Fristverlängerung)",
      SEND_DOCUMENTS: "Belgeler için ön yazı",
      INSTALLMENT_PLAN: "Taksitle ödeme isteme (Ratenzahlung)",
      QUESTION: "Soru sorma (Rückfrage)",
    },
    hints: {
      OBJECTION: "Neden katılmıyorsunuz? Boş bırakırsanız şimdi itiraz edip gerekçeleri sonra gönderirsiniz.",
      EXTENSION_REQUEST: "Neden ek süreye ihtiyacınız var ve ne zamana kadar?",
      SEND_DOCUMENTS: "Belgelerle ilgili eklemek istediğiniz bir şey var mı? (isteğe bağlı)",
      INSTALLMENT_PLAN: "Ayda ne kadar ödeyebilirsiniz ve neden bir seferde ödeyemiyorsunuz?",
      QUESTION: "Ne sormak istiyorsunuz?",
    },
    ownLanguage: "Kendi dilinizde yazabilirsiniz.",
    type: "Cevap türü",
    translationLanguage: "Çevirinin dili",
    translationOption: (language: string) => `Çeviri: ${language}`,
    notes: "Cevap için notlarınız",
    write: "Almanca taslak yaz",
    writing: "Taslak yazılıyor…",
    copy: "Almanca metni kopyala",
    copied: "Kopyalandı",
    deleteDraft: "Taslağı sil",
    letter: "Almanca cevap mektubu",
    save: "Değişiklikleri kaydet",
    undo: "Değişiklikleri geri al",
    whatItSays: (language: string) => `Ne yazıyor? (${language})`,
    warnings: {
      NO_OBJECTION_RIGHT: () =>
        "Mektupta itiraz hakkından söz edilmiyor. İtirazın mümkün olup olmadığını kontrol edin.",
      OBJECTION_DEADLINE_PASSED: (date: string) =>
        `İtiraz süresi (${date}) dolmuş olabilir. Hemen destek alın: süresi geçmiş itirazlar genellikle reddedilir.`,
      OBJECTION_DEADLINE: (date: string) =>
        `Mektup en geç ${date} tarihinde ulaşmış olmalı. İmzalayın ve gönderdiğinizi kanıtlayan bir belge saklayın ` +
        "(ör. Einwurf-Einschreiben veya faks raporu).",
      REQUEST_ONLY: () => "Bu bir rica: gönderen kabul edene kadar son tarih geçerliliğini korur.",
      FILL_PLACEHOLDERS: (placeholders: string) => `Göndermeden önce doldurun: ${placeholders}`,
    },
  },

  chat: {
    intro: "Bu mektupla ilgili her şeyi sorabilirsiniz. Asistan mektubun analizini okur, tarihleri son tarih hesaplayıcısıyla hesaplar ve resmî kaynaklara dayanan bir bilgi bankasında arama yapar. Bu bir hukuki danışmanlık değildir.",
    placeholder: "Sorunuz…",
    send: "Gönder",
    thinking: "Düşünüyor…",
    clear: "Yeni bir sohbet başlat",
    clearConfirm: "Bu sohbeti sil",
    toolsUsed: "Kullanılan araçlar",
    /** What each tool does, shown while the assistant uses it */
    tools: {
      get_letter_details: "Mektup bilgileri",
      search_knowledge_base: "Bilgi bankası",
      calculate_deadline: "Son tarih hesabı",
      check_date: "Takvim",
      list_public_holidays: "Resmî tatiller",
      list_reminders: "Hatırlatıcılar",
      create_reminder: "Yeni hatırlatıcı",
    },
    sources: "Kaynaklar",
    seeReminders: "Hatırlatıcılarınızı görün",
    answeredBy: (model) => `Cevaplayan: ${model}. Önemli bilgileri asıl mektuptan kontrol edin.`,
    suggestions: [
      "Ne yapmam gerekiyor ve ne zamana kadar?",
      "Hiçbir şey yapmazsam ne olur?",
      "Son tarihten iki gün önce bana hatırlat.",
    ],
  },

  reminders: {
    title: "Hatırlatıcılar",
    intro: "BriefKlar, mektuplarınızdaki her son tarihten üç gün önce size hatırlatır. Burada kendi hatırlatıcılarınızı ekleyebilir ya da bir mektubun sayfasındaki sohbetten isteyebilirsiniz.",
    due: "Zamanı geldi",
    upcoming: "Yaklaşanlar",
    empty: "Açık hatırlatıcı yok.",
    deadline: (kind, date) => `${kind}: son tarih ${date}`,
    remindOn: (date) => `Hatırlatma tarihi: ${date}`,
    markDone: "Tamamlandı",
    origins: { DEADLINE: "Otomatik", USER: "Sizin eklediğiniz", CHAT: "Sohbette kuruldu" },
    add: "Hatırlatıcı ekle",
    note: "Neyi hatırlatalım?",
    date: "Tarih",
    letter: "Mektup (isteğe bağlı)",
    noLetter: "Mektup yok",
    save: "Hatırlatıcıyı ekle",
  },

  settings: {
    title: "Ayarlar",
    state: "Eyalet (Bundesland)",
    stateHint:
      "Resmî tatile denk gelen son tarihler bir sonraki iş gününe kayar. Bazı tatiller yalnızca bazı " +
      "eyaletlerde geçerlidir, bu yüzden eyaletiniz son tarihi değiştirebilir. Seçmezseniz yalnızca tüm " +
      "Almanya'da geçerli tatiller hesaba katılır.",
    stateNotSet: "Seçilmedi (yalnızca ülke genelindeki tatiller)",
    language: "Diliniz",
    languageHint:
      "BriefKlar bu dilde gösterilir: sayfalar, mektuplarınızın analizi, açıklamalar ve cevap " +
      "taslaklarının çevirileri.",
  },

  errors: {
    NOT_FOUND: "Bu sayfa veya kayıt bulunamadı.",
    NOT_AUTHENTICATED: "Giriş yapmadınız.",
    INVALID_BODY: "İstek geçerli değildi.",
    INVALID_PARAM: "İstek geçerli değildi.",
    INVALID_LANGUAGE: "Bu dil desteklenmiyor.",
    INTERNAL: "Bizim tarafımızda bir hata oluştu. Lütfen tekrar deneyin.",
    NO_FILE: "Dosya yüklenmedi.",
    UNSUPPORTED_TYPE: "Yalnızca PDF, JPG ve PNG dosyaları destekleniyor.",
    LIMIT_FILE_SIZE: "Dosya çok büyük (en fazla 10 MB).",
    DOCUMENT_NOT_FOUND: "Bu mektup bulunamadı.",
    ACTION_ITEM_NOT_FOUND: "Bu görev bulunamadı.",
    DRAFT_NOT_FOUND: "Bu taslak bulunamadı.",
    ALREADY_PROCESSING: "Bu mektup şu an işleniyor. Birazdan tekrar deneyin.",
    NOT_ANALYZED: "Bu mektup henüz analiz edilmedi.",
    INVALID_DATE: "Böyle bir tarih yok.",
    DATE_IN_FUTURE: "Teslim tarihi gelecekte olamaz.",
    DATE_BEFORE_LETTER: "Mektup, üzerindeki tarihten önce gelmiş olamaz.",
    REMINDER_NOT_FOUND: "Bu hatırlatıcı bulunamadı.",
    DATE_IN_PAST: "Bu tarih geçmişte kalıyor.",
    AI_RATE_LIMITED: "Yapay zekâ servisine şu an çok fazla istek geliyor. Lütfen birkaç dakika sonra tekrar deneyin.",
    AI_OVERLOADED: "Yapay zekâ servisi şu an aşırı yoğun. Lütfen birkaç dakika sonra tekrar deneyin.",
    AI_KEY_REJECTED: "Yapay zekâ servisi API anahtarını reddetti. GEMINI_API_KEY ayarını kontrol edin.",
    AI_MODEL_NOT_FOUND: "Ayarlanan yapay zekâ modeli bulunamadı. GEMINI_MODEL ayarını kontrol edin.",
    AI_FAILED: "Yapay zekâ servisi bu isteği işleyemedi.",
    AI_INCOMPLETE: "Yapay zekâ eksik bir cevap verdi. Lütfen tekrar deneyin.",
    PROCESSING_FAILED: "Mektup işlenirken bir hata oluştu.",
    connectionLost: "Bağlantı koptu. Lütfen tekrar deneyin.",
    requestFailed: "İstek başarısız oldu. Lütfen tekrar deneyin.",
  },
};
