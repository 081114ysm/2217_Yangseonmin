'use client';

import { Todo } from './types';
import { TodoCard } from './TodoCard';
import { Empty } from '@/components/ui/empty';
import { CheckCircle2 } from 'lucide-react';

interface TodoListProps {
  todos: Todo[];
  onToggleComplete?: (id: string, completed: boolean) => void;
  onEdit?: (todo: Todo) => void;
  onDelete?: (id: string) => void;
  onViewDetail?: (todo: Todo) => void;
}

export function TodoList({ todos, onToggleComplete, onEdit, onDelete, onViewDetail }: TodoListProps) {
  if (todos.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Empty
          icon={<CheckCircle2 className="h-12 w-12" />}
          title="할 일이 없습니다"
          description="새로운 할 일을 추가해보세요"
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {todos.map((todo) => (
        <TodoCard
          key={todo.id}
          todo={todo}
          onToggleComplete={onToggleComplete}
          onEdit={onEdit}
          onDelete={onDelete}
          onViewDetail={onViewDetail}
        />
      ))}
    </div>
  );
}

