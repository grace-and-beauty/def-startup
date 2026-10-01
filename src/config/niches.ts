/**
 * Niche templates (PRD §4). One product for every niche: a niche is a preset
 * for the onboarding wizard + the content of its landing page /dlya/[niche].
 *
 * Texts here are template CONTENT (copied into the business' program on
 * onboarding and editable by the owner), so they live in config, not in the
 * UI dictionary.
 */

export const NICHE_SLUGS = [
  "avtomyika",
  "barbershop",
  "kavyarnia",
  "manikur",
  "gruming",
  "avtoservis",
  "pekarnia",
  "kvitkovyi",
] as const;

export type NicheSlug = (typeof NICHE_SLUGS)[number];

export interface NicheColors {
  bg: string;
  fg: string;
  label: string;
}

export interface NicheLanding {
  /** H1 of /dlya/[niche]. */
  headline: string;
  subheadline: string;
  /** Pains of this niche the product solves. */
  pains: string[];
  /** Example customer name shown on the sample card. */
  sampleCustomerName: string;
}

export interface Niche {
  slug: NicheSlug;
  /** Short name for tiles and selects. */
  name: string;
  /** Example business name for previews. */
  sampleBusinessName: string;
  /** What one stamp is for, e.g. «мийка». */
  unit: string;
  stampsRequired: number;
  rewardText: string;
  termsText: string;
  /** null = reminders are not offered by default. */
  reminderDays: number | null;
  reminderText: string | null;
  colors: NicheColors;
  landing: NicheLanding;
  /** Order of focus (lower = earlier). */
  priority: number;
}

