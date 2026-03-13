/**
 * Vercel API Integration
 * Автоматический деплой сгенерированных проектов на Vercel
 */

const VERCEL_API_URL = 'https://api.vercel.com';

interface VercelProject {
  id: string;
  name: string;
  accountId: string;
}

interface VercelDeployment {
  id: string;
  url: string;
  readyState: 'QUEUED' | 'BUILDING' | 'READY' | 'ERROR' | 'CANCELED';
  state: string;
  createdAt: number;
}

interface DeployResult {
  success: boolean;
  deploymentId?: string;
  deploymentUrl?: string;
  projectUrl?: string;
  error?: string;
}

interface CreateProjectResult {
  success: boolean;
  projectId?: string;
  projectName?: string;
  error?: string;
}

// Получение информации о текущем пользователе Vercel
export async function getVercelUser(token: string): Promise<{ id: string; username: string; email: string } | null> {
  try {
    const response = await fetch(`${VERCEL_API_URL}/v2/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Vercel user fetch error:', response.status);
      return null;
    }

    const data = await response.json();
    return {
      id: data.user.id,
      username: data.user.username,
      email: data.user.email,
    };
  } catch (error) {
    console.error('Vercel user fetch error:', error);
    return null;
  }
}

// Создание нового проекта в Vercel
export async function createVercelProject(
  token: string,
  projectName: string,
  gitRepo?: { repo: string; type: 'github' }
): Promise<CreateProjectResult> {
  try {
    const body: Record<string, unknown> = {
      name: projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      framework: 'nextjs',
    };

    // Если есть GitHub репо, привязываем
    if (gitRepo) {
      body.gitRepository = {
        repo: gitRepo.repo,
        type: gitRepo.type,
      };
    }

    const response = await fetch(`${VERCEL_API_URL}/v10/projects`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      const errorCode = error.error?.code;
      const cleanName = projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-');

      // Проект уже существует — получаем его ID и переиспользуем
      if (errorCode === 'conflict') {
        console.log(`[vercel] Project "${cleanName}" already exists, fetching existing...`);
        try {
          const getResponse = await fetch(`${VERCEL_API_URL}/v9/projects/${cleanName}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });
          if (getResponse.ok) {
            const existingProject = await getResponse.json();
            return {
              success: true,
              projectId: existingProject.id,
              projectName: existingProject.name,
            };
          }
        } catch {
          // Fallback to error
        }
      }

      console.error('Vercel project creation error:', error);
      return { success: false, error: error.error?.message || 'Failed to create project' };
    }

    const project: VercelProject = await response.json();
    return {
      success: true,
      projectId: project.id,
      projectName: project.name,
    };
  } catch (error) {
    console.error('Vercel project creation error:', error);
    return { success: false, error: 'Failed to create Vercel project' };
  }
}

