import { NextRequest, NextResponse } from 'next/server';
import { deployFromGitHub, deployFiles, getDeploymentStatus, waitForDeployment, getVercelUser } from '@/lib/vercel';

/**
 * /api/deploy
 *
 * Автоматический деплой проекта на Vercel
 *
 * Поддерживает 2 режима:
 * 1. Деплой из GitHub репозитория (mode: 'github')
 * 2. Прямой деплой файлов (mode: 'files')
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mode, project_name, github_repo, files, wait_for_completion } = body;

    // Получаем Vercel токен из cookies
    const vercelToken = request.cookies.get('vercel_token')?.value;

    if (!vercelToken) {
      return NextResponse.json(
        {
          success: false,
          error: 'Vercel token not found. Please connect your Vercel account.',
          needs_auth: true
        },
        { status: 401 }
      );
    }

    // Проверяем валидность токена
    const user = await getVercelUser(vercelToken);
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid Vercel token. Please reconnect your Vercel account.',
          needs_auth: true
        },
        { status: 401 }
      );
    }

    if (!project_name) {
      return NextResponse.json(
        { success: false, error: 'Project name is required' },
        { status: 400 }
      );
    }

    let deployResult;

    if (mode === 'github') {
      // Деплой из GitHub репозитория
      if (!github_repo) {
        return NextResponse.json(
          { success: false, error: 'GitHub repository URL is required for github mode' },
          { status: 400 }
        );
      }

      // Извлекаем owner/repo из URL
      const repoMatch = github_repo.match(/github\.com\/([^/]+\/[^/]+)/);
      if (!repoMatch) {
        return NextResponse.json(
          { success: false, error: 'Invalid GitHub repository URL' },
          { status: 400 }
        );
      }

      const repoPath = repoMatch[1].replace(/\.git$/, '');
      console.log(`Deploying from GitHub: ${repoPath}`);

      deployResult = await deployFromGitHub(vercelToken, project_name, repoPath);

    } else if (mode === 'files') {
      // Прямой деплой файлов
      if (!files || Object.keys(files).length === 0) {
        return NextResponse.json(
          { success: false, error: 'Files are required for files mode' },
          { status: 400 }
        );
      }

      console.log(`Direct deployment: ${Object.keys(files).length} files`);
      deployResult = await deployFiles(vercelToken, project_name, files);

    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid mode. Use "github" or "files"' },
        { status: 400 }
      );
    }

    if (!deployResult.success) {
      return NextResponse.json(
        { success: false, error: deployResult.error },
        { status: 500 }
      );
    }

    // Если запрошено ожидание завершения деплоя
    if (wait_for_completion && deployResult.deploymentId) {
      console.log(`Waiting for deployment ${deployResult.deploymentId} to complete...`);

      const waitResult = await waitForDeployment(vercelToken, deployResult.deploymentId, 180000); // 3 минуты

      return NextResponse.json({
        success: waitResult.success,
        deployment_id: deployResult.deploymentId,
        deployment_url: waitResult.url || deployResult.deploymentUrl,
        project_url: deployResult.projectUrl,
        status: waitResult.success ? 'READY' : 'FAILED',
        error: waitResult.error,
        deployed_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      success: true,
      deployment_id: deployResult.deploymentId,
      deployment_url: deployResult.deploymentUrl,
      project_url: deployResult.projectUrl,
      status: 'BUILDING',
      message: 'Deployment started. Check status with deployment_id.',
      deployed_at: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Deploy API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET - проверка статуса деплоя
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const deploymentId = searchParams.get('deployment_id');

    if (!deploymentId) {
      return NextResponse.json(
        { success: false, error: 'deployment_id parameter is required' },
        { status: 400 }
      );
    }

    const vercelToken = request.cookies.get('vercel_token')?.value;

    if (!vercelToken) {
      return NextResponse.json(
        { success: false, error: 'Vercel token not found', needs_auth: true },
        { status: 401 }
      );
    }

    const status = await getDeploymentStatus(vercelToken, deploymentId);

    return NextResponse.json({
      success: true,
      deployment_id: deploymentId,
      status: status.status,
      url: status.url,
      error: status.error,
    });

  } catch (error) {
    console.error('Deploy status API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
