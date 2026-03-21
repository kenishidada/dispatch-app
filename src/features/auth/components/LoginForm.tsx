"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

export function LoginForm() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!userId.trim() || !password.trim()) {
      setError("ユーザーIDとパスワードを入力してください");
      return;
    }

    router.push("/map");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-sm p-8">
        <h1 className="text-2xl font-bold text-center mb-2">
          配送先マッピングシステム
        </h1>
        <p className="text-sm text-gray-500 text-center mb-6">
          ログインしてください
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="userId">ユーザーID</Label>
            <Input
              id="userId"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="ユーザーID"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="password">パスワード</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="パスワード"
              className="mt-1"
            />
          </div>
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
          <Button type="submit" className="w-full">
            ログイン
          </Button>
        </form>
      </Card>
    </div>
  );
}
