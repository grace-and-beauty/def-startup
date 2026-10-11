# Шаблони листів для входу за кодом

Supabase → **Authentication → Emails → Templates**. Однаковий текст для двох шаблонів:
**Magic Link** (вхід уже зареєстрованого власника) і **Confirm signup** (перший вхід нового власника).
Код — `{{ .Token }}`; посилання в листі навмисно немає: власник вводить код на сторінці, де почав вхід.


**Subject:**

```
Код для входу: {{ .Token }}
```

**Body (HTML):**

```html
<div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #141414;">
  <p style="font-size: 16px;">Ваш код для входу в Tickity:</p>
  <p style="font-size: 32px; font-weight: bold; letter-spacing: 6px; margin: 16px 0;">{{ .Token }}</p>
  <p style="font-size: 14px; color: #5f5c57;">Код діє 10 хвилин і спрацьовує один раз. Введіть його на сторінці входу.</p>
  <p style="font-size: 14px; color: #5f5c57;">Якщо ви не намагалися увійти — просто проігноруйте цей лист. Нікому не повідомляйте код.</p>
</div>
```

Налаштування коду (Authentication → Providers → Email): **Email OTP Expiration** `600`, **Email OTP Length** `6`.
