import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

const SURVEYS_FILE = path.join(process.cwd(), 'data', 'surveys.json');

interface SurveyQuestion {
  id: number;
  category: string;
  question: string;
  type: 'single_choice' | 'multiple_choice' | 'scale' | 'open_text';
  options?: string[];
  evidence_source?: string;
  required: boolean;
}

interface Survey {
  survey_id: string;
  trend_id: string;
  title: string;
  description: string;
  questions: SurveyQuestion[];
  target_icp: string;
  created_at: string;
}

async function readSurveys(): Promise<Survey[]> {
  try {
    const data = await fs.readFile(SURVEYS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function writeSurveys(surveys: Survey[]): Promise<void> {
  const dir = path.dirname(SURVEYS_FILE);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(SURVEYS_FILE, JSON.stringify(surveys, null, 2));
}

// POST — save a new survey
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { trend_id, title, description, questions, target_icp } = body;

    if (!trend_id || !questions || !Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json(
        { error: 'trend_id and questions array are required' },
        { status: 400 }
      );
    }

    const surveys = await readSurveys();

    const survey: Survey = {
      survey_id: crypto.randomUUID(),
      trend_id,
      title: title || 'Customer Discovery Survey',
      description: description || '',
      questions,
      target_icp: target_icp || '',
      created_at: new Date().toISOString(),
    };

    surveys.push(survey);

    // Keep max 100 surveys
    if (surveys.length > 100) {
      surveys.splice(0, surveys.length - 100);
    }

    await writeSurveys(surveys);

    return NextResponse.json({
      success: true,
      survey_id: survey.survey_id,
      survey,
    });
  } catch (error) {
    console.error('[surveys] POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET — get survey by id (public, needed for survey form page)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const surveyId = searchParams.get('survey_id');

    if (!surveyId) {
      return NextResponse.json(
        { error: 'survey_id parameter required' },
        { status: 400 }
      );
    }

    const surveys = await readSurveys();
    const survey = surveys.find(s => s.survey_id === surveyId);

    if (!survey) {
      return NextResponse.json(
        { error: 'Survey not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(survey);
  } catch (error) {
    console.error('[surveys] GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
