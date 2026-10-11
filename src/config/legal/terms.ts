import { brand } from "@/config/brand";
import { CANCELED_GRACE_DAYS, PLANS, TRIAL_DAYS } from "@/config/plans";

import type { LegalDocument, LegalLocale } from "./types";

const site = `https://${brand.domain}`;

export const terms: Record<LegalLocale, LegalDocument> = {
  uk: {
    title: "Умови використання",
    summary: `Правила користування сервісом ${brand.name} для закладів.`,
    sections: [
      {
        heading: "1. Про сервіс",
        blocks: [
          `${brand.name} (${site}) — онлайн-сервіс, за допомогою якого заклади (барбершопи, кав'ярні, салони тощо) ведуть електронні картки лояльності: видають клієнтам картки зі штампами, ставлять штампи через сканер, надсилають клієнтам повідомлення й дивляться статистику.`,
          `Сервіс надає ${brand.legalName.uk} (${brand.country.uk}), далі — «ми». Зв'язок: ${brand.supportEmail}.`,
          "Ці умови — договір між нами і власником закладу, який зареєструвався в сервісі (далі — «ви»). Реєструючись або користуючись сервісом, ви погоджуєтеся з цими умовами.",
        ],
      },
      {
        heading: "2. Обліковий запис",
        blocks: [
          [
            "Вхід — за кодом, який ми надсилаємо на вашу електронну пошту. Не передавайте код іншим.",
            "Ви відповідаєте за дії в кабінеті та сканері, зокрема за дії працівників, яким ви дали PIN-код.",
            "Вказуйте правдиві дані про заклад. Ви маєте бути повнолітнім і мати право укладати договір від імені закладу.",
          ],
        ],
      },
      {
        heading: "3. Тарифи та оплата",
        blocks: [
          `Ціни тарифів вказано на сторінці ${site}/pricing. Новий заклад отримує ${TRIAL_DAYS} днів тарифу «Плюс» безкоштовно, без прив'язки картки.`,
          `Платні тарифи — щомісячна підписка (наприклад, «Базова» — ${PLANS.basic.priceUah} грн/міс, «Плюс» — ${PLANS.plus.priceUah} грн/міс). Підписка продовжується автоматично щомісяця, доки ви її не скасуєте. До ціни можуть додаватися податки залежно від вашої країни — точну суму видно перед оплатою.`,
          "Процес замовлення та оплати веде наш онлайн-реселер Paddle.com. Paddle.com є продавцем (Merchant of Record) для всіх наших замовлень: він приймає оплату, видає рахунки, обробляє запити щодо платежів і повернення коштів. Дані вашої платіжної картки отримує лише Paddle — ми їх не бачимо і не зберігаємо.",
          "Ми можемо змінити ціни, попередивши вас електронною поштою щонайменше за 30 днів. Нова ціна діє з наступного платіжного періоду.",
        ],
      },
      {
        heading: "4. Скасування",
        blocks: [
          `Скасувати підписку можна будь-коли — за посиланням у листі-квитанції від Paddle або листом на ${brand.supportEmail}. Доступ до тарифу зберігається до кінця оплаченого періоду, нові списання припиняються.`,
          `Після скасування картки ваших клієнтів працюють ще ${CANCELED_GRACE_DAYS} днів, щоб ви встигли попередити клієнтів і вивантажити дані (CSV). Якщо оплата не пройшла, ми нагадаємо про це і на певний час обмежимо видачу нових карток.`,
          "Повернення коштів — за Політикою повернення коштів.",
        ],
      },
      {
        heading: "5. Дані ваших клієнтів",
        blocks: [
          "Дані клієнтів закладу (ім'я, телефон, історія візитів, згода на повідомлення) належать закладу. Щодо цих даних ви — володілець (контролер), а ми — розпорядник (обробник): обробляємо їх лише для роботи сервісу і за вашими вказівками.",
          [
            "Ви збираєте дані клієнтів законно і повідомляєте клієнтів про обробку.",
            "Ви надсилаєте акції та нагадування лише клієнтам, які дали на це згоду (сервіс відфільтровує решту автоматично).",
            "На запит клієнта ви видаляєте його дані (кнопка «Видалити дані» на сторінці «Клієнти»).",
          ],
          "Детальніше — у Політиці конфіденційності.",
        ],
      },
      {
        heading: "6. Заборонене використання",
        blocks: [
          [
            "спам, розсилки без згоди клієнтів, шахрайство, обман клієнтів щодо винагород;",
            "незаконний контент у назві, логотипі чи повідомленнях;",
            "спроби зламати сервіс, обійти ліміти або отримати доступ до чужих даних;",
            "перепродаж доступу до сервісу без нашої письмової згоди.",
          ],
          "У разі порушення ми можемо призупинити або закрити обліковий запис, попередивши вас, якщо це можливо.",
        ],
      },
      {
        heading: "7. Доступність і зміни сервісу",
        blocks: [
          "Ми прагнемо, щоб сервіс працював безперервно, але не гарантуємо цього: можливі технічні роботи й збої сторонніх постачальників (хостинг, пошта). Про планові роботи попереджаємо заздалегідь.",
          "Ми розвиваємо сервіс і можемо змінювати чи прибирати окремі функції. Якщо зміна суттєво погіршує оплачений тариф, ви можете скасувати підписку й отримати пропорційне повернення за невикористаний період.",
        ],
      },
      {
        heading: "8. Відповідальність",
        blocks: [
          "Сервіс надається «як є». Ми не відповідаємо за непрямі збитки (втрачений прибуток, клієнтів тощо). Наша загальна відповідальність перед вами обмежена сумою, яку ви сплатили за останні 3 місяці.",
          "Це обмеження не діє там, де закон його не дозволяє, і не обмежує ваших прав споживача.",
        ],
      },
      {
        heading: "9. Припинення",
        blocks: [
          `Ви можете будь-коли припинити користування і попросити видалити обліковий запис листом на ${brand.supportEmail}. Перед видаленням вивантажте потрібні дані — після видалення їх не можна відновити.`,
        ],
      },
      {
        heading: "10. Зміни умов і право",
        blocks: [
          "Про суттєві зміни умов ми повідомляємо електронною поштою щонайменше за 14 днів. Якщо ви продовжуєте користуватися сервісом після набрання змінами чинності, ви з ними погоджуєтеся.",
          "До цих умов застосовується право України. Спори намагаємося вирішити переговорами; якщо не вдалося — у суді за законодавством України. Українська версія умов має перевагу над перекладом.",
        ],
      },
    ],
  },
  en: {
    title: "Terms of Service",
    summary: `Rules for businesses using ${brand.name}.`,
    sections: [
      {
        heading: "1. The service",
        blocks: [
          `${brand.name} (${site}) is an online service that lets businesses (barbershops, cafés, salons and similar) run digital loyalty cards: issue stamp cards to their customers, add stamps with a scanner, message customers and view statistics.`,
          `The service is provided by ${brand.legalName.en} (${brand.country.en}) — "we", "us". Contact: ${brand.supportEmail}.`,
          'These terms are an agreement between us and the business owner who signs up for the service ("you"). By signing up or using the service you accept these terms.',
        ],
      },
      {
        heading: "2. Your account",
        blocks: [
          [
            "You sign in with a one-time code we email to you. Do not share the code.",
            "You are responsible for all actions in your dashboard and scanner, including those of staff you gave a PIN to.",
            "Provide accurate business details. You must be an adult and authorised to act for the business.",
          ],
        ],
      },
      {
        heading: "3. Plans and payment",
        blocks: [
          `Plan prices are listed at ${site}/pricing. A new business gets ${TRIAL_DAYS} days of the Plus plan for free, no card required.`,
          `Paid plans are monthly subscriptions (e.g. Basic — UAH ${PLANS.basic.priceUah}/month, Plus — UAH ${PLANS.plus.priceUah}/month). A subscription renews automatically every month until you cancel it. Taxes may be added depending on your country; the exact amount is shown before you pay.`,
          "Our order process is conducted by our online reseller Paddle.com. Paddle.com is the Merchant of Record for all our orders: it takes the payment, issues invoices and handles billing enquiries and refunds. Only Paddle receives your card details — we never see or store them.",
          "We may change prices with at least 30 days' notice by email. The new price applies from your next billing period.",
        ],
      },
      {
        heading: "4. Cancellation",
        blocks: [
          `You can cancel at any time — via the link in your Paddle receipt email or by emailing ${brand.supportEmail}. You keep your plan until the end of the paid period and no further charges are made.`,
          `After cancellation your customers' cards keep working for ${CANCELED_GRACE_DAYS} more days so you can notify customers and export your data (CSV). If a payment fails, we will remind you and may temporarily limit issuing new cards.`,
          "Refunds are covered by our Refund Policy.",
        ],
      },
      {
        heading: "5. Your customers' data",
        blocks: [
          "Your customers' data (name, phone, visit history, messaging consent) belongs to your business. For this data you are the controller and we are the processor: we process it only to run the service and on your instructions.",
          [
            "You collect customer data lawfully and inform customers about the processing.",
            "You send promotions and reminders only to customers who agreed to receive them (the service filters out the rest automatically).",
            'You delete a customer\'s data on their request (the "Delete data" button on the Customers page).',
          ],
          "See the Privacy Policy for details.",
        ],
      },
      {
        heading: "6. Prohibited use",
        blocks: [
          [
            "spam, messaging customers without consent, fraud, misleading customers about rewards;",
            "unlawful content in your business name, logo or messages;",
            "attempts to break the service, bypass limits or access other businesses' data;",
            "reselling access to the service without our written consent.",
          ],
          "If you breach these rules we may suspend or close your account, with notice where possible.",
        ],
      },
      {
        heading: "7. Availability and changes",
        blocks: [
          "We aim to keep the service running continuously but cannot guarantee it: maintenance and outages of third-party providers (hosting, email) may happen. We announce planned maintenance in advance.",
          "We keep improving the service and may change or remove features. If a change materially reduces a plan you paid for, you may cancel and receive a pro-rata refund for the unused period.",
        ],
      },
      {
        heading: "8. Liability",
        blocks: [
          'The service is provided "as is". We are not liable for indirect losses (lost profit, customers, etc.). Our total liability to you is limited to the amount you paid us in the last 3 months.',
          "This limitation does not apply where the law does not allow it and does not affect your statutory consumer rights.",
        ],
      },
      {
        heading: "9. Termination",
        blocks: [
          `You can stop using the service at any time and ask us to delete your account by emailing ${brand.supportEmail}. Export the data you need first — deleted data cannot be restored.`,
        ],
      },
      {
        heading: "10. Changes and governing law",
        blocks: [
          "We will notify you of material changes to these terms by email at least 14 days in advance. By continuing to use the service after the changes take effect you accept them.",
          "These terms are governed by the laws of Ukraine. We try to resolve disputes by negotiation first, otherwise in the courts of Ukraine. If the Ukrainian and English versions differ, the Ukrainian version prevails.",
        ],
      },
    ],
  },
};
