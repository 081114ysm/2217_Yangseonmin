import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

// 응답 스키마 정의
const TipsSchema = z.object({
  tips: z.array(z.string()).describe('할 일을 해결하기 위한 실용적인 팁 목록'),
  websites: z.array(z.object({
    title: z.string().describe('웹사이트 제목'),
    url: z.string().url().describe('웹사이트 URL'),
    description: z.string().describe('웹사이트 설명'),
  })).describe('관련 웹사이트 추천 목록'),
});

interface Todo {
  title: string;
  description?: string;
  category: string;
  priority: 'high' | 'medium' | 'low';
}

export async function POST(request: NextRequest) {
  try {
    // API 키 확인
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GOOGLE_GENERATIVE_AI_API_KEY가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    // 요청 본문 파싱
    let body;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        { error: '잘못된 요청 형식입니다. JSON 형식으로 요청해주세요.' },
        { status: 400 }
      );
    }

    const { todo } = body;

    // 입력 검증
    if (!todo || !todo.title) {
      return NextResponse.json(
        { error: '할 일 정보가 필요합니다.' },
        { status: 400 }
      );
    }

    // Gemini API를 사용하여 팁과 웹사이트 추천 생성
    const result = await generateObject({
      model: google('gemini-2.0-flash-exp'),
      schema: TipsSchema,
      prompt: `다음 할 일을 완료하기 위한 실용적인 팁과 관련 웹사이트를 추천해주세요.

=== 할 일 정보 ===
제목: ${todo.title}
${todo.description ? `설명: ${todo.description}` : ''}
카테고리: ${todo.category}
우선순위: ${todo.priority === 'high' ? '높음' : todo.priority === 'medium' ? '중간' : '낮음'}

=== 요구사항 ===

1. tips (팁 목록) - 3-5개 제공:
   - 할 일을 효율적으로 완료하기 위한 구체적이고 실행 가능한 팁
   - 단계별 가이드나 방법론 포함
   - 한국어로 자연스럽고 친근한 문체 사용
   - 예: "작은 단계로 나누어 진행하세요. 큰 작업을 30분 단위의 작은 작업으로 분할하면 집중력이 향상됩니다."

2. websites (웹사이트 추천) - 2-4개 제공:
   - 할 일과 관련된 유용한 웹사이트나 도구
   - 실제로 존재하는 웹사이트 URL 제공 (가능한 한 정확한 URL)
   - 각 웹사이트에 대한 간단한 설명 포함
   - 한국어 사이트 우선, 없으면 영어 사이트도 가능
   - 예시:
     * 학습 관련: Coursera, Khan Academy, 생활코딩 등
     * 업무 관련: Notion, Trello, Google Workspace 등
     * 건강 관련: 운동 앱, 건강 정보 사이트 등
     * 개인 관련: 관련 커뮤니티나 정보 사이트

=== 문체 ===
- 한국어로 자연스럽고 친근한 문체 사용
- 격식적이지 않고 대화하듯이 작성
- 이모지나 특수 기호는 사용하지 않음
- 실용적이고 즉시 실행 가능한 조언 제공

=== 출력 형식 ===
{
  "tips": ["팁 1", "팁 2", "팁 3"],
  "websites": [
    {
      "title": "웹사이트 제목",
      "url": "https://example.com",
      "description": "웹사이트 설명"
    }
  ]
}`,
    });

    return NextResponse.json({
      success: true,
      data: result.object,
    });
  } catch (error: any) {
    console.error('AI 팁 생성 오류:', error);

    // Zod 검증 오류
    if (error.name === 'ZodError' || error.issues) {
      return NextResponse.json(
        {
          error: 'AI가 올바른 형식으로 응답하지 못했습니다.',
          details:
            process.env.NODE_ENV === 'development'
              ? error.message || JSON.stringify(error.issues)
              : undefined,
        },
        { status: 400 }
      );
    }

    // API 키 오류
    if (
      error.message?.includes('API key') ||
      error.message?.includes('API_KEY') ||
      error.status === 401
    ) {
      return NextResponse.json(
        { error: 'API 키가 유효하지 않습니다.' },
        { status: 401 }
      );
    }

    // Rate limit / Quota 오류
    if (
      error.message?.includes('rate limit') ||
      error.message?.includes('quota') ||
      error.message?.includes('429') ||
      error.status === 429
    ) {
      return NextResponse.json(
        {
          error: 'API 사용량 한도를 초과했습니다.',
          message: '잠시 후 다시 시도해주세요.',
        },
        { status: 429 }
      );
    }

    // 기타 오류
    return NextResponse.json(
      {
        error: '팁 생성에 실패했습니다.',
        message: '예상치 못한 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
        details:
          process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}