// Деплой из GitHub репозитория
export async function deployFromGitHub(
  token: string,
  projectName: string,
  gitRepoUrl: string, // формат: "owner/repo"
  branch: string = 'main'
): Promise<DeployResult> {
  try {
    const cleanProjectName = projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const [owner, repo] = gitRepoUrl.split('/');

    // Шаг 1: Создаём проект с привязкой к GitHub
    const projectResult = await createVercelProject(token, projectName, {
      repo: gitRepoUrl,
      type: 'github',
    });

    if (!projectResult.success) {
      return { success: false, error: projectResult.error };
    }

    // Шаг 2: Даём Vercel время на настройку Git-интеграции
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Шаг 3: Проверяем, запустился ли автоматический деплой
    const deploymentsResponse = await fetch(
      `${VERCEL_API_URL}/v6/deployments?projectId=${projectResult.projectId}&limit=1`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (deploymentsResponse.ok) {
      const deploymentsData = await deploymentsResponse.json();
      const existingDeployment = deploymentsData.deployments?.[0];

      if (existingDeployment) {
        console.log(`[vercel] Auto-deployment detected: ${existingDeployment.uid}`);
        return {
          success: true,
          deploymentId: existingDeployment.uid,
          deploymentUrl: `https://${existingDeployment.url}`,
          projectUrl: `https://${cleanProjectName}.vercel.app`,
        };
      }
    }

    // Шаг 4: Автоматический деплой не запустился — тригерим явно через API
    console.log(`[vercel] No auto-deployment detected, triggering explicit deploy for ${owner}/${repo}`);

    const deployResponse = await fetch(`${VERCEL_API_URL}/v13/deployments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: cleanProjectName,
        gitSource: {
          type: 'github',
          org: owner,
          repo: repo,
          ref: branch,
        },
        projectSettings: {
          framework: 'nextjs',
          installCommand: 'npm install',
          buildCommand: 'npm run build',
          outputDirectory: '.next',
        },
      }),
    });

    if (deployResponse.ok) {
      const deployment = await deployResponse.json();
      console.log(`[vercel] Explicit deployment triggered: ${deployment.id || deployment.uid}`);
      return {
        success: true,
        deploymentId: deployment.id || deployment.uid,
        deploymentUrl: `https://${deployment.url}`,
        projectUrl: `https://${cleanProjectName}.vercel.app`,
      };
    }

    // gitSource не сработал — логируем ошибку
    const deployError = await deployResponse.json().catch(() => ({}));
    console.warn(`[vercel] Explicit deploy failed (${deployResponse.status}):`, deployError);

    // Шаг 5: Финальный fallback — ждём ещё и проверяем
    await new Promise(resolve => setTimeout(resolve, 5000));

    const recheckResponse = await fetch(
      `${VERCEL_API_URL}/v6/deployments?projectId=${projectResult.projectId}&limit=1`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (recheckResponse.ok) {
      const recheckData = await recheckResponse.json();
      const lateDeployment = recheckData.deployments?.[0];
      if (lateDeployment) {
        return {
          success: true,
          deploymentId: lateDeployment.uid,
          deploymentUrl: `https://${lateDeployment.url}`,
          projectUrl: `https://${cleanProjectName}.vercel.app`,
        };
      }
    }

    // Проект создан, но деплой не запустился
    return {
      success: true,
      projectUrl: `https://${cleanProjectName}.vercel.app`,
      error: 'Project created and linked to GitHub, but deployment did not start. Try pushing a new commit or deploy manually from Vercel dashboard.',
    };
  } catch (error) {
    console.error('Vercel deployment error:', error);
    return { success: false, error: 'Failed to deploy to Vercel' };
  }
}

// Прямой деплой файлов (без GitHub)
export async function deployFiles(
  token: string,
  projectName: string,
  files: Record<string, string>
): Promise<DeployResult> {
  try {
    // Преобразуем файлы в формат Vercel API
    const vercelFiles = Object.entries(files).map(([path, content]) => ({
      file: path,
      data: content,
    }));

    const response = await fetch(`${VERCEL_API_URL}/v13/deployments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        files: vercelFiles,
        projectSettings: {
          framework: 'nextjs',
          installCommand: 'npm install',
          buildCommand: 'npm run build',
          outputDirectory: '.next',
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Vercel direct deployment error:', error);
      return { success: false, error: error.error?.message || 'Failed to deploy' };
    }

    const deployment: VercelDeployment = await response.json();

    return {
      success: true,
      deploymentId: deployment.id,
      deploymentUrl: `https://${deployment.url}`,
      projectUrl: `https://${projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-')}.vercel.app`,
    };
  } catch (error) {
    console.error('Vercel direct deployment error:', error);
    return { success: false, error: 'Failed to deploy to Vercel' };
  }
}

// Прямой деплой статических файлов (без фреймворка)
export async function deployStaticFiles(
  token: string,
  projectName: string,
  files: Record<string, string>
): Promise<DeployResult> {
  try {
    const vercelFiles = Object.entries(files).map(([filePath, content]) => ({
      file: filePath,
      data: content,
    }));

    const response = await fetch(`${VERCEL_API_URL}/v13/deployments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        files: vercelFiles,
        projectSettings: {
          framework: null,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Vercel static deployment error:', error);
      return { success: false, error: error.error?.message || 'Failed to deploy static site' };
    }

    const deployment: VercelDeployment = await response.json();

    return {
      success: true,
      deploymentId: deployment.id,
      deploymentUrl: `https://${deployment.url}`,
      projectUrl: `https://${projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-')}.vercel.app`,
    };
  } catch (error) {
    console.error('Vercel static deployment error:', error);
    return { success: false, error: 'Failed to deploy static site to Vercel' };
  }
}

// Получение статуса деплоя
export async function getDeploymentStatus(
  token: string,
  deploymentId: string
): Promise<{ status: string; url?: string; error?: string }> {
  try {
    const response = await fetch(`${VERCEL_API_URL}/v13/deployments/${deploymentId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return { status: 'ERROR', error: 'Failed to fetch deployment status' };
    }

    const deployment: VercelDeployment = await response.json();

    return {
      status: deployment.readyState,
      url: deployment.readyState === 'READY' ? `https://${deployment.url}` : undefined,
    };
  } catch (error) {
    console.error('Vercel status fetch error:', error);
    return { status: 'ERROR', error: 'Failed to fetch deployment status' };
  }
}

// Ожидание завершения деплоя
export async function waitForDeployment(
  token: string,
  deploymentId: string,
  maxWaitMs: number = 300000 // 5 минут
): Promise<{ success: boolean; url?: string; error?: string }> {
  const startTime = Date.now();
  const pollInterval = 5000; // 5 секунд

  while (Date.now() - startTime < maxWaitMs) {
    const status = await getDeploymentStatus(token, deploymentId);

    if (status.status === 'READY') {
      return { success: true, url: status.url };
    }

    if (status.status === 'ERROR' || status.status === 'CANCELED') {
      return { success: false, error: `Deployment ${status.status.toLowerCase()}` };
    }

    // Ждём перед следующей проверкой
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  return { success: false, error: 'Deployment timeout' };
}

// Удаление проекта
export async function deleteVercelProject(
  token: string,
  projectId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${VERCEL_API_URL}/v9/projects/${projectId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.error?.message || 'Failed to delete project' };
    }

    return { success: true };
  } catch (error) {
    console.error('Vercel project deletion error:', error);
    return { success: false, error: 'Failed to delete project' };
  }
}

// Список проектов пользователя
export async function listVercelProjects(
  token: string
): Promise<{ success: boolean; projects?: VercelProject[]; error?: string }> {
  try {
    const response = await fetch(`${VERCEL_API_URL}/v9/projects`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.error?.message || 'Failed to list projects' };
    }

    const data = await response.json();
    return { success: true, projects: data.projects };
  } catch (error) {
    console.error('Vercel projects list error:', error);
    return { success: false, error: 'Failed to list projects' };
  }
}
