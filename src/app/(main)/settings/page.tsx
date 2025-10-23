"use client";

import React from "react";
import { api } from "~/trpc/react";
import { Settings, Users, Package, BarChart3 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import DefaultError from "~/components/layouts/error-page";

const SettingsPage = () => {
  const { data: user, isLoading } = api.tg.getUser.useQuery();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return (
      <DefaultError 
        error={{ 
          message: "Доступ запрещен. Требуется роль администратора." 
        }} 
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2">
        <Settings className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Настройки администратора</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="h-5 w-5" />
              <span>Управление пользователями</span>
            </CardTitle>
            <CardDescription>
              Управление пользователями и их ролями
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full">
              Просмотр всех пользователей
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Package className="h-5 w-5" />
              <span>Управление товарами</span>
            </CardTitle>
            <CardDescription>
              Добавление, редактирование или удаление товаров
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full">
              Управление товарами
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5" />
              <span>Аналитика</span>
            </CardTitle>
            <CardDescription>
              Просмотр статистики и метрик приложения
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full">
              Просмотр аналитики
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Settings className="h-5 w-5" />
              <span>Системные настройки</span>
            </CardTitle>
            <CardDescription>
              Настройка параметров приложения
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full">
              Конфигурация системы
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Информация об администраторе</CardTitle>
          <CardDescription>
            Детали текущего пользователя-администратора
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p><strong>Имя:</strong> {user.name || "Не указано"}</p>
            <p><strong>Telegram ID:</strong> {user.telegramId}</p>
            <p><strong>Роль:</strong> {user.role}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsPage;
