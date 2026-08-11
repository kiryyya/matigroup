"use client";

import { Card, CardContent } from "~/components/ui/card";

const COMPANY_CONTACTS = {
  company: "Mati Group",
  telegram: "@matibott_bot",
  email: "info@matigroup.ru",
  phone: "+7 (999) 000-00-00",
  address: "Москва",
} as const;

export default function FeedbackPage() {
  return (
    <div className="space-y-6 pb-52">
      <h1 className="text-2xl font-bold">Контакты</h1>
      <Card>
        <CardContent className="grid grid-cols-2 gap-x-4 gap-y-3 p-4 text-sm">
          <div className="space-y-0.5 min-w-0">
            <div className="text-muted-foreground">Компания</div>
            <div className="font-medium">{COMPANY_CONTACTS.company}</div>
          </div>

          <div className="space-y-0.5 min-w-0">
            <div className="text-muted-foreground">Telegram</div>
            <a
              href={`https://t.me/${COMPANY_CONTACTS.telegram.replace(/^@/, "")}`}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {COMPANY_CONTACTS.telegram}
            </a>
          </div>

          <div className="space-y-0.5 min-w-0">
            <div className="text-muted-foreground">Email</div>
            <a
              href={`mailto:${COMPANY_CONTACTS.email}`}
              className="font-medium text-primary underline-offset-4 hover:underline break-all"
            >
              {COMPANY_CONTACTS.email}
            </a>
          </div>

          <div className="space-y-0.5 min-w-0">
            <div className="text-muted-foreground">Телефон</div>
            <a
              href={`tel:${COMPANY_CONTACTS.phone.replace(/[^\d+]/g, "")}`}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {COMPANY_CONTACTS.phone}
            </a>
          </div>

          <div className="space-y-0.5 min-w-0">
            <div className="text-muted-foreground">Адрес</div>
            <div className="font-medium">{COMPANY_CONTACTS.address}</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
