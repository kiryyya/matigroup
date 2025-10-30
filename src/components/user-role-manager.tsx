"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "~/components/ui/dialog";
import { User, Mail, Shield, AlertTriangle } from "lucide-react";

interface UserRoleManagerProps {
  user: {
    id: string;
    name: string | null;
    email: string | null;
    role: "admin" | "user";
    telegramId: string;
  } | null;
  onClose: () => void;
}

export default function UserRoleManager({ user, onClose }: UserRoleManagerProps) {
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [pendingRole, setPendingRole] = useState<"admin" | "user" | null>(null);
  
  const updateUserRole = api.tg.updateUserRole.useMutation({
    onSuccess: () => {
      setIsConfirmDialogOpen(false);
      setPendingRole(null);
      onClose();
    },
    onError: (error) => {
      console.error("Error updating user role:", error);
      alert(`Ошибка при изменении роли: ${error.message}`);
    },
  });

  if (!user) return null;

  const handleRoleToggle = (newRole: "admin" | "user") => {
    if (newRole !== user.role) {
      setPendingRole(newRole);
      setIsConfirmDialogOpen(true);
    }
  };

  const confirmRoleChange = () => {
    if (pendingRole) {
      updateUserRole.mutate({
        userId: user.id,
        role: pendingRole,
      });
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "admin":
        return "destructive";
      case "user":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "admin":
        return <Shield className="h-4 w-4" />;
      case "user":
        return <User className="h-4 w-4" />;
      default:
        return <User className="h-4 w-4" />;
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <User className="h-5 w-5" />
            <span>Управление пользователем</span>
          </CardTitle>
          <CardDescription>
            Измените роль пользователя
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Информация о пользователе */}
          <div className="flex items-center space-x-3">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <span className="text-lg font-semibold">
                {user.name?.[0] || "U"}
              </span>
            </div>
            
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <h3 className="font-medium">
                  {user.name || "Без имени"}
                </h3>
                <Badge variant={getRoleBadgeVariant(user.role)} className="flex items-center space-x-1">
                  {getRoleIcon(user.role)}
                  <span className="capitalize">{user.role}</span>
                </Badge>
              </div>
              
              {user.email && (
                <div className="flex items-center space-x-1 mt-1 text-sm text-muted-foreground">
                  <Mail className="h-3 w-3" />
                  <span className="truncate">{user.email}</span>
                </div>
              )}
            </div>
          </div>

          {/* Тогглер роли */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium">Роль пользователя</label>
                <p className="text-xs text-muted-foreground">
                  Переключите для изменения роли
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm">User</span>
                <Switch
                  checked={user.role === "admin"}
                  onCheckedChange={(checked) => 
                    handleRoleToggle(checked ? "admin" : "user")
                  }
                  disabled={updateUserRole.isPending}
                />
                <span className="text-sm">Admin</span>
              </div>
            </div>
          </div>

          {/* Кнопки действий */}
          <div className="flex space-x-2 pt-4">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={updateUserRole.isPending}
            >
              Закрыть
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Диалог подтверждения */}
      <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <span>Подтверждение изменения роли</span>
            </DialogTitle>
            <DialogDescription>
              Вы уверены, что хотите изменить роль пользователя{" "}
              <strong>{user.name || "Без имени"}</strong> с{" "}
              <Badge variant={getRoleBadgeVariant(user.role)} className="mx-1">
                {user.role}
              </Badge>{" "}
              на{" "}
              <Badge variant={getRoleBadgeVariant(pendingRole || "user")} className="mx-1">
                {pendingRole}
              </Badge>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsConfirmDialogOpen(false)}
              disabled={updateUserRole.isPending}
            >
              Отмена
            </Button>
            <Button
              onClick={confirmRoleChange}
              disabled={updateUserRole.isPending}
              variant={pendingRole === "admin" ? "destructive" : "default"}
            >
              {updateUserRole.isPending ? "Изменение..." : "Подтвердить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

