import { brand } from "@/config/brand";

import type { LegalDocument, LegalLocale } from "./types";

const site = `https://${brand.domain}`;

export const privacy: Record<LegalLocale, LegalDocument> = {
  uk: {
    title: "Політика конфіденційності",
    summary: `Які дані збирає ${brand.name}, навіщо і як ними керувати.`,
    sections: [
      {
        heading: "1. Хто ми",
        blocks: [
          `Ця політика описує, як ${brand.name} (${site}) обробляє персональні дані. Сервіс надає ${brand.legalName.uk} (${brand.country.uk}). Питання щодо даних: ${brand.supportEmail}.`,
          "Ми діємо відповідно до Закону України «Про захист персональних даних» і, для користувачів з ЄС, Загального регламенту захисту даних (GDPR).",
        ],
      },
      {
        heading: "2. Дві ролі",
        blocks: [
          [
            "Для даних власників закладів і працівників ми — володілець (контролер) даних.",
            "Для даних клієнтів закладу (тих, хто отримує картку лояльності) володілець — сам заклад, а ми — розпорядник: обробляємо дані лише для роботи картки й за вказівками закладу. З питаннями про свої дані клієнт може звернутися до закладу або до нас — ми передамо запит закладу.",
          ],
        ],
      },
      {
        heading: "3. Які дані ми збираємо",
        blocks: [
          "Власник закладу:",
          [
            "електронна пошта (для входу за кодом і службових листів);",
            "назва закладу, адреса сторінки, логотип, кольори картки, правило винагороди;",
            "контактний телефон і місто закладу (якщо вказали);",
            "тариф, дати оплат і статус підписки (без даних платіжної картки).",
          ],
          "Працівники закладу: ім'я (як його вказав власник) і PIN-код у зашифрованому вигляді (лише хеш).",
          "Клієнти закладу:",
          [
            "ім'я і телефон — лише якщо клієнт їх указав (вони необов'язкові);",
            "картка: кількість штампів, винагороди, дати візитів і хто з працівників ставив штамп;",
            "згода на повідомлення: коли і де її дано або відкликано, версія тексту згоди;",
            "повідомлення, які заклад надіслав клієнту.",
          ],
          "Технічні дані:",
          [
            "IP-адреса — лише у вигляді незворотного хешу, для захисту від підбору кодів і PIN;",
            "службові журнали (помилки, події) — телефони, email і токени в них автоматично маскуються;",
            "журнал дій (хто й коли змінив згоду, експортував чи видалив дані).",
          ],
        ],
      },
      {
        heading: "4. Навіщо",
        blocks: [
          [
            "щоб надавати сервіс: вхід, картки, штампи, винагороди, повідомлення, статистика (виконання договору);",
            "щоб надсилати клієнтам акції та нагадування — лише за їхньою згодою (згода);",
            "щоб захищати сервіс від зловживань і розслідувати збої (законний інтерес);",
            "щоб приймати оплату і вести облік (виконання договору, вимоги закону).",
          ],
          "Ми не продаємо дані, не показуємо рекламу і не використовуємо рекламні трекери. Загальну статистику відвідувань сайту рахує Vercel Web Analytics: без cookie, без імен і контактів, лише знеособлені дані (сторінка, країна, тип пристрою, звідки прийшов відвідувач).",
        ],
      },
      {
        heading: "5. Файли cookie",
        blocks: [
          "Ми використовуємо лише необхідні cookie: для входу в кабінет і сканер. Рекламних і аналітичних cookie немає, тому окремої згоди на них не потрібно.",
        ],
      },
      {
        heading: "6. Кому ми передаємо дані",
        blocks: [
          "Лише постачальникам, без яких сервіс не працює, і лише в потрібному обсязі:",
          [
            "Supabase — база даних і зберігання файлів (сервери у Франкфурті, ЄС);",
            "Vercel — хостинг сайту (обробка запитів у Франкфурті, ЄС) і знеособлена статистика відвідувань;",
            "Resend — надсилання листів із кодом входу;",
            "ImprovMX — пересилання листів, надісланих на адресу підтримки;",
            "Paddle — прийом оплати як продавець (Merchant of Record); Paddle обробляє платіжні дані за власною політикою конфіденційності;",
            "Google — лише якщо заклад увімкнув картки Google Wallet.",
          ],
          "Деякі постачальники можуть обробляти дані за межами ЄС (наприклад, у США). У таких випадках передача захищена стандартними договірними умовами ЄС або рівнозначними гарантіями.",
          "Ми також можемо розкрити дані, якщо цього вимагає закон або рішення суду.",
        ],
      },
      {
        heading: "7. Скільки зберігаємо",
        blocks: [
          [
            "дані закладу — поки існує обліковий запис; після видалення запису — стираємо протягом 30 днів;",
            "дані клієнта — поки заклад користується сервісом або доки заклад чи клієнт не попросить їх видалити; після видалення ім'я, телефон і згода стираються одразу, а знеособлена історія візитів лишається для статистики закладу;",
            "службові журнали — до 30 днів; платіжні документи — стільки, скільки вимагає закон.",
          ],
        ],
      },
      {
        heading: "8. Ваші права",
        blocks: [
          "Ви маєте право знати, які дані про вас обробляються, отримати їх копію, виправити, видалити, обмежити обробку, заперечити проти неї та відкликати згоду в будь-який момент.",
          [
            "Клієнт може вимкнути повідомлення сам — прямо на своїй картці.",
            "Власник закладу може вивантажити дані клієнтів (CSV) і видалити дані будь-якого клієнта в кабінеті.",
            `Для інших запитів напишіть на ${brand.supportEmail} — відповімо протягом 30 днів.`,
          ],
          "Ви також можете поскаржитися Уповноваженому Верховної Ради України з прав людини або, якщо ви в ЄС, — органу захисту даних своєї країни.",
        ],
      },
      {
        heading: "9. Безпека",
        blocks: [
          "Дані передаються лише зашифрованим з'єднанням (HTTPS). Доступ до даних кожного закладу обмежено на рівні бази даних, PIN-коди і IP-адреси зберігаються лише як хеш, кількість спроб входу обмежена.",
        ],
      },
      {
        heading: "10. Діти",
        blocks: [
          "Сервіс не призначений для дітей до 14 років. Заклади не повинні свідомо реєструвати картки для дітей до 14 років без згоди батьків.",
        ],
      },
      {
        heading: "11. Зміни",
        blocks: [
          "Про суттєві зміни цієї політики ми повідомляємо власників закладів електронною поштою. Дата останньої редакції вказана вгорі сторінки.",
        ],
      },
    ],
  },
  en: {
    title: "Privacy Policy",
    summary: `What data ${brand.name} collects, why, and how to control it.`,
    sections: [
      {
        heading: "1. Who we are",
        blocks: [
          `This policy explains how ${brand.name} (${site}) processes personal data. The service is provided by ${brand.legalName.en} (${brand.country.en}). Data questions: ${brand.supportEmail}.`,
          "We follow the Law of Ukraine «On Personal Data Protection» and, for users in the EU, the General Data Protection Regulation (GDPR).",
        ],
      },
      {
        heading: "2. Two roles",
        blocks: [
          [
            "For the data of business owners and their staff we are the controller.",
            "For the data of a business's customers (people who get a loyalty card) the business is the controller and we are its processor: we process the data only to run the card and on the business's instructions. Customers may contact the business or us about their data — we will forward the request to the business.",
          ],
        ],
      },
      {
        heading: "3. Data we collect",
        blocks: [
          "Business owners:",
          [
            "email address (for sign-in codes and service emails);",
            "business name, page address, logo, card colours, reward rule;",
            "business contact phone and city (if provided);",
            "plan, payment dates and subscription status (no card details).",
          ],
          "Staff: name (as entered by the owner) and PIN code stored only as a hash.",
          "Customers of businesses:",
          [
            "name and phone — only if the customer chose to provide them (both optional);",
            "card: stamps, rewards, visit dates and which staff member added a stamp;",
            "messaging consent: when and where it was given or withdrawn, and the consent text version;",
            "messages the business sent to the customer.",
          ],
          "Technical data:",
          [
            "IP address — only as an irreversible hash, to protect against code and PIN guessing;",
            "service logs (errors, events) — phones, emails and tokens are masked automatically;",
            "audit log (who changed consent, exported or deleted data, and when).",
          ],
        ],
      },
      {
        heading: "4. Why",
        blocks: [
          [
            "to provide the service: sign-in, cards, stamps, rewards, messages, statistics (performance of contract);",
            "to send customers promotions and reminders — only with their consent (consent);",
            "to protect the service from abuse and investigate failures (legitimate interest);",
            "to take payments and keep records (performance of contract, legal obligation).",
          ],
          "We do not sell data, show ads, or use advertising trackers. Aggregate website visit statistics are counted by Vercel Web Analytics: no cookies, no names or contacts, only anonymous data (page, country, device type, referring site).",
        ],
      },
      {
        heading: "5. Cookies",
        blocks: [
          "We use only strictly necessary cookies to keep you signed in to the dashboard and scanner. There are no advertising or analytics cookies, so no separate consent is needed.",
        ],
      },
      {
        heading: "6. Who we share data with",
        blocks: [
          "Only with providers the service cannot run without, and only as much as needed:",
          [
            "Supabase — database and file storage (Frankfurt, EU);",
            "Vercel — website hosting (requests processed in Frankfurt, EU) and anonymous visit statistics;",
            "Resend — sending sign-in code emails;",
            "ImprovMX — forwarding emails sent to our support address;",
            "Paddle — payment processing as Merchant of Record; Paddle processes payment data under its own privacy policy;",
            "Google — only if a business turns on Google Wallet cards.",
          ],
          "Some providers may process data outside the EU (e.g. in the USA). Such transfers are protected by the EU Standard Contractual Clauses or equivalent safeguards.",
          "We may also disclose data when required by law or a court order.",
        ],
      },
      {
        heading: "7. Retention",
        blocks: [
          [
            "business data — while the account exists; erased within 30 days after the account is deleted;",
            "customer data — while the business uses the service or until the business or the customer asks to delete it; on deletion the name, phone and consent are erased immediately, and an anonymised visit history is kept for the business's statistics;",
            "service logs — up to 30 days; payment records — as long as the law requires.",
          ],
        ],
      },
      {
        heading: "8. Your rights",
        blocks: [
          "You have the right to know what data about you is processed, get a copy, correct it, delete it, restrict or object to processing, and withdraw consent at any time.",
          [
            "Customers can turn off messages themselves, right on their card.",
            "Business owners can export customer data (CSV) and delete any customer's data in the dashboard.",
            `For any other request email ${brand.supportEmail} — we reply within 30 days.`,
          ],
          "You can also complain to the Ukrainian Parliament Commissioner for Human Rights or, if you are in the EU, to your local data protection authority.",
        ],
      },
      {
        heading: "9. Security",
        blocks: [
          "Data is transmitted only over encrypted connections (HTTPS). Access to each business's data is restricted at the database level, PIN codes and IP addresses are stored only as hashes, and sign-in attempts are rate-limited.",
        ],
      },
      {
        heading: "10. Children",
        blocks: [
          "The service is not intended for children under 14. Businesses must not knowingly issue cards to children under 14 without parental consent.",
        ],
      },
      {
        heading: "11. Changes",
        blocks: [
          "We notify business owners of material changes to this policy by email. The date of the latest version is shown at the top of the page.",
        ],
      },
    ],
  },
};
