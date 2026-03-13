import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const RESPONSES_FILE = path.join(process.cwd(), 'data', 'survey-responses.json');

interface SurveyResponse {
  survey_id: string;
  token: string;
  answers: Record<string, string | string[]>;
  completed_at: string;
}

async function readResponses(): Promise<SurveyResponse[]> {
  try {
    const data = await fs.readFile(RESPONSES_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function writeResponses(responses: SurveyResponse[]): Promise<void> {
  const dir = path.dirname(RESPONSES_FILE);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(RESPONSES_FILE, JSON.stringify(responses, null, 2));
}

// CORS headers for public survey page
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

// POST — save a survey response (public, no auth)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { survey_id, token, answers } = body;

    if (!survey_id || !token || !answers || typeof answers !== 'object') {
      return NextResponse.json(
        { error: 'survey_id, token, and answers are required' },
        { status: 400, headers: corsHeaders() }
      );
    }

    const responses = await readResponses();

    // Check for duplicate (one response per token)
    const existing = responses.find(r => r.survey_id === survey_id && r.token === token);
    if (existing) {
      return NextResponse.json(
        { error: 'Response already submitted for this token' },
        { status: 409, headers: corsHeaders() }
      );
    }

    const response: SurveyResponse = {
      survey_id,
      token,
      answers,
      completed_at: new Date().toISOString(),
    };

    responses.push(response);

    // Keep max 10000 responses
    if (responses.length > 10000) {
      responses.splice(0, responses.length - 10000);
    }

    await writeResponses(responses);

    return NextResponse.json(
      { success: true },
      { headers: corsHeaders() }
    );
  } catch (error) {
    console.error('[survey-responses] POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}

// GET — get responses + aggregated stats for a survey
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

    const responses = await readResponses();
    const surveyResponses = responses.filter(r => r.survey_id === surveyId);

    // Aggregate answers per question
    const aggregated: Record<string, {
      question_id: string;
      total_answers: number;
      choice_counts: Record<string, number>;
      scale_values: number[];
      text_answers: string[];
    }> = {};

    for (const resp of surveyResponses) {
      for (const [qId, answer] of Object.entries(resp.answers)) {
        if (!aggregated[qId]) {
          aggregated[qId] = {
            question_id: qId,
            total_answers: 0,
            choice_counts: {},
            scale_values: [],
            text_answers: [],
          };
        }

        const agg = aggregated[qId];
        agg.total_answers++;

        if (Array.isArray(answer)) {
          // Multiple choice
          for (const opt of answer) {
            agg.choice_counts[opt] = (agg.choice_counts[opt] || 0) + 1;
          }
        } else if (typeof answer === 'string') {
          const numVal = parseFloat(answer);
          if (!isNaN(numVal) && answer.length <= 3) {
            // Scale value (1-10)
            agg.scale_values.push(numVal);
          } else if (Object.keys(agg.choice_counts).length > 0 || answer.length < 50) {
            // Single choice
            agg.choice_counts[answer] = (agg.choice_counts[answer] || 0) + 1;
          } else {
            // Open text
            agg.text_answers.push(answer);
          }
        }
      }
    }

    // Calculate scale averages
    const stats = Object.values(aggregated).map(agg => ({
      ...agg,
      scale_average: agg.scale_values.length > 0
        ? Math.round((agg.scale_values.reduce((a, b) => a + b, 0) / agg.scale_values.length) * 10) / 10
        : null,
    }));

    return NextResponse.json({
      survey_id: surveyId,
      total_responses: surveyResponses.length,
      responses: surveyResponses,
      aggregated: stats,
    });
  } catch (error) {
    console.error('[survey-responses] GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
