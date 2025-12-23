'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { TodoList, TodoForm, Todo, TodoFormData } from '@/components/todo';
import { UserMenu } from '@/components/auth';
import { createClient } from '@/lib/supabase/client';
import {
  Search,
  Plus,
  Sparkles,
  TrendingUp,
  Filter,
  SortAsc,
  Loader2,
  Lightbulb,
  ExternalLink,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

export default function Home() {
  const router = useRouter();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('created_date');
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAiDialogOpen, setIsAiDialogOpen] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | undefined>();
  const [aiInput, setAiInput] = useState('');
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [deleteTodoId, setDeleteTodoId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [summaryData, setSummaryData] = useState<{
    summary: string;
    urgentTasks: string[];
    insights: string[];
    recommendations: string[];
  } | null>(null);
  const [summaryPeriod, setSummaryPeriod] = useState<'today' | 'week'>('today');
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isLoadingTips, setIsLoadingTips] = useState(false);
  const [todoTips, setTodoTips] = useState<{
    tips: string[];
    websites: Array<{ title: string; url: string; description: string }>;
  } | null>(null);

  // 할 일 목록 가져오기
  const fetchTodos = useCallback(async () => {
    if (!userId) return;
    
    try {
      setIsLoading(true);
      const supabase = createClient();
      const { data, error } = await supabase
        .from('todos')
        .select('*')
        .eq('user_id', userId)
        .order('created_date', { ascending: false });

      if (error) {
        throw error;
      }

      setTodos(data || []);
    } catch (error: any) {
      console.error('할 일 목록 가져오기 실패:', error);
      toast.error('할 일 목록을 불러오는데 실패했습니다.', {
        description: error.message || '네트워크 오류가 발생했습니다.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // 인증 상태 확인 및 리다이렉트
  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        // 로그인하지 않은 경우 로그인 페이지로 리다이렉트
        router.push('/login');
        return;
      }

      setUserId(session.user.id);
      setIsCheckingAuth(false);

      // 인증 상태 변경 감지
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!session) {
          router.push('/login');
        } else {
          setUserId(session.user.id);
        }
      });

      return () => {
        subscription.unsubscribe();
      };
    };

    checkAuth();
  }, [router]);

  // userId가 설정되면 할 일 목록 가져오기
  useEffect(() => {
    if (userId) {
      fetchTodos();
    }
  }, [userId, fetchTodos]);

  // 인증 확인 중에는 로딩 표시
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

  // 필터링 및 정렬 로직
  const getFilteredAndSortedTodos = () => {
    let filtered = todos.filter((todo) => {
      // 검색 (제목만 검색)
      const matchesSearch =
        searchQuery === '' ||
        todo.title.toLowerCase().includes(searchQuery.toLowerCase());

      // 우선순위 필터
      const matchesPriority =
        filterPriority === 'all' || todo.priority === filterPriority;

      // 카테고리 필터
      const matchesCategory =
        filterCategory === 'all' || todo.category === filterCategory;

      // 상태 필터
      let matchesStatus = true;
      if (filterStatus === 'completed') {
        matchesStatus = todo.completed;
      } else if (filterStatus === 'in_progress') {
        matchesStatus = !todo.completed && new Date(todo.due_date) >= new Date();
      } else if (filterStatus === 'overdue') {
        matchesStatus = !todo.completed && new Date(todo.due_date) < new Date();
      }

      return matchesSearch && matchesPriority && matchesCategory && matchesStatus;
    });

    // 정렬
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'priority':
          const priorityOrder = { high: 0, medium: 1, low: 2 };
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        case 'due_date':
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        case 'created_date':
          return new Date(b.created_date).getTime() - new Date(a.created_date).getTime();
        case 'title':
          return a.title.localeCompare(b.title, 'ko');
        default:
          return 0;
      }
    });

    return filtered;
  };

  const handleAddTodo = async (data: TodoFormData) => {
    if (!userId) {
      toast.error('인증 오류', {
        description: '로그인이 필요합니다.',
      });
      return;
    }

    try {
      const supabase = createClient();
      const { data: newTodo, error } = await supabase
        .from('todos')
        .insert({
          user_id: userId,
          title: data.title,
          description: data.description || null,
          due_date: data.due_date,
          priority: data.priority,
          category: data.category,
          completed: false,
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      toast.success('할 일이 추가되었습니다.');
      setIsAddDialogOpen(false);
      await fetchTodos(); // 목록 새로고침
    } catch (error: any) {
      console.error('할 일 추가 실패:', error);
      toast.error('할 일 추가에 실패했습니다.', {
        description: error.message || '네트워크 오류가 발생했습니다.',
      });
    }
  };

  const handleEditTodo = async (data: TodoFormData) => {
    if (!editingTodo || !userId) {
      toast.error('인증 오류', {
        description: '로그인이 필요합니다.',
      });
      return;
    }

    // 본인 소유 확인
    if (editingTodo.user_id !== userId) {
      toast.error('권한 오류', {
        description: '본인의 할 일만 수정할 수 있습니다.',
      });
      return;
    }

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('todos')
        .update({
          title: data.title,
          description: data.description || null,
          due_date: data.due_date,
          priority: data.priority,
          category: data.category,
        })
        .eq('id', editingTodo.id)
        .eq('user_id', userId); // 추가 보안: user_id도 확인

      if (error) {
        throw error;
      }

      toast.success('할 일이 수정되었습니다.');
      setIsEditDialogOpen(false);
      setEditingTodo(undefined);
      await fetchTodos(); // 목록 새로고침
    } catch (error: any) {
      console.error('할 일 수정 실패:', error);
      toast.error('할 일 수정에 실패했습니다.', {
        description: error.message || '네트워크 오류가 발생했습니다.',
      });
    }
  };

  const handleToggleComplete = async (id: string, completed: boolean) => {
    if (!userId) {
      toast.error('인증 오류', {
        description: '로그인이 필요합니다.',
      });
      return;
    }

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('todos')
        .update({ completed })
        .eq('id', id)
        .eq('user_id', userId); // 본인 소유 확인

      if (error) {
        throw error;
      }

      await fetchTodos(); // 목록 새로고침
    } catch (error: any) {
      console.error('완료 상태 변경 실패:', error);
      toast.error('완료 상태 변경에 실패했습니다.', {
        description: error.message || '네트워크 오류가 발생했습니다.',
      });
    }
  };

  const handleDeleteTodo = async (id: string) => {
    if (!userId) {
      toast.error('인증 오류', {
        description: '로그인이 필요합니다.',
      });
      return;
    }

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('todos')
        .delete()
        .eq('id', id)
        .eq('user_id', userId); // 본인 소유 확인

      if (error) {
        throw error;
      }

      toast.success('할 일이 삭제되었습니다.');
      setDeleteTodoId(null);
      await fetchTodos(); // 목록 새로고침
    } catch (error: any) {
      console.error('할 일 삭제 실패:', error);
      toast.error('할 일 삭제에 실패했습니다.', {
        description: error.message || '네트워크 오류가 발생했습니다.',
      });
    }
  };

  const handleEdit = (todo: Todo) => {
    // 본인 소유 확인
    if (todo.user_id !== userId) {
      toast.error('권한 오류', {
        description: '본인의 할 일만 수정할 수 있습니다.',
      });
      return;
    }
    setEditingTodo(todo);
    setIsEditDialogOpen(true);
  };

  const handleDeleteClick = (id: string) => {
    const todo = todos.find((t) => t.id === id);
    if (todo && todo.user_id !== userId) {
      toast.error('권한 오류', {
        description: '본인의 할 일만 삭제할 수 있습니다.',
      });
      return;
    }
    setDeleteTodoId(id);
  };

  const handleViewDetail = (todo: Todo) => {
    setSelectedTodo(todo);
    setIsDetailDialogOpen(true);
    setTodoTips(null); // 이전 팁 초기화
  };

  const handleGetTips = async () => {
    if (!selectedTodo) return;

    try {
      setIsLoadingTips(true);

      const response = await fetch('/api/ai/get-todo-tips', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          todo: {
            title: selectedTodo.title,
            description: selectedTodo.description,
            category: selectedTodo.category,
            priority: selectedTodo.priority,
          },
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '팁 생성에 실패했습니다.');
      }

      if (!result.success || !result.data) {
        throw new Error('응답 데이터가 올바르지 않습니다.');
      }

      setTodoTips(result.data);
      toast.success('팁을 가져왔습니다!');
    } catch (error: any) {
      console.error('팁 가져오기 오류:', error);
      toast.error('팁 가져오기 실패', {
        description: error.message || '알 수 없는 오류가 발생했습니다.',
      });
    } finally {
      setIsLoadingTips(false);
    }
  };

  const handleAiGenerate = async () => {
    if (!aiInput.trim()) {
      toast.error('입력 오류', {
        description: '할 일을 입력해주세요.',
      });
      return;
    }

    try {
      setIsAiGenerating(true);

      // API 호출
      const response = await fetch('/api/ai/generate-todo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ input: aiInput }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '할 일 생성에 실패했습니다.');
      }

      if (!result.success || !result.data) {
        throw new Error('응답 데이터가 올바르지 않습니다.');
      }

      // AI가 생성한 데이터로 할 일 추가
      await handleAddTodo(result.data);

      // 성공 메시지
      toast.success('AI가 할 일을 생성했습니다!', {
        description: result.data.title,
      });

      // 다이얼로그 닫기 및 입력 초기화
      setIsAiDialogOpen(false);
      setAiInput('');
    } catch (error: any) {
      console.error('AI 할 일 생성 오류:', error);
      toast.error('AI 할 일 생성 실패', {
        description: error.message || '알 수 없는 오류가 발생했습니다.',
      });
    } finally {
      setIsAiGenerating(false);
    }
  };

  const handleAiSummary = async (period: 'today' | 'week' = summaryPeriod) => {
    if (!userId || todos.length === 0) {
      toast.error('요약 오류', {
        description: '할 일이 없어 요약할 수 없습니다.',
      });
      return;
    }

    try {
      setIsSummaryLoading(true);
      setSummaryPeriod(period);

      // 기간별 할 일 필터링
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(todayStart);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // 이번 주 일요일

      let filteredTodos = todos;
      if (period === 'today') {
        filteredTodos = todos.filter((todo) => {
          const dueDate = new Date(todo.due_date);
          return dueDate >= todayStart;
        });
      } else {
        // 이번 주 할 일
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);
        filteredTodos = todos.filter((todo) => {
          const dueDate = new Date(todo.due_date);
          return dueDate >= weekStart && dueDate < weekEnd;
        });
      }

      if (filteredTodos.length === 0) {
        toast.info('요약 정보 없음', {
          description: period === 'today' 
            ? '오늘 등록된 할 일이 없습니다.' 
            : '이번 주 등록된 할 일이 없습니다.',
        });
        setSummaryData(null);
        return;
      }

      // API 호출
      const response = await fetch('/api/ai/summarize-todos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          todos: filteredTodos,
          period,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '요약 생성에 실패했습니다.');
      }

      if (!result.success || !result.data) {
        throw new Error('응답 데이터가 올바르지 않습니다.');
      }

      setSummaryData(result.data);
      toast.success('AI 요약이 완료되었습니다!');
    } catch (error: any) {
      console.error('AI 요약 오류:', error);
      toast.error('AI 요약 실패', {
        description: error.message || '알 수 없는 오류가 발생했습니다.',
      });
      setSummaryData(null);
    } finally {
      setIsSummaryLoading(false);
    }
  };

  const filteredTodos = getFilteredAndSortedTodos();
  const stats = {
    total: todos.length,
    completed: todos.filter((t) => t.completed).length,
    inProgress: todos.filter((t) => !t.completed && new Date(t.due_date) >= new Date()).length,
    overdue: todos.filter((t) => !t.completed && new Date(t.due_date) < new Date()).length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50/50 via-white to-violet-50/50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-lg dark:bg-gray-950/80">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
              AI To-Do
            </h1>
          </div>
          
          <UserMenu />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard label="전체" value={stats.total} color="blue" />
          <StatCard label="완료" value={stats.completed} color="green" />
          <StatCard label="진행중" value={stats.inProgress} color="yellow" />
          <StatCard label="지연" value={stats.overdue} color="red" />
        </div>

        {/* AI Actions */}
        <div className="flex flex-wrap gap-3 mb-6">
          <Button
            onClick={() => setIsAiDialogOpen(true)}
            className="gap-2 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600"
          >
            <Sparkles className="h-4 w-4" />
            AI로 할 일 생성
          </Button>
        </div>

        {/* AI 요약 및 분석 섹션 */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-violet-500" />
              AI 요약 및 분석
            </CardTitle>
            <CardDescription>
              할 일 목록을 분석하여 요약과 인사이트를 제공합니다
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs
              defaultValue="today"
              onValueChange={(value) => {
                const period = value as 'today' | 'week';
                setSummaryPeriod(period);
                if (summaryData) {
                  handleAiSummary(period);
                }
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <TabsList>
                  <TabsTrigger value="today">오늘의 요약</TabsTrigger>
                  <TabsTrigger value="week">이번주 요약</TabsTrigger>
                </TabsList>
                <Button
                  onClick={() => handleAiSummary(summaryPeriod)}
                  disabled={isSummaryLoading || todos.length === 0}
                  className="gap-2"
                >
                  {isSummaryLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      분석 중...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      AI 요약
                    </>
                  )}
                </Button>
              </div>

              <TabsContent value="today" className="mt-4">
                {isSummaryLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center space-y-4">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto text-violet-500" />
                      <p className="text-muted-foreground">오늘의 할 일을 분석하고 있습니다...</p>
                    </div>
                  </div>
                ) : summaryData && summaryPeriod === 'today' ? (
                  <SummaryContent data={summaryData} />
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>AI 요약 버튼을 클릭하여 오늘의 할 일을 분석해보세요.</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="week" className="mt-4">
                {isSummaryLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center space-y-4">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto text-violet-500" />
                      <p className="text-muted-foreground">이번 주 할 일을 분석하고 있습니다...</p>
                    </div>
                  </div>
                ) : summaryData && summaryPeriod === 'week' ? (
                  <SummaryContent data={summaryData} />
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>AI 요약 버튼을 클릭하여 이번 주 할 일을 분석해보세요.</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Search and Filters */}
        <div className="bg-white dark:bg-gray-900 rounded-xl p-6 shadow-sm border mb-6">
          <div className="flex flex-col gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="할 일 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Filters and Sort */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Select value={filterPriority} onValueChange={setFilterPriority}>
                <SelectTrigger>
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    <SelectValue placeholder="우선순위" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">모든 우선순위</SelectItem>
                  <SelectItem value="high">높음</SelectItem>
                  <SelectItem value="medium">중간</SelectItem>
                  <SelectItem value="low">낮음</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="카테고리" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">모든 카테고리</SelectItem>
                  <SelectItem value="업무">업무</SelectItem>
                  <SelectItem value="개인">개인</SelectItem>
                  <SelectItem value="학습">학습</SelectItem>
                  <SelectItem value="건강">건강</SelectItem>
                  <SelectItem value="기타">기타</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="상태" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">모든 상태</SelectItem>
                  <SelectItem value="in_progress">진행중</SelectItem>
                  <SelectItem value="completed">완료</SelectItem>
                  <SelectItem value="overdue">지연</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger>
                  <div className="flex items-center gap-2">
                    <SortAsc className="h-4 w-4" />
                    <SelectValue placeholder="정렬" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created_date">생성일순</SelectItem>
                  <SelectItem value="due_date">마감일순</SelectItem>
                  <SelectItem value="priority">우선순위순</SelectItem>
                  <SelectItem value="title">제목순</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Todo List */}
        {isLoading && todos.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-4">
              <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-muted-foreground">할 일 목록을 불러오는 중...</p>
            </div>
          </div>
        ) : (
          <TodoList
            todos={filteredTodos}
            onToggleComplete={handleToggleComplete}
            onEdit={handleEdit}
            onDelete={handleDeleteClick}
            onViewDetail={handleViewDetail}
          />
        )}

        {/* Floating Add Button */}
        <Button
          onClick={() => setIsAddDialogOpen(true)}
          size="lg"
          className="fixed bottom-8 right-8 h-14 w-14 rounded-full shadow-2xl bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600"
        >
          <Plus className="h-6 w-6" />
        </Button>
      </main>

      {/* Add Todo Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>새 할 일 추가</DialogTitle>
            <DialogDescription>
              할 일의 상세 정보를 입력하세요
            </DialogDescription>
          </DialogHeader>
          <TodoForm
            onSubmit={handleAddTodo}
            onCancel={() => setIsAddDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Todo Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>할 일 수정</DialogTitle>
            <DialogDescription>
              할 일의 정보를 수정하세요
            </DialogDescription>
          </DialogHeader>
          <TodoForm
            todo={editingTodo}
            onSubmit={handleEditTodo}
            onCancel={() => {
              setIsEditDialogOpen(false);
              setEditingTodo(undefined);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* AI Generation Dialog */}
      <Dialog open={isAiDialogOpen} onOpenChange={setIsAiDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-violet-500" />
              AI로 할 일 생성
            </DialogTitle>
            <DialogDescription>
              자연어로 입력하면 AI가 구조화된 할 일로 변환합니다
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Input
                placeholder='예: "내일 오전 10시에 팀 회의 준비"'
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                className="text-lg"
              />
              <p className="text-sm text-muted-foreground">
                💡 날짜, 시간, 우선순위를 포함해서 입력하면 더 정확해요
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsAiDialogOpen(false);
                  setAiInput('');
                }}
                disabled={isAiGenerating}
              >
                취소
              </Button>
              <Button
                onClick={handleAiGenerate}
                disabled={!aiInput.trim() || isAiGenerating}
                className="gap-2"
              >
                {isAiGenerating ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    생성 중...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    생성하기
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteTodoId !== null} onOpenChange={(open) => !open && setDeleteTodoId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>할 일 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              정말로 이 할 일을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTodoId && handleDeleteTodo(deleteTodoId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Todo Detail Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-violet-500" />
              할 일 상세 정보
            </DialogTitle>
            <DialogDescription>
              할 일의 상세 정보와 완료를 위한 팁을 확인하세요
            </DialogDescription>
          </DialogHeader>
          
          {selectedTodo && (
            <div className="space-y-6">
              {/* 할 일 정보 */}
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-lg mb-2">{selectedTodo.title}</h3>
                  {selectedTodo.description && (
                    <p className="text-muted-foreground">{selectedTodo.description}</p>
                  )}
                </div>
                
                <div className="flex flex-wrap gap-2">
                  <Badge className={selectedTodo.priority === 'high' ? 'bg-red-500' : selectedTodo.priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'}>
                    {selectedTodo.priority === 'high' ? '높음' : selectedTodo.priority === 'medium' ? '중간' : '낮음'}
                  </Badge>
                  <Badge variant="outline">{selectedTodo.category}</Badge>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {format(new Date(selectedTodo.due_date), 'PPP', { locale: ko })}
                    </span>
                  </div>
                  {selectedTodo.completed && (
                    <Badge variant="default" className="bg-green-500">
                      완료됨
                    </Badge>
                  )}
                </div>
              </div>

              {/* 팁 받기 버튼 */}
              <div className="border-t pt-4">
                <Button
                  onClick={handleGetTips}
                  disabled={isLoadingTips}
                  className="w-full gap-2 bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600"
                >
                  {isLoadingTips ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      팁 생성 중...
                    </>
                  ) : (
                    <>
                      <Lightbulb className="h-4 w-4" />
                      팁 받기
                    </>
                  )}
                </Button>
              </div>

              {/* 팁 및 웹사이트 표시 */}
              {todoTips && (
                <div className="space-y-6 border-t pt-6">
                  {/* 팁 목록 */}
                  {todoTips.tips.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                        <Lightbulb className="h-5 w-5 text-yellow-500" />
                        완료를 위한 팁
                      </h3>
                      <ul className="space-y-3">
                        {todoTips.tips.map((tip, idx) => (
                          <li
                            key={idx}
                            className="flex items-start gap-3 p-4 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200 dark:border-yellow-800"
                          >
                            <span className="text-yellow-600 dark:text-yellow-400 font-bold mt-0.5">
                              {idx + 1}.
                            </span>
                            <span className="text-foreground flex-1">{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* 웹사이트 추천 */}
                  {todoTips.websites.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                        <ExternalLink className="h-5 w-5 text-blue-500" />
                        추천 웹사이트
                      </h3>
                      <div className="space-y-3">
                        {todoTips.websites.map((website, idx) => (
                          <a
                            key={idx}
                            href={website.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-950/40 transition-colors"
                          >
                            <ExternalLink className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <h4 className="font-semibold text-blue-700 dark:text-blue-300 mb-1">
                                {website.title}
                              </h4>
                              <p className="text-sm text-muted-foreground mb-2">
                                {website.description}
                              </p>
                              <p className="text-xs text-blue-600 dark:text-blue-400 truncate">
                                {website.url}
                              </p>
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                setIsDetailDialogOpen(false);
                setSelectedTodo(null);
                setTodoTips(null);
              }}
            >
              닫기
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: 'blue' | 'green' | 'yellow' | 'red';
}) {
  const colors = {
    blue: 'from-blue-500 to-cyan-500',
    green: 'from-green-500 to-emerald-500',
    yellow: 'from-yellow-500 to-orange-500',
    red: 'from-red-500 to-pink-500',
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl p-4 shadow-sm border">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
        </div>
        <div
          className={`h-12 w-12 rounded-lg bg-gradient-to-br ${colors[color]} opacity-20`}
        />
      </div>
    </div>
  );
}

function SummaryContent({
  data,
}: {
  data: {
    summary: string;
    urgentTasks: string[];
    insights: string[];
    recommendations: string[];
  };
}) {
  return (
    <div className="space-y-6">
      {/* 요약 */}
      <div className="bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-950/20 dark:to-indigo-950/20 rounded-lg p-4 border border-violet-200 dark:border-violet-800">
        <h3 className="font-semibold text-lg mb-2 text-violet-700 dark:text-violet-300">
          요약
        </h3>
        <p className="text-foreground">{data.summary}</p>
      </div>

      {/* 긴급한 할 일 */}
      {data.urgentTasks.length > 0 && (
        <div>
          <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-red-500"></span>
            긴급한 할 일
          </h3>
          <ul className="space-y-2">
            {data.urgentTasks.map((task, idx) => (
              <li
                key={idx}
                className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800"
              >
                <span className="text-red-600 dark:text-red-400 font-medium">
                  {task}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 인사이트 */}
      <div>
        <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-indigo-500" />
          인사이트
        </h3>
        <ul className="space-y-2">
          {data.insights.map((insight, idx) => (
            <li
              key={idx}
              className="flex items-start gap-3 p-3 bg-indigo-50 dark:bg-indigo-950/20 rounded-lg border border-indigo-200 dark:border-indigo-800"
            >
              <span className="text-indigo-500 mt-0.5">💡</span>
              <span className="text-foreground flex-1">{insight}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* 추천 사항 */}
      <div>
        <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-violet-500" />
          추천 사항
        </h3>
        <ul className="space-y-2">
          {data.recommendations.map((recommendation, idx) => (
            <li
              key={idx}
              className="flex items-start gap-3 p-3 bg-violet-50 dark:bg-violet-950/20 rounded-lg border border-violet-200 dark:border-violet-800"
            >
              <span className="text-violet-500 mt-0.5">✓</span>
              <span className="text-foreground flex-1">{recommendation}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