export const NICHES: Record<NicheSlug, Niche> = {
  avtomyika: {
    slug: "avtomyika",
    name: "Автомийка",
    sampleBusinessName: "Автомийка «Блиск»",
    unit: "мийка",
    stampsRequired: 6,
    rewardText: "6-та мийка безкоштовно",
    termsText: "Один штамп за одну мийку кузова.",
    reminderDays: 14,
    reminderText: "Час помити авто! Чекаємо на вас — ваша картка вже тут.",
    colors: { bg: "#0f172a", fg: "#ffffff", label: "#94a3b8" },
    landing: {
      headline: "Картка лояльності для автомийки — у телефоні клієнта",
      subheadline: "Клієнти повертаються частіше, а ви бачите, хто перестав приїжджати.",
      pains: [
        "Паперові картки губляться в бардачку",
        "Взимку клієнти їдуть туди, де ближче",
        "Не знаєте, скільки у вас постійних клієнтів",
      ],
      sampleCustomerName: "Олександр",
    },
    priority: 1,
  },
  barbershop: {
    slug: "barbershop",
    name: "Барбершоп",
    sampleBusinessName: "Barber «Лезо»",
    unit: "стрижка",
    stampsRequired: 8,
    rewardText: "8-ма стрижка безкоштовно",
    termsText: "Один штамп за одну стрижку.",
    reminderDays: 28,
    reminderText: "Пора підстригтися? Записуйтесь — майстер чекає.",
    colors: { bg: "#1c1917", fg: "#fafaf9", label: "#a8a29e" },
    landing: {
      headline: "Картка лояльності для барбершопу",
      subheadline: "Автонагадування «пора підстригтися» повертають клієнтів без реклами.",
      pains: [
        "Клієнт забуває записатися і йде до іншого майстра",
        "Немає безкоштовного каналу зв'язку з клієнтами",
        "Не видно, хто з майстрів утримує клієнтів",
      ],
      sampleCustomerName: "Максим",
    },
    priority: 2,
  },
  kavyarnia: {
    slug: "kavyarnia",
    name: "Кав'ярня",
    sampleBusinessName: "Кав'ярня «Зерно»",
    unit: "кава",
    stampsRequired: 7,
    rewardText: "7-ма кава в подарунок",
    termsText: "Один штамп за один напій.",
    reminderDays: 7,
    reminderText: "Сумуємо за вами! Ваша кава чекає.",
    colors: { bg: "#3f2a1e", fg: "#fff7ed", label: "#d6bfa8" },
    landing: {
      headline: "Картка «кожна 7-ма кава в подарунок» без паперу",
      subheadline: "Штамп за 5 секунд, а картка завжди в телефоні гостя.",
      pains: [
        "Паперові картки забувають удома",
        "Гості не знають про нові напої та акції",
        "Незрозуміло, скільки гостей повертаються",
      ],
      sampleCustomerName: "Юлія",
    },
    priority: 8,
  },
  manikur: {
    slug: "manikur",
    name: "Манікюр / салон краси",
    sampleBusinessName: "Студія «Нюанс»",
    unit: "візит",
    stampsRequired: 6,
    rewardText: "Знижка 50% на 6-й візит",
    termsText: "Один штамп за одну процедуру.",
    reminderDays: 21,
    reminderText: "Час оновити манікюр! Записуйтесь на зручний час.",
    colors: { bg: "#4a1d3f", fg: "#fdf2f8", label: "#f0abfc" },
    landing: {
      headline: "Картка лояльності для салону краси",
      subheadline: "Клієнтки повертаються вчасно — завдяки нагадуванням на екрані телефону.",
      pains: [
        "Клієнтки «губляться» між корекціями",
        "Instagram бачать не всі",
        "Не видно, скільки клієнток повертаються",
      ],
      sampleCustomerName: "Олена",
    },
    priority: 3,
  },
  gruming: {
    slug: "gruming",
    name: "Грумінг",
    sampleBusinessName: "Грумінг «Хвостик»",
    unit: "візит",
    stampsRequired: 6,
    rewardText: "6-й грумінг зі знижкою 50%",
    termsText: "Один штамп за одну процедуру.",
    reminderDays: 42,
    reminderText: "Вашому улюбленцю час до грумера! Чекаємо.",
    colors: { bg: "#134e4a", fg: "#f0fdfa", label: "#99f6e4" },
    landing: {
      headline: "Картка лояльності для грумінг-салону",
      subheadline: "Нагадування власникам тварин — у потрібний час, без дзвінків.",
      pains: [
        "Власники забувають про регулярний догляд",
        "Дзвонити кожному — довго",
        "Немає даних про постійних клієнтів",
      ],
      sampleCustomerName: "Анна",
    },
    priority: 4,
  },
  avtoservis: {
    slug: "avtoservis",
    name: "Автосервіс",
    sampleBusinessName: "СТО «Механік»",
    unit: "візит",
    stampsRequired: 5,
    rewardText: "5-та заміна оливи — робота безкоштовно",
    termsText: "Один штамп за одне обслуговування.",
    reminderDays: 120,
    reminderText: "Час планового ТО! Запишіться — зробимо швидко.",
    colors: { bg: "#1e293b", fg: "#f8fafc", label: "#fbbf24" },
    landing: {
      headline: "Картка лояльності для автосервісу",
      subheadline: "Нагадування про ТО повертають клієнтів саме до вас.",
      pains: [
        "Клієнт забуває про планове ТО",
        "Після гарантії клієнти йдуть до інших",
        "Немає простого каналу нагадувань",
      ],
      sampleCustomerName: "Дмитро",
    },
    priority: 5,
  },
  pekarnia: {
    slug: "pekarnia",
    name: "Пекарня",
    sampleBusinessName: "Пекарня «Колосок»",
    unit: "покупка",
    stampsRequired: 10,
    rewardText: "10-та випічка в подарунок",
    termsText: "Один штамп за покупку від 100 грн.",
    reminderDays: null,
    reminderText: null,
    colors: { bg: "#78350f", fg: "#fffbeb", label: "#fcd34d" },
    landing: {
      headline: "Картка лояльності для пекарні",
      subheadline: "Постійні покупці отримують подарунок, ви — більше повторних покупок.",
      pains: [
        "Покупці заходять «по дорозі» і не повертаються",
        "Немає способу повідомити про свіжу випічку",
        "Невідомо, скільки покупців постійні",
      ],
      sampleCustomerName: "Ірина",
    },
    priority: 6,
  },
  kvitkovyi: {
    slug: "kvitkovyi",
    name: "Квітковий магазин",
    sampleBusinessName: "Квіти «Півонія»",
    unit: "букет",
    stampsRequired: 5,
    rewardText: "5-й букет зі знижкою 30%",
    termsText: "Один штамп за покупку букета.",
    reminderDays: null,
    reminderText: null,
    colors: { bg: "#14532d", fg: "#f0fdf4", label: "#86efac" },
    landing: {
      headline: "Картка лояльності для квіткового магазину",
      subheadline: "Розсилки перед святами — прямо на екран телефону клієнта.",
      pains: [
        "Покупці приходять лише на свята",
        "Реклама перед 8 Березня коштує дорого",
        "Немає бази постійних клієнтів",
      ],
      sampleCustomerName: "Наталія",
    },
    priority: 7,
  },
};

export function isNicheSlug(value: string): value is NicheSlug {
  return (NICHE_SLUGS as readonly string[]).includes(value);
}

export function getNiche(slug: string): Niche | undefined {
  return isNicheSlug(slug) ? NICHES[slug] : undefined;
}

/** Niches in order of focus (PRD §4). */
export function listNiches(): Niche[] {
  return NICHE_SLUGS.map((slug) => NICHES[slug]).sort((a, b) => a.priority - b.priority);
}
