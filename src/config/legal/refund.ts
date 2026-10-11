import { brand } from "@/config/brand";
import { TRIAL_DAYS } from "@/config/plans";

import type { LegalDocument, LegalLocale } from "./types";

/** Money-back window, days from the payment. Paddle requires at least 14. */
export const REFUND_WINDOW_DAYS = 14;

export const refund: Record<LegalLocale, LegalDocument> = {
  uk: {
    title: "Політика повернення коштів",
    summary: `Коли і як повернути гроші за підписку ${brand.name}.`,
    sections: [
      {
        heading: "1. Спершу — безкоштовно",
        blocks: [
          `Кожен новий заклад отримує ${TRIAL_DAYS} днів тарифу «Плюс» безкоштовно, без прив'язки картки. Радимо спробувати сервіс до оплати.`,
        ],
      },
      {
        heading: `2. Гарантія повернення ${REFUND_WINDOW_DAYS} днів`,
        blocks: [
          `Якщо сервіс вам не підійшов, ми повернемо повну суму будь-якого платежу за підписку, якщо ви попросите про це протягом ${REFUND_WINDOW_DAYS} днів від дати платежу. Пояснювати причину не обов'язково.`,
          "Також повертаємо гроші, якщо:",
          [
            "з вас помилково списали кошти двічі або після скасування підписки;",
            "через наш технічний збій сервіс був недоступний значну частину оплаченого періоду;",
            "ми суттєво погіршили оплачений тариф — тоді повертаємо пропорційну частину за невикористаний період.",
          ],
        ],
      },
      {
        heading: "3. Як попросити повернення",
        blocks: [
          [
            `напишіть на ${brand.supportEmail} з тієї пошти, з якої входите в кабінет, і вкажіть назву закладу;`,
            "або зверніться напряму до Paddle — нашого продавця (Merchant of Record) — за посиланням у листі-квитанції чи на paddle.net.",
          ],
          "Ми відповідаємо протягом 2 робочих днів. Повернення робить Paddle на ту саму картку чи рахунок, з якого була оплата; гроші зазвичай надходять за 5–10 робочих днів залежно від банку.",
        ],
      },
      {
        heading: `4. Після ${REFUND_WINDOW_DAYS} днів`,
        blocks: [
          "Ви можете будь-коли скасувати підписку: наступних списань не буде, а тариф діє до кінця вже оплаченого місяця. За частину поточного місяця, що лишилася, гроші не повертаються — крім випадків з розділу 2 і випадків, коли повернення вимагає закон.",
        ],
      },
      {
        heading: "5. Ваші права споживача",
        blocks: [
          "Ця політика не обмежує прав, які вам надає законодавство країни, де ви живете.",
        ],
      },
    ],
  },
  en: {
    title: "Refund Policy",
    summary: `When and how to get your money back for a ${brand.name} subscription.`,
    sections: [
      {
        heading: "1. Try it free first",
        blocks: [
          `Every new business gets ${TRIAL_DAYS} days of the Plus plan for free, no card required. We recommend trying the service before you pay.`,
        ],
      },
      {
        heading: `2. ${REFUND_WINDOW_DAYS}-day money-back guarantee`,
        blocks: [
          `If the service is not right for you, we will refund any subscription payment in full if you ask within ${REFUND_WINDOW_DAYS} days of the payment date. No reason needed.`,
          "We also refund you if:",
          [
            "you were charged twice by mistake or after cancelling;",
            "the service was unavailable for a significant part of the paid period because of our technical failure;",
            "we materially reduced a plan you paid for — then we refund the unused part of the period pro rata.",
          ],
        ],
      },
      {
        heading: "3. How to request a refund",
        blocks: [
          [
            `email ${brand.supportEmail} from the address you use to sign in and include your business name;`,
            "or contact Paddle, our Merchant of Record, directly via the link in your receipt email or at paddle.net.",
          ],
          "We reply within 2 business days. Paddle issues the refund to the card or account you paid with; it usually arrives within 5–10 business days depending on your bank.",
        ],
      },
      {
        heading: `4. After ${REFUND_WINDOW_DAYS} days`,
        blocks: [
          "You can cancel your subscription at any time: no further charges will be made and your plan stays active until the end of the month you already paid for. The remaining part of the current month is not refunded, except in the cases in section 2 or where the law requires a refund.",
        ],
      },
      {
        heading: "5. Your consumer rights",
        blocks: [
          "This policy does not limit any rights you have under the consumer laws of your country.",
        ],
      },
    ],
  },
};
