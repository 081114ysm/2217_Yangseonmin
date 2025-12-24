import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function GET() {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'GOOGLE_GENERATIVE_AI_API_KEY가 설정되지 않았습니다.' },
      { status: 500 }
    );
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const result = await model.generateContent(
      '공부 집중력 향상 팁 1가지를 알려줘'
    );

    return NextResponse.json({
      tip: result.response.text(),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: '팁 가져오기 실패' },
      { status: 500 }
    );
  }
}
