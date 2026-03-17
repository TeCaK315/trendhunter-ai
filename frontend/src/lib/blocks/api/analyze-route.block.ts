import type { BlockContext, BlockResult } from '../types';
import { escapeForTemplate } from '../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const spec = ctx.product_spec;

  // ─── Build a DEEP, niche-specific SYSTEM_PROMPT ───
  const magicDesc = spec.magic_location?.description || '';
  const aiHint = spec.magic_location?.ai_prompt_hint ||
    'You are an expert assistant. Process the given input and produce useful output.';
  const outputFormat = spec.user_output?.output_format || 'text';
  const primaryOutput = spec.user_output?.primary_output || 'result';
  const valueProposition = spec.user_output?.value_proposition || '';

  // Build list of what the product actually does (from derived_features)
  const mustHaveFeatures = (spec.derived_features || [])
    .filter(f => f.priority === 'must_have')
    .map(f => f.feature_name);

  // ─── Build the system prompt: PRODUCT-FIRST approach ───
  // The AI must PRODUCE the product output, not analyze it
  const systemPromptParts: string[] = [];

  // 1. Identity: what this AI IS (not "analyst" — the product itself)
  systemPromptParts.push(aiHint);

  // 2. Context: what the product does
  if (magicDesc) systemPromptParts.push(`Your purpose: ${magicDesc}`);
  if (valueProposition) systemPromptParts.push(`Value you provide: ${valueProposition}`);

  // 3. Product capabilities
  if (mustHaveFeatures.length > 0) {
    systemPromptParts.push(`Your key capabilities:\n${mustHaveFeatures.map(f => `- ${f}`).join('\n')}`);
  }

  // 4. What the user expects
  if (spec.current_user_solution?.our_advantage) {
    systemPromptParts.push(`Your advantage: ${spec.current_user_solution.our_advantage}`);
  }

  // 5. OUTPUT INSTRUCTION — this is the critical part
  // Use "report" format which is flexible enough for any product output
  systemPromptParts.push(`OUTPUT INSTRUCTIONS:
You must PRODUCE the actual product output — not analyze or describe it.
For example: if you are an invoice generator, GENERATE the actual invoice.
If you are a quiz maker, CREATE actual quiz questions.
If you are a business plan generator, WRITE the actual business plan.

ALWAYS respond in English.

Return a JSON object with this structure:
{
  "title": "Title of the generated output",
  "executive_summary": "Brief 1-2 sentence summary of what was produced",
  "sections": [
    {
      "heading": "Section name",
      "content": "Detailed content for this section",
      "key_points": ["Important detail 1", "Important detail 2"]
    }
  ],
  "conclusion": "Summary or total / final note",
  "recommendations": ["Next step 1", "Next step 2"]
}

Make the sections SPECIFIC to the actual product output.
Use as many sections as needed to fully represent the result.
Be detailed, professional, and immediately useful.`);

  const safePrompt = escapeForTemplate(systemPromptParts.join('\n\n'));

  // ─── Build niche-specific demo response FUNCTION ───
  // Instead of a static response, this function uses the actual user input
  const sanitize = (s: string) => (s || '').replace(/[^\x20-\x7E]/g, '').replace(/'/g, "\\'").trim();
  const safeProjectName = sanitize(ctx.safe.projectName) || sanitize((spec as any).project_name || '') || 'Tool';
  const safePrimaryOutput = sanitize(primaryOutput) || 'result';
  const safeValueProp = sanitize(valueProposition);

  // Build niche-specific section headings from derived_features
  const featureSections = (spec.derived_features || [])
    .filter(f => f.priority === 'must_have' || f.priority === 'should_have')
    .slice(0, 4)
    .map(f => ({
      heading: sanitize(f.feature_name) || 'Details',
      description: sanitize(f.solution || f.feature_name) || 'Processing your data',
    }));

  // Get field names for building dynamic demo
  const requiredFields = spec.user_input?.required_fields || [];
  const fieldNames = requiredFields.map(f => f.name);
  const inputType = spec.user_input?.input_type || 'text';

  // ─── Build input validation from required_fields ───
  let validationCode: string;
  let userMessageBuilder: string;

  if (requiredFields.length > 1) {
    const fieldChecks = fieldNames.map(n =>
      `    if (!body['${n}']) missingFields.push('${n}');`
    ).join('\n');

    validationCode = `
    const missingFields: string[] = [];
${fieldChecks}
    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: \`Missing required fields: \${missingFields.join(', ')}\` },
        { status: 400 }
      );
    }`;

    const fieldDescriptions = requiredFields.map(f =>
      `${f.name}: \${body['${f.name}']}`
    ).join('\\n');
    userMessageBuilder = `\`Process the following input and produce the result:\\n\\n${fieldDescriptions}\``;
  } else {
    validationCode = `
    if (!input || typeof input !== 'string') {
      return NextResponse.json(
        { error: 'Input is required' },
        { status: 400 }
      );
    }`;

    if (inputType === 'url') {
      userMessageBuilder = '`Process the following page content from ${input}:\\n\\n${contentToAnalyze}`';
    } else {
      userMessageBuilder = '`Process the following input and produce the result:\\n\\n${contentToAnalyze}`';
    }
  }

  // URL fetching (only if input_type is url)
  const urlFetchCode = inputType === 'url' ? `
async function fetchPageContent(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AnalysisBot/1.0)' },
    });
    if (!res.ok) throw new Error(\`Failed to fetch: \${res.status}\`);
    const html = await res.text();
    const text = html
      .replace(/<script[^>]*>[\\s\\S]*?<\\/script>/gi, '')
      .replace(/<style[^>]*>[\\s\\S]*?<\\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\\s+/g, ' ')
      .trim();
    return text.slice(0, 8000);
  } catch (err: any) {
    throw new Error(\`Could not fetch URL content: \${err.message}\`);
  }
}
` : '';

  const urlFetchInHandler = inputType === 'url' ? `
    let contentToAnalyze = input;
    if (typeof input === 'string' && (input.startsWith('http://') || input.startsWith('https://'))) {
      try {
        contentToAnalyze = await fetchPageContent(input);
      } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
    }` : `
    const contentToAnalyze = input;`;

  // Build demo response function body based on output_format
  // This creates a DYNAMIC response using actual user input
  // Always use 'report' format for demo — matches the report-based prompt
  const demoFunctionBody = buildDemoFunctionBody('report', safeProjectName, safePrimaryOutput, safeValueProp, fieldNames, featureSections);

  return {
    'src/app/api/analyze/route.ts': `import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const dynamic = 'force-dynamic';

const DEMO_MODE = !process.env.OPENAI_API_KEY;

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

const SYSTEM_PROMPT = \`${safePrompt}\`;

// Build a contextual demo response using actual user input
function buildDemoResponse(body: Record<string, any>): Record<string, any> {
${demoFunctionBody}
}
${urlFetchCode}
export async function POST(req: NextRequest) {
  try {
    // ─── Optional auth: works with or without Supabase ───
    let userId: string | null = null;
    try {
      const { createClient } = await import('@/lib/supabase/server');
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id || null;

      if (userId) {
        try {
          const { checkUsageLimit } = await import('@/lib/usage');
          const hasCapacity = await checkUsageLimit(userId, 'analyses');
          if (!hasCapacity) {
            return NextResponse.json(
              { error: 'Usage limit reached. Please upgrade your plan.' },
              { status: 429 }
            );
          }
        } catch {}
      }
    } catch {
      // Supabase not configured — continue without auth
    }

    const body = await req.json();
    const input = body.input || body.q || '';
    ${validationCode}

    // ─── DEMO MODE: return contextual results using actual input ───
    if (DEMO_MODE) {
      await new Promise(resolve => setTimeout(resolve, 1500));

      return NextResponse.json({
        success: true,
        analysis: buildDemoResponse(body),
        output_format: 'report',
        demo: true,
      });
    }

    // ─── LIVE MODE: call OpenAI ───
    ${urlFetchInHandler}

    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: ${userMessageBuilder} },
      ],
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    const resultText = completion.choices[0]?.message?.content || '{}';

    let analysis;
    try {
      analysis = JSON.parse(resultText);
    } catch {
      analysis = { summary: resultText };
    }

    // ─── Save to DB if Supabase is available ───
    if (userId) {
      try {
        const { createClient } = await import('@/lib/supabase/server');
        const supabase = await createClient();
        const { incrementUsage } = await import('@/lib/usage');

        await incrementUsage(userId, 'analyses');

        await supabase.from('analyses').insert({
          user_id: userId,
          input: typeof input === 'string' ? input : JSON.stringify(body),
          input_type: '${inputType}',
          result: analysis,
          tokens_used: completion.usage?.total_tokens || 0,
          created_at: new Date().toISOString(),
        });

        await supabase
          .from('profiles')
          .update({ last_analysis_at: new Date().toISOString() })
          .eq('id', userId);
      } catch {
        // DB save failed — not critical, analysis still returned
      }
    }

    return NextResponse.json({
      success: true,
      analysis,
      output_format: 'report',
    });
  } catch (error: any) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      { error: error.message || 'Analysis failed' },
      { status: 500 }
    );
  }
}
`,
  };
}

