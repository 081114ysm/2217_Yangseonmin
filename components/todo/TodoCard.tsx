'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar, Edit2, Trash2 } from 'lucide-react';
import { Todo } from './types';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface TodoCardProps {
  todo: Todo;
  onToggleComplete?: (id: string, completed: boolean) => void;
  onEdit?: (todo: Todo) => void;
  onDelete?: (id: string) => void;
  onViewDetail?: (todo: Todo) => void;
}

const priorityColors = {
  high: 'bg-red-500 hover:bg-red-600',
  medium: 'bg-yellow-500 hover:bg-yellow-600',
  low: 'bg-green-500 hover:bg-green-600',
};

const priorityLabels = {
  high: '높음',
  medium: '중간',
  low: '낮음',
};

export function TodoCard({ todo, onToggleComplete, onEdit, onDelete, onViewDetail }: TodoCardProps) {
  const isOverdue = !todo.completed && new Date(todo.due_date) < new Date();
  
  const handleCardClick = (e: React.MouseEvent) => {
    // 버튼이나 체크박스를 클릭한 경우는 제외
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('[role="checkbox"]')) {
      return;
    }
    onViewDetail?.(todo);
  };
  
  return (
    <Card 
      className={`${todo.completed ? 'opacity-60' : ''} ${isOverdue ? 'border-red-300' : ''} ${onViewDetail ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
      onClick={handleCardClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3 flex-1">
            <Checkbox
              checked={todo.completed}
              onCheckedChange={(checked) => 
                onToggleComplete?.(todo.id, checked as boolean)
              }
              className="mt-1"
            />
            <div className="flex-1">
              <CardTitle className={`text-lg ${todo.completed ? 'line-through' : ''}`}>
                {todo.title}
              </CardTitle>
              {todo.description && (
                <CardDescription className="mt-1">
                  {todo.description}
                </CardDescription>
              )}
            </div>
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEdit?.(todo)}
              className="h-8 w-8"
            >
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete?.(todo.id)}
              className="h-8 w-8 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={priorityColors[todo.priority]}>
            {priorityLabels[todo.priority]}
          </Badge>
          <Badge variant="outline">{todo.category}</Badge>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span className={isOverdue ? 'text-red-500 font-medium' : ''}>
              {format(new Date(todo.due_date), 'PPP', { locale: ko })}
            </span>
          </div>
          {isOverdue && (
            <Badge variant="destructive" className="ml-auto">
              지연
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

