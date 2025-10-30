"use client";

import { useState, useEffect } from "react";
import { api } from "~/trpc/react";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Search, User, Mail, Shield } from "lucide-react";
import { Skeleton } from "~/components/ui/skeleton";
import UserRoleManager from "~/components/user-role-manager";

interface UserSearchProps {
  onUserSelect?: (user: any) => void;
}

export default function UserSearch({ onUserSelect }: UserSearchProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<any>(null);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: users, isLoading, error } = api.tg.searchUsers.useQuery(
    { query: debouncedQuery },
    { 
      enabled: debouncedQuery.length > 0,
      staleTime: 30000, // 30 seconds
    }
  );

  const handleUserClick = (user: any) => {
    setSelectedUser(user);
    if (onUserSelect) {
      onUserSelect(user);
    }
  };

  const handleCloseUserManager = () => {
    setSelectedUser(null);
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
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Поиск пользователей</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Введите имя или email пользователя..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {searchQuery.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Введите запрос для поиска пользователей
        </p>
      )}

      {isLoading && debouncedQuery.length > 0 && (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-6 w-16" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {error && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-destructive">
              Ошибка при поиске: {error.message}
            </p>
          </CardContent>
        </Card>
      )}

      {users && users.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Найдено пользователей: {users.length}
          </p>
          {users.map((user) => (
            <Card 
              key={user.id} 
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => handleUserClick(user)}
            >
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    <span className="text-sm font-semibold">
                      {user.name?.[0] || "U"}
                    </span>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <h3 className="font-medium truncate">
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {users && users.length === 0 && debouncedQuery.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground text-center">
              Пользователи не найдены
            </p>
          </CardContent>
        </Card>
      )}

      {/* Менеджер ролей для выбранного пользователя */}
      {selectedUser && (
        <UserRoleManager 
          user={selectedUser}
          onClose={handleCloseUserManager}
        />
      )}
    </div>
  );
}