// Helper: build the body of buildDemoResponse() function
// Uses actual user input fields to create contextual, product-relevant demo data
function buildDemoFunctionBody(
  outputFormat: string,
  projectName: string,
  primaryOutput: string,
  valueProp: string,
  fieldNames: string[],
  featureSections: { heading: string; description: string }[]
): string {
  // Create a summary line that uses actual input
  const inputSummary = fieldNames.length > 0
    ? fieldNames.map(f => `\${body['${f}'] || 'N/A'}`).join(', ')
    : `\${body.input || body.q || 'your input'}`;

  const inputLabel = fieldNames.length > 0
    ? fieldNames.map(f => `${f}: \${body['${f}'] || 'N/A'}`).join(' | ')
    : `Input: \${body.input || body.q || 'your data'}`;

  // Build product-specific sections from derived_features
  // Each section heading comes from actual product features, not generic "Results"
  let sectionsCode: string;

  if (featureSections.length >= 2) {
    // Use real product features as section headings
    const sectionEntries = featureSections.map((fs, i) => {
      // Build contextual key_points based on field names
      const keyPoints = fieldNames.length > 0
        ? fieldNames.slice(0, 3).map(f => `\`\${body['${f}'] ? '${f}: ' + body['${f}'] : '${f}: pending'}\``)
        : [`'Data processed successfully'`, `'Quality checks passed'`, `'Ready for review'`];

      return `      {
        heading: '${fs.heading}',
        content: \`${fs.description}. Based on your input: ${inputLabel}.\`,
        key_points: [${keyPoints.join(', ')}],
      }`;
    });
    sectionsCode = `[\n${sectionEntries.join(',\n')}\n    ]`;
  } else {
    // Fallback: use field names to generate sections
    if (fieldNames.length >= 2) {
      const sectionEntries = fieldNames.slice(0, 4).map(f => {
        return `      {
        heading: '${f.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}',
        content: \`${f}: \${body['${f}'] || 'Not provided'}. This information has been processed and validated.\`,
        key_points: [\`Value: \${body['${f}'] || 'N/A'}\`, 'Validated successfully', 'Included in final output'],
      }`;
      });
      sectionsCode = `[\n${sectionEntries.join(',\n')}\n    ]`;
    } else {
      sectionsCode = `[
      {
        heading: 'Overview',
        content: \`Processed your request: ${inputLabel}.\`,
        key_points: ['All data validated', 'Processing complete', 'Results ready'],
      },
      {
        heading: 'Details',
        content: \`Your ${primaryOutput} has been generated based on the provided information.\`,
        key_points: ['Output meets quality standards', 'All parameters considered', 'Professional formatting applied'],
      },
    ]`;
    }
  }

  // Always use report format — it's universal
  return `  const inputSummary = \`${inputSummary}\`;
  return {
    title: \`${projectName} — \${inputSummary}\`,
    executive_summary: \`Your ${primaryOutput} has been generated based on: \${inputSummary}.${valueProp ? ' ' + valueProp + '.' : ''} This is a demo preview — connect your OpenAI API key for AI-powered results.\`,
    sections: ${sectionsCode},
    conclusion: \`Your ${primaryOutput} for \${inputSummary} is ready. Connect an OpenAI API key in your environment variables for full AI-powered generation.\`,
    recommendations: ['Add OPENAI_API_KEY to your environment variables for real AI output', 'Review all sections above', 'Export or share your results'],
  };`;
}
