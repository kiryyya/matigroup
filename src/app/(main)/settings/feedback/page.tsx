"use client";

import { useEffect, useState } from "react";
import { api } from "~/trpc/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import Loader from "~/components/ui/loader";
import { toast } from "sonner";
import { Save } from "lucide-react";

export default function FeedbackSettingsPage() {
  const { data: user, isLoading: isUserLoading } = api.tg.getUser.useQuery();
  const { data: settings, isLoading: isSettingsLoading } =
    api.settings.getFeedbackRecipientSettings.useQuery(undefined, {
      enabled: user?.role === "admin",
    });
  const utils = api.useUtils();
  const [telegramUsername, setTelegramUsername] = useState("");

  const updateRecipient = api.settings.updateFeedbackRecipientSettings.useMutation({
    onSuccess: async () => {
      toast.success("Адресат обратной связи сохранен");
      await utils.settings.getFeedbackRecipientSettings.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Не удалось сохранить настройки");
    },
  });

  useEffect(() => {
    if (settings?.telegramUsername) {
      setTelegramUsername(settings.telegramUsername);
    }
  }, [settings?.telegramUsername]);

  if (isUserLoading || (user?.role === "admin" && isSettingsLoading)) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader />
      </div>
    );
  }

  if (user?.role !== "admin") {
    return (
      <div className="space-y-4 pb-52">
        <h1 className="text-2xl font-bold">Доступ запрещен</h1>
        <p className="text-muted-foreground">У вас нет прав для доступа к этой странице.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-52">
      <h1 className="text-2xl font-bold">Адресат обратной связи</h1>
      <Card>
        <CardHeader>
          <CardTitle>Telegram-получатель</CardTitle>
          <CardDescription>
            Укажите username пользователя Telegram, которому будут приходить сообщения из формы обратной связи.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="feedback-recipient">Ник Telegram</Label>
            <Input
              id="feedback-recipient"
              value={telegramUsername}
              onChange={(e) => setTelegramUsername(e.target.value.replace(/^@+/, ""))}
              placeholder="kolesnikovkiko"
            />
            <p className="text-sm text-muted-foreground">
              Можно вводить с @ или без него.
            </p>
          </div>
          <Button
            onClick={() => updateRecipient.mutate({ telegramUsername })}
            disabled={updateRecipient.isPending || telegramUsername.trim().length === 0}
          >
            <Save className="mr-2 h-4 w-4" />
            {updateRecipient.isPending ? "Сохранение..." : "Сохранить"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
