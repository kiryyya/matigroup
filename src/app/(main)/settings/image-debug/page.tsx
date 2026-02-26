"use client";

import { useMemo, useState } from "react";
import { api } from "~/trpc/react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import Loader from "~/components/ui/loader";

type DebugResponse = {
  key: string;
  keys: {
    requested: string;
    previewKey: string;
    originalKey: string;
  };
  imageRouteDecision: {
    expectedStatus: number;
    reason: string;
  };
  probes: unknown;
};

function normalizeInputToKey(value: string) {
  const input = value.trim();
  if (!input) return "";
  if (input.startsWith("/api/images/")) {
    const noPrefix = input.slice("/api/images/".length);
    return noPrefix.split("?")[0] ?? "";
  }
  return input.split("?")[0] ?? "";
}

export default function ImageDebugPage() {
  const { data: user, isLoading } = api.tg.getUser.useQuery();
  const [input, setInput] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState<DebugResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const preparedKey = useMemo(() => normalizeInputToKey(input), [input]);

  const runCheck = async () => {
    if (!preparedKey) {
      setError("Введите key или /api/images/... URL");
      return;
    }

    setIsChecking(true);
    setError(null);
    setResult(null);

    try {
      const initData = window.Telegram?.WebApp?.initData ?? "";
      const response = await fetch(
        `/api/images-debug?key=${encodeURIComponent(preparedKey)}`,
        {
          method: "GET",
          headers: {
            "x-telegram-init-data": initData,
          },
        },
      );

      const payload = (await response.json()) as DebugResponse | { error?: string };
      if (!response.ok) {
        throw new Error(
          "error" in payload && payload.error
            ? payload.error
            : `Request failed with ${response.status}`,
        );
      }
      setResult(payload as DebugResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось выполнить проверку");
    } finally {
      setIsChecking(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader />
      </div>
    );
  }

  if (user?.role !== "admin") {
    return (
      <div className="space-y-4 pb-52">
        <h1 className="text-2xl font-bold">Диагностика изображений</h1>
        <Card>
          <CardContent className="pt-6 text-muted-foreground">
            Доступно только администратору.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-52">
      <h1 className="text-2xl font-bold">Диагностика изображений</h1>

      <Card>
        <CardHeader>
          <CardTitle>Проверка key из S3</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="images/uuid-original-file.jpg или /api/images/images%2F..."
          />
          <div className="flex gap-2">
            <Button onClick={runCheck} disabled={isChecking}>
              {isChecking ? "Проверяю..." : "Проверить"}
            </Button>
          </div>
          {preparedKey && (
            <p className="text-xs text-muted-foreground break-all">
              Нормализованный key: {preparedKey}
            </p>
          )}
          {error && <p className="text-sm text-red-500">{error}</p>}
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Результат</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs whitespace-pre-wrap break-all bg-muted p-3 rounded-md">
              {JSON.stringify(result, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
