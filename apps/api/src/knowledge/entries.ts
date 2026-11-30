/**
 * Curated knowledge base for the chat: German terms and procedures around official letters,
 * each with an official source. Written in plain English; the embedding model is multilingual,
 * so questions in Turkish, Arabic, Ukrainian, Russian or German find these entries too.
 *
 * After changing this file, run `npm run knowledge:seed -w @briefklar/api`. Only entries whose
 * text changed are embedded again.
 *
 * The entries describe general rules. The letter itself (its Rechtsbehelfsbelehrung) and
 * special rules in a federal state can differ, and the chat says so.
 */

export interface KnowledgeSeed {
  /** Stable key; renaming it creates a new entry */
  slug: string;
  title: string;
  content: string;
  /** Official source, preferably the law on gesetze-im-internet.de */
  sourceUrl: string;
}

const law = (code: string, section: string) => `https://www.gesetze-im-internet.de/${code}/__${section}.html`;

export const KNOWLEDGE_ENTRIES: KnowledgeSeed[] = [
  {
    slug: "bescheid",
    title: "What a Bescheid is",
    content:
      "A Bescheid is an official decision by an authority on an individual case, legally an administrative act " +
      "(Verwaltungsakt). Examples are a tax assessment (Steuerbescheid), a decision on Bürgergeld, a fee or a " +
      "refusal. It takes effect when it is delivered (Bekanntgabe). At the end it usually contains a " +
      "Rechtsbehelfsbelehrung: instructions on how, where and by when you can challenge it. If nobody challenges " +
      "it in time, it becomes final (bestandskräftig) and is hard to change later.",
    sourceUrl: law("vwvfg", "35"),
  },
  {
    slug: "widerspruch",
    title: "Widerspruch: objecting to a decision of an authority",
    content:
      "Against most decisions of authorities (for example Jobcenter, Agentur für Arbeit, Krankenkasse, " +
      "Elterngeldstelle, Rundfunkbeitrag) you can file a Widerspruch. The deadline is one month after the decision " +
      "was delivered (§ 70 VwGO, § 84 SGG for social benefits). It must be in writing and signed, or recorded at " +
      "the authority (zur Niederschrift); it goes to the authority that issued the decision. Reasons are not " +
      "required at first: you can object now and send the reasons later. Some federal states have abolished the " +
      "Widerspruch for some areas; then you must go to court directly. The Rechtsbehelfsbelehrung in the letter " +
      "says which applies. Against tax and child benefit decisions the remedy is called Einspruch instead.",
    sourceUrl: law("vwgo", "70"),
  },
  {
    slug: "einspruch-finanzamt",
    title: "Einspruch against the Finanzamt or Familienkasse",
    content:
      "Decisions of the tax office (Finanzamt) and of the Familienkasse about child benefit (Kindergeld) are " +
      "challenged with an Einspruch, not a Widerspruch (§ 347 AO). The deadline is one month after the decision " +
      "was delivered (§ 355 AO). The Einspruch must be in writing or electronic, for example through ELSTER " +
      "(§ 357 AO). It should name the decision (tax number, date); reasons can follow later. The authority checks " +
      "the whole case again and could in rare cases change it to your disadvantage, but it must warn you first " +
      "so you can withdraw the Einspruch.",
    sourceUrl: law("ao_1977", "355"),
  },
  {
    slug: "objection-and-payment",
    title: "Does an objection stop a payment demand?",
    content:
      "Usually a Widerspruch has suspensive effect (aufschiebende Wirkung): the decision cannot be enforced while " +
      "the objection is pending (§ 80 VwGO). There are important exceptions: demands for public charges and costs " +
      "such as taxes, fees and contributions must still be paid, and many Jobcenter decisions under SGB II (for " +
      "example ending or reducing Bürgergeld) take effect anyway (§ 39 SGB II). For taxes the Einspruch does not " +
      "stop payment either; you can ask the Finanzamt for Aussetzung der Vollziehung (suspension of enforcement, " +
      "§ 361 AO). If in doubt, pay or ask for suspension or deferral before the due date.",
    sourceUrl: law("vwgo", "80"),
  },
  {
    slug: "bekanntgabe",
    title: "When a letter from an authority counts as delivered (Bekanntgabe)",
    content:
      "A decision an authority sends by ordinary post counts as delivered on the fourth day after it was posted " +
      "(Bekanntgabefiktion; three days for letters posted before 2025). This is set in § 122 (2) AO for taxes, " +
      "§ 41 (2) VwVfG for general administration and § 37 (2) SGB X for social benefits. Deadlines such as the " +
      "one-month objection period start from this day. If the fourth day is a weekend or public holiday, courts " +
      "move it to the next working day. If the letter really arrived later, it counts from the real day, but in " +
      "case of doubt the authority must prove when it arrived. Note the day the letter arrived and keep the envelope.",
    sourceUrl: law("ao_1977", "122"),
  },
  {
    slug: "counting-deadlines",
    title: "How deadlines are counted (§§ 187-193 BGB)",
    content:
      "The day on which the period starts (for example the day of delivery) is not counted (§ 187 BGB). A period " +
      "in weeks ends on the same weekday, a period in months on the same day number of the later month; if that " +
      "month is shorter, on its last day (§ 188 BGB). Example: delivered on 31 January, one month ends on 28 or 29 " +
      "February. If the last day is a Saturday, Sunday or public holiday at the place where the act must be done, " +
      "the deadline ends on the next working day (§ 193 BGB). Authorities apply the same rules (§ 31 VwVfG, " +
      "§ 108 AO, § 26 SGB X). The document must arrive by the end of the last day, not just be posted.",
    sourceUrl: law("bgb", "187"),
  },
  {
    slug: "zustellung-yellow-envelope",
    title: "Formal delivery in a yellow envelope (Zustellung)",
    content:
      "Important letters from courts and authorities are often delivered formally with a Postzustellungsurkunde. " +
      "They come in a yellow envelope. The postal worker writes the date of delivery on the envelope; this date " +
      "counts as the day of delivery, even if the letter was only put into your mailbox or left at the post office " +
      "because you were not at home (§ 3 VwZG with §§ 177-182 ZPO). Deadlines start on that day, not when you " +
      "opened it. Always keep the yellow envelope with the letter.",
    sourceUrl: law("vwzg_2005", "3"),
  },
  {
    slug: "missing-rechtsbehelfsbelehrung",
    title: "When the instructions on how to object are missing or wrong",
    content:
      "A decision should explain how, where and within which period it can be challenged (Rechtsbehelfsbelehrung). " +
      "If these instructions are missing or wrong, the short deadline does not start. Instead, an objection or " +
      "lawsuit is usually possible within one year after delivery (§ 58 (2) VwGO, § 66 (2) SGG, § 356 (2) AO). " +
      "Do not rely on this without advice: it is better to object within the normal month whenever possible.",
    sourceUrl: law("vwgo", "58"),
  },
  {
    slug: "wiedereinsetzung",
    title: "Missed a deadline without fault (Wiedereinsetzung)",
    content:
      "If you missed a statutory deadline through no fault of your own (for example a serious illness or a longer " +
      "stay abroad without a way to get your post), you can apply for Wiedereinsetzung in den vorigen Stand. The " +
      "application is due within two weeks after the obstacle ended (§ 32 VwVfG, § 27 SGB X, § 60 VwGO), in tax " +
      "matters within one month (§ 110 AO). You must explain and prove why you could not act in time, and at the " +
      "same time do what you missed, for example file the Widerspruch. After one year it is usually no longer " +
      "possible. Simply forgetting or being busy is not enough.",
    sourceUrl: law("vwvfg", "32"),
  },
  {
    slug: "anhoerung",
    title: "Anhörung: a chance to comment before a decision",
    content:
      "Before an authority makes a decision that affects your rights, for example asking back money or ending a " +
      "benefit, it usually has to give you the chance to comment (Anhörung, § 28 VwVfG, § 24 SGB X, § 91 AO). The " +
      "letter often says 'Anhörung' and sets a date for your answer. It is not the decision yet, so you cannot " +
      "object to it, but answering is worth it: explain your side, correct wrong facts and send evidence. If you do " +
      "not answer, the authority decides on the facts it has.",
    sourceUrl: law("sgb_10", "24"),
  },
  {
    slug: "mitwirkungspflichten",
    title: "Duty to cooperate when receiving social benefits (Mitwirkung)",
    content:
      "People who apply for or receive social benefits (Bürgergeld, Wohngeld, Kindergeld, Elterngeld and others) " +
      "must state all relevant facts, report changes such as a new job or a move without delay, and provide " +
      "requested documents (§ 60 SGB I). If you do not cooperate, the authority can refuse or stop the benefit " +
      "until you do (§ 66 SGB I). It may only do so after warning you in writing and giving you a reasonable " +
      "deadline. If you cannot get a document in time, tell the authority before the deadline and ask for more time.",
    sourceUrl: law("sgb_1", "60"),
  },
  {
    slug: "fristverlaengerung",
    title: "Asking for more time (Fristverlängerung)",
    content:
      "Deadlines that an authority sets itself, for example to send documents or to answer an Anhörung, can be " +
      "extended on request (§ 31 (7) VwVfG, § 109 AO). Ask in writing before the deadline ends, give a reason and " +
      "name a new date. The original deadline stays in force until the authority agrees. Deadlines set by law, " +
      "such as the one-month period for a Widerspruch or Einspruch, cannot be extended. In that case file the " +
      "objection in time and send the reasons later.",
    sourceUrl: law("vwvfg", "31"),
  },
  {
    slug: "stundung-ratenzahlung",
    title: "Paying later or in instalments (Stundung, Ratenzahlung)",
    content:
      "If you cannot pay a tax or other claim of an authority at once, you can ask to defer it (Stundung) or to pay " +
      "in instalments (Ratenzahlung) before it is due. The Finanzamt can grant a Stundung if immediate payment would " +
      "be a considerable hardship and the claim does not seem at risk (§ 222 AO); interest may be charged " +
      "(§ 234 AO). Explain your income and costs and suggest a realistic monthly amount. Jobcenter, " +
      "Familienkasse and the Rundfunkbeitrag service also accept instalment requests for repayments.",
    sourceUrl: law("ao_1977", "222"),
  },
  {
    slug: "saeumniszuschlag",
    title: "Late payment surcharge on taxes (Säumniszuschlag)",
    content:
      "If a tax is not paid by its due date, the Finanzamt charges a late payment surcharge (Säumniszuschlag) of " +
      "1 percent of the unpaid tax, rounded down to a multiple of 50 euros, for each started month (§ 240 AO). For " +
      "bank transfers there is a grace period of three days (Schonfrist), but not for cash or cheques. A deferral " +
      "(Stundung) or suspension of enforcement agreed before the due date avoids the surcharge.",
    sourceUrl: law("ao_1977", "240"),
  },
  {
    slug: "mahnbescheid",
    title: "Court payment order (Mahnbescheid)",
    content:
      "A Mahnbescheid is issued by a court (the central dunning court of the federal state) at the request of a " +
      "creditor, usually in a yellow envelope. The court does not check whether the claim is justified. You can " +
      "object with a Widerspruch within two weeks of delivery, using the form enclosed with it (§§ 692, 694 ZPO); " +
      "no reasons are needed. Then the creditor has to go to court in a normal procedure. If you do nothing, the " +
      "creditor can apply for a Vollstreckungsbescheid, which allows enforcement. If you only dispute part of the " +
      "claim, you can object to that part.",
    sourceUrl: law("zpo", "692"),
  },
  {
    slug: "vollstreckungsbescheid",
    title: "Enforcement order (Vollstreckungsbescheid)",
    content:
      "A Vollstreckungsbescheid follows a Mahnbescheid that was not objected to. It works like a judgment: the " +
      "creditor can use it to enforce the claim, for example with a bailiff (Gerichtsvollzieher) or by seizing a " +
      "bank account. You can file an Einspruch within two weeks of delivery (§§ 700, 339 ZPO). This deadline is a " +
      "Notfrist and cannot be extended. After an Einspruch the case goes to a normal court procedure. Get advice " +
      "quickly if you receive one.",
    sourceUrl: law("zpo", "700"),
  },
  {
    slug: "mahnung-company",
    title: "A reminder (Mahnung) from a company",
    content:
      "A Mahnung from a company, landlord or collection agency (Inkasso) is not a court decision: it is a demand " +
      "for payment. First check whether you really owe the amount. If you pay late, you can be in default " +
      "(Verzug) after a reminder, or 30 days after an invoice if the invoice pointed this out (§ 286 BGB); then " +
      "the creditor can charge default interest (5 percentage points above the base rate for consumers, § 288 BGB) " +
      "and reasonable costs. If you dispute the claim, say so in writing. Ignoring it can lead to a court " +
      "Mahnbescheid.",
    sourceUrl: law("bgb", "286"),
  },
  {
    slug: "kuendigung-job",
    title: "Dismissal by the employer (Kündigung)",
    content:
      "If you want to challenge a dismissal by your employer, you must file a claim at the labour court " +
      "(Kündigungsschutzklage) within three weeks after you received the written notice (§ 4 KSchG); otherwise the " +
      "dismissal counts as valid (§ 7 KSchG). A dismissal must be in writing and signed; e-mail or text messages " +
      "are not enough (§ 623 BGB). You must also register as looking for work with the Agentur für Arbeit within " +
      "three days of learning about the end of the job, or at least three months before it ends (§ 38 SGB III); " +
      "registering late can lead to a block on unemployment benefit.",
    sourceUrl: law("kschg", "4"),
  },
  {
    slug: "kuendigung-tenancy",
    title: "Ending a tenancy (Kündigung of a flat)",
    content:
      "A termination of a residential tenancy must be in writing with a handwritten signature (§ 568 BGB). A " +
      "tenant can end an open-ended tenancy with three months' notice (§ 573c BGB). A landlord needs a legitimate " +
      "interest, such as own use or serious breaches of the contract (§ 573 BGB), and the notice period grows to " +
      "six months after five years and nine months after eight years. A tenant can object to a landlord's " +
      "termination because of hardship (§ 574 BGB), in writing at the latest two months before the tenancy ends. " +
      "Tenant associations (Mieterverein) give advice.",
    sourceUrl: law("bgb", "573c"),
  },
  {
    slug: "rundfunkbeitrag",
    title: "Broadcasting fee (Rundfunkbeitrag)",
    content:
      "The Rundfunkbeitrag is charged per household (Wohnung), not per person or device; one adult in the flat pays " +
      "for everyone. People receiving certain benefits, for example Bürgergeld, Sozialhilfe, BAföG when not living " +
      "with their parents, or with certain disabilities, can be exempted or pay a reduced fee on request, with " +
      "proof (§ 4 Rundfunkbeitragsstaatsvertrag). Exemptions are not automatic. Unpaid fees lead to a " +
      "Festsetzungsbescheid, against which a Widerspruch is possible within one month.",
    sourceUrl: "https://www.rundfunkbeitrag.de/",
  },
  {
    slug: "fiktionsbescheinigung",
    title: "Residence permit running out (Fiktionsbescheinigung)",
    content:
      "If you apply to extend your residence permit before it expires, the old permit continues to apply until the " +
      "Ausländerbehörde decides (Fortgeltungsfiktion, § 81 (4) AufenthG). The authority issues a " +
      "Fiktionsbescheinigung as proof, which you can show to employers and other offices. Applying after the " +
      "permit has expired does not have this effect, so apply in time, ideally several weeks before, and keep proof " +
      "of the date you applied.",
    sourceUrl: law("aufenthg_2004", "81"),
  },
  {
    slug: "buergergeld-period",
    title: "Bürgergeld: approval period and continued payment",
    content:
      "Bürgergeld is usually approved for twelve months (§ 41 SGB II). To keep receiving it, you must apply for " +
      "continued payment (Weiterbewilligungsantrag) before the approval period ends; the Jobcenter usually sends " +
      "the form. Changes in income, rent or household must be reported at once. Decisions can be checked again " +
      "later with an Überprüfungsantrag.",
    sourceUrl: law("sgb_2", "41"),
  },
  {
    slug: "ueberpruefungsantrag",
    title: "Reviewing a final decision on social benefits (Überprüfungsantrag)",
    content:
      "Even after the objection period has passed, you can ask the authority to review a decision on social " +
      "benefits if the law was applied wrongly or the facts were wrong (Überprüfungsantrag, § 44 SGB X). If the " +
      "review succeeds, benefits are paid back for up to four years; for Bürgergeld only for one year (§ 40 SGB II). " +
      "There is no form requirement, but a written application with the date of the decision is best.",
    sourceUrl: law("sgb_10", "44"),
  },
  {
    slug: "sending-with-proof",
    title: "How to send an objection with proof",
    content:
      "You must be able to prove that your letter arrived in time. Good ways are delivering it in person and " +
      "having a copy stamped with the date of receipt, a fax with a transmission report, or an Einwurf-Einschreiben " +
      "(registered mail with a record of delivery to the mailbox). An ordinary e-mail is usually not enough for a " +
      "Widerspruch; electronic routes the authority offers (for example ELSTER or the Jobcenter's " +
      "jobcenter.digital) are (§ 3a VwVfG). Always sign the letter and keep a copy.",
    sourceUrl: law("vwvfg", "3a"),
  },
  {
    slug: "beratungshilfe",
    title: "Free or cheap legal advice (Beratungshilfe)",
    content:
      "People with low income can get a Beratungshilfeschein from the local court (Amtsgericht). With it, a lawyer " +
      "advises and, if needed, represents you towards an authority for a fee of at most 15 euros " +
      "(Beratungshilfegesetz). Bring proof of income and the letter. Free advice is also offered by consumer " +
      "advice centres (Verbraucherzentrale), social counselling services, migration advice centres (MBE, JMD), " +
      "tenant associations and trade unions for their members.",
    sourceUrl: law("beratungshilfeg", "1"),
  },
];
