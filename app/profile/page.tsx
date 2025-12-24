'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { createSupabaseClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import { UserMenu } from '@/components/auth';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [fullName, setFullName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push('/login');
        return;
      }

      const currentUser = session.user;
      setUser(currentUser);
      setFullName(currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || '');
      setIsCheckingAuth(false);

      // 인증 상태 변경 감지
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!session) {
          router.push('/login');
        } else {
          setUser(session.user);
          setFullName(session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || '');
        }
      });

      return () => {
        subscription.unsubscribe();
      };
    };

    checkAuth();
  }, [router]);

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // 유효성 검사
    if (!currentPassword) {
      setError('기존 비밀번호를 입력해주세요.');
      return;
    }

    if (!newPassword) {
      setError('새 비밀번호를 입력해주세요.');
      return;
    }

    if (newPassword.length < 6) {
      setError('비밀번호는 최소 6자 이상이어야 합니다.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('새 비밀번호가 일치하지 않습니다.');
      return;
    }

    if (currentPassword === newPassword) {
      setError('새 비밀번호는 기존 비밀번호와 달라야 합니다.');
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createSupabaseClient();
      
      if (!user?.email) {
        throw new Error('사용자 정보를 찾을 수 없습니다.');
      }

      // 기존 비밀번호 확인
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (signInError) {
        setError('기존 비밀번호가 일치하지 않습니다.');
        toast.error('기존 비밀번호가 일치하지 않습니다.');
        setIsLoading(false);
        return;
      }

      // 기존 비밀번호 확인 후 새 비밀번호로 변경
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        throw updateError;
      }

      setSuccess('비밀번호가 성공적으로 변경되었습니다.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('비밀번호가 성공적으로 변경되었습니다.');
    } catch (err: any) {
      console.error('Password update error:', err);
      setError(err.message || '비밀번호 변경에 실패했습니다.');
      toast.error('비밀번호 변경에 실패했습니다.', {
        description: err.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50/50 via-white to-violet-50/50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-900">
        <div className="text-center space-y-4">
          <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">인증 확인 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50/50 via-white to-violet-50/50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-900">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push('/')}
              className="h-10 w-10"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                마이페이지
              </h1>
              <p className="text-muted-foreground mt-1">프로필 정보를 확인하고 비밀번호를 변경할 수 있습니다.</p>
            </div>
          </div>
          <UserMenu />
        </div>

        {/* 프로필 정보 카드 */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>프로필 정보</CardTitle>
            <CardDescription>회원 정보를 확인하세요</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">이름</Label>
              <Input
                id="name"
                type="text"
                value={fullName}
                disabled
                className="bg-muted"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">이메일</Label>
              <Input
                id="email"
                type="email"
                value={user?.email || ''}
                disabled
                className="bg-muted"
              />
            </div>
          </CardContent>
        </Card>

        {/* 비밀번호 변경 카드 */}
        <Card>
          <CardHeader>
            <CardTitle>비밀번호 변경</CardTitle>
            <CardDescription>기존 비밀번호를 확인한 후 새로운 비밀번호를 입력해주세요</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordUpdate} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {success && (
                <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
                  <AlertDescription className="text-green-800 dark:text-green-200">
                    {success}
                  </AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="currentPassword">기존 비밀번호</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="현재 사용 중인 비밀번호를 입력하세요"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">새 비밀번호</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="새 비밀번호를 입력하세요 (최소 6자)"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">새 비밀번호 확인</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="새 비밀번호를 다시 입력하세요"
                  disabled={isLoading}
                />
              </div>
              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    변경 중...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    비밀번호 변경
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

