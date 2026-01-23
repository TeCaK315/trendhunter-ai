'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useGitHubAuth } from '@/hooks/useGitHubAuth';
import { Shield, Users, Lightbulb, FolderKanban, TrendingUp, Calendar, Search, ChevronLeft, ChevronRight, RefreshCw, AlertCircle, User } from 'lucide-react';

// Admin users list - same as in API
const ADMIN_USERS = [
  'belousevgeniy315@gmail.com',
  'TeCaK315',
];

interface UserStats {
  id: string;
  email: string | null;
  github_username: string | null;
  name: string | null;
  avatar_url: string | null;
  provider: string;
  created_at: string;
  last_login_at: string;
  is_admin: boolean;
  total_ideas: number;
  total_projects: number;
  total_analyses: number;
  days_active: number;
}

interface Idea {
  id: string;
  user_id: string;
  trend_id: string | null;
  title: string;
  category: string;
  created_at: string;
  data: Record<string, unknown>;
  users: {
    id: string;
    email: string | null;
    github_username: string | null;
    name: string | null;
    avatar_url: string | null;
  };
}

interface Project {
  id: string;
  user_id: string;
  idea_id: string | null;
  name: string;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  users: {
    id: string;
    email: string | null;
    github_username: string | null;
    name: string | null;
    avatar_url: string | null;
  };
  ideas: {
    id: string;
    title: string;
    category: string;
  } | null;
}

interface AdminStats {
  overview: {
    totalUsers: number;
    totalIdeas: number;
    totalProjects: number;
    todayIdeas: number;
    todayProjects: number;
    todayAnalyses: number;
  };
  users: UserStats[];
  dailyStats: Array<{
    date: string;
    active_users: number;
    total_ideas: number;
    total_projects: number;
    total_analyses: number;
  }>;
  recentActivity: Array<{
    id: string;
    event_type: string;
    event_data: Record<string, unknown>;
    created_at: string;
    users: {
      email: string | null;
      github_username: string | null;
      name: string | null;
      avatar_url: string | null;
    } | null;
  }>;
}

type TabType = 'overview' | 'users' | 'ideas' | 'projects';

export default function AdminPage() {
  const { data: session } = useSession();
  const { authenticated: githubAuth, user: githubUser } = useGitHubAuth();

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination
  const [ideasPage, setIdeasPage] = useState(1);
  const [ideasTotal, setIdeasTotal] = useState(0);
  const [projectsPage, setProjectsPage] = useState(1);
  const [projectsTotal, setProjectsTotal] = useState(0);

  // Filters
  const [ideasSearch, setIdeasSearch] = useState('');
  const [ideasCategory, setIdeasCategory] = useState('');
  const [projectsSearch, setProjectsSearch] = useState('');
  const [categories, setCategories] = useState<string[]>([]);

  // Check if current user is admin
  const userEmail = session?.user?.email || null;
  const userGithub = githubUser?.login || null;
  const isAdmin = (userEmail && ADMIN_USERS.includes(userEmail)) ||
                  (userGithub && ADMIN_USERS.includes(userGithub));

  const getAuthParams = useCallback(() => {
    const params = new URLSearchParams();
    if (userEmail) params.set('adminEmail', userEmail);
    if (userGithub) params.set('adminGithub', userGithub);
    return params.toString();
  }, [userEmail, userGithub]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    if (!isAdmin) return;

    try {
      const res = await fetch(`/api/admin/stats?${getAuthParams()}`);
      const data = await res.json();

      if (data.success) {
        setStats(data.data);
      } else {
        setError(data.error);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
      setError('Failed to load statistics');
    }
  }, [isAdmin, getAuthParams]);

  // Fetch ideas
  const fetchIdeas = useCallback(async () => {
    if (!isAdmin) return;

    try {
      const params = new URLSearchParams(getAuthParams());
      params.set('page', ideasPage.toString());
      params.set('limit', '20');
      if (ideasSearch) params.set('search', ideasSearch);
      if (ideasCategory) params.set('category', ideasCategory);

      const res = await fetch(`/api/admin/ideas?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setIdeas(data.data.ideas);
        setIdeasTotal(data.data.total);
        setCategories(data.data.categories || []);
      }
    } catch (err) {
      console.error('Failed to fetch ideas:', err);
    }
  }, [isAdmin, getAuthParams, ideasPage, ideasSearch, ideasCategory]);

  // Fetch projects
  const fetchProjects = useCallback(async () => {
    if (!isAdmin) return;

    try {
      const params = new URLSearchParams(getAuthParams());
      params.set('page', projectsPage.toString());
      params.set('limit', '20');
      if (projectsSearch) params.set('search', projectsSearch);

      const res = await fetch(`/api/admin/projects?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setProjects(data.data.projects);
        setProjectsTotal(data.data.total);
      }
    } catch (err) {
      console.error('Failed to fetch projects:', err);
    }
  }, [isAdmin, getAuthParams, projectsPage, projectsSearch]);

  // Initial load
  useEffect(() => {
    async function load() {
      setLoading(true);
      await fetchStats();
      setLoading(false);
    }
    if (isAdmin) {
      load();
    } else {
      setLoading(false);
    }
  }, [isAdmin, fetchStats]);

  // Load ideas when tab changes
  useEffect(() => {
    if (activeTab === 'ideas') {
      fetchIdeas();
    }
  }, [activeTab, fetchIdeas]);

  // Load projects when tab changes
  useEffect(() => {
    if (activeTab === 'projects') {
      fetchProjects();
    }
  }, [activeTab, fetchProjects]);

  // Format date
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get user display name
  const getUserName = (user: { email: string | null; github_username: string | null; name: string | null } | null) => {
    if (!user) return 'Unknown';
    return user.name || user.email || user.github_username || 'Unknown';
  };

  // Not admin - show access denied
  if (!loading && !isAdmin) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 max-w-md text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
          <p className="text-zinc-400">
            You don&apos;t have permission to access the admin panel.
            Please sign in with an admin account.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
              <p className="text-zinc-400 text-sm">TrendHunter AI Platform</p>
            </div>
          </div>

          <button
            onClick={() => {
              fetchStats();
              if (activeTab === 'ideas') fetchIdeas();
              if (activeTab === 'projects') fetchProjects();
            }}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {[
            { id: 'overview', label: 'Overview', icon: TrendingUp },
            { id: 'users', label: 'Users', icon: Users },
            { id: 'ideas', label: 'Ideas', icon: Lightbulb },
            { id: 'projects', label: 'Projects', icon: FolderKanban },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Content */}
        {!loading && !error && (
          <>
            {/* Overview Tab */}
            {activeTab === 'overview' && stats && (
              <div className="space-y-6">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-2">
                      <Users className="w-5 h-5 text-blue-400" />
                      <span className="text-zinc-400">Total Users</span>
                    </div>
                    <p className="text-3xl font-bold text-white">{stats.overview.totalUsers}</p>
                  </div>

                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-2">
                      <Lightbulb className="w-5 h-5 text-amber-400" />
                      <span className="text-zinc-400">Total Ideas</span>
                    </div>
                    <p className="text-3xl font-bold text-white">{stats.overview.totalIdeas}</p>
                    <p className="text-sm text-green-400">+{stats.overview.todayIdeas} today</p>
                  </div>

                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-2">
                      <FolderKanban className="w-5 h-5 text-purple-400" />
                      <span className="text-zinc-400">Total Projects</span>
                    </div>
                    <p className="text-3xl font-bold text-white">{stats.overview.totalProjects}</p>
                    <p className="text-sm text-green-400">+{stats.overview.todayProjects} today</p>
                  </div>

                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-2">
                      <Calendar className="w-5 h-5 text-indigo-400" />
                      <span className="text-zinc-400">Today&apos;s Analyses</span>
                    </div>
                    <p className="text-3xl font-bold text-white">{stats.overview.todayAnalyses}</p>
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                  <h2 className="text-lg font-semibold text-white mb-4">Recent Activity</h2>
                  <div className="space-y-3">
                    {stats.recentActivity.length === 0 ? (
                      <p className="text-zinc-500 text-center py-8">No recent activity</p>
                    ) : (
                      stats.recentActivity.slice(0, 10).map(event => (
                        <div key={event.id} className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-lg">
                          <div className="w-8 h-8 bg-zinc-700 rounded-full flex items-center justify-center">
                            {event.users?.avatar_url ? (
                              <img src={event.users.avatar_url} alt="" className="w-8 h-8 rounded-full" />
                            ) : (
                              <User className="w-4 h-4 text-zinc-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white truncate">
                              {getUserName(event.users)}
                            </p>
                            <p className="text-xs text-zinc-400">{event.event_type}</p>
                          </div>
                          <span className="text-xs text-zinc-500">
                            {formatDate(event.created_at)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Users Tab */}
            {activeTab === 'users' && stats && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-zinc-800">
                        <th className="text-left p-4 text-zinc-400 font-medium">User</th>
                        <th className="text-left p-4 text-zinc-400 font-medium">Provider</th>
                        <th className="text-right p-4 text-zinc-400 font-medium">Ideas</th>
                        <th className="text-right p-4 text-zinc-400 font-medium">Projects</th>
                        <th className="text-right p-4 text-zinc-400 font-medium">Days Active</th>
                        <th className="text-left p-4 text-zinc-400 font-medium">Last Login</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.users.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-12 text-zinc-500">
                            No users yet
                          </td>
                        </tr>
                      ) : (
                        stats.users.map(user => (
                          <tr key={user.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                {user.avatar_url ? (
                                  <img src={user.avatar_url} alt="" className="w-10 h-10 rounded-full" />
                                ) : (
                                  <div className="w-10 h-10 bg-zinc-700 rounded-full flex items-center justify-center">
                                    <User className="w-5 h-5 text-zinc-400" />
                                  </div>
                                )}
                                <div>
                                  <p className="text-white font-medium flex items-center gap-2">
                                    {user.name || 'No name'}
                                    {user.is_admin && (
                                      <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded">
                                        Admin
                                      </span>
                                    )}
                                  </p>
                                  <p className="text-sm text-zinc-400">
                                    {user.email || user.github_username}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="p-4">
                              <span className={`px-2 py-1 rounded text-xs ${
                                user.provider === 'google'
                                  ? 'bg-blue-500/20 text-blue-400'
                                  : 'bg-zinc-700 text-zinc-300'
                              }`}>
                                {user.provider}
                              </span>
                            </td>
                            <td className="p-4 text-right text-white">{user.total_ideas}</td>
                            <td className="p-4 text-right text-white">{user.total_projects}</td>
                            <td className="p-4 text-right text-white">{user.days_active}</td>
                            <td className="p-4 text-zinc-400 text-sm">
                              {formatDate(user.last_login_at)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Ideas Tab */}
            {activeTab === 'ideas' && (
              <div className="space-y-4">
                {/* Filters */}
                <div className="flex flex-wrap gap-3">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                      type="text"
                      placeholder="Search ideas..."
                      value={ideasSearch}
                      onChange={e => {
                        setIdeasSearch(e.target.value);
                        setIdeasPage(1);
                      }}
                      className="w-full pl-10 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <select
                    value={ideasCategory}
                    onChange={e => {
                      setIdeasCategory(e.target.value);
                      setIdeasPage(1);
                    }}
                    className="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">All Categories</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                {/* Ideas Table */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-zinc-800">
                          <th className="text-left p-4 text-zinc-400 font-medium">Title</th>
                          <th className="text-left p-4 text-zinc-400 font-medium">Category</th>
                          <th className="text-left p-4 text-zinc-400 font-medium">User</th>
                          <th className="text-left p-4 text-zinc-400 font-medium">Created</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ideas.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="text-center py-12 text-zinc-500">
                              No ideas found
                            </td>
                          </tr>
                        ) : (
                          ideas.map(idea => (
                            <tr key={idea.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                              <td className="p-4">
                                <p className="text-white font-medium">{idea.title}</p>
                              </td>
                              <td className="p-4">
                                <span className="px-2 py-1 bg-indigo-500/20 text-indigo-400 rounded text-xs">
                                  {idea.category}
                                </span>
                              </td>
                              <td className="p-4">
                                <div className="flex items-center gap-2">
                                  {idea.users?.avatar_url ? (
                                    <img src={idea.users.avatar_url} alt="" className="w-6 h-6 rounded-full" />
                                  ) : (
                                    <div className="w-6 h-6 bg-zinc-700 rounded-full flex items-center justify-center">
                                      <User className="w-3 h-3 text-zinc-400" />
                                    </div>
                                  )}
                                  <span className="text-sm text-zinc-400">
                                    {getUserName(idea.users)}
                                  </span>
                                </div>
                              </td>
                              <td className="p-4 text-zinc-400 text-sm">
                                {formatDate(idea.created_at)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {ideasTotal > 20 && (
                    <div className="flex items-center justify-between p-4 border-t border-zinc-800">
                      <p className="text-sm text-zinc-400">
                        Showing {(ideasPage - 1) * 20 + 1} - {Math.min(ideasPage * 20, ideasTotal)} of {ideasTotal}
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setIdeasPage(p => Math.max(1, p - 1))}
                          disabled={ideasPage === 1}
                          className="p-2 bg-zinc-800 rounded-lg text-zinc-400 hover:bg-zinc-700 disabled:opacity-50"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setIdeasPage(p => p + 1)}
                          disabled={ideasPage * 20 >= ideasTotal}
                          className="p-2 bg-zinc-800 rounded-lg text-zinc-400 hover:bg-zinc-700 disabled:opacity-50"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Projects Tab */}
            {activeTab === 'projects' && (
              <div className="space-y-4">
                {/* Filters */}
                <div className="flex flex-wrap gap-3">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                      type="text"
                      placeholder="Search projects..."
                      value={projectsSearch}
                      onChange={e => {
                        setProjectsSearch(e.target.value);
                        setProjectsPage(1);
                      }}
                      className="w-full pl-10 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* Projects Table */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-zinc-800">
                          <th className="text-left p-4 text-zinc-400 font-medium">Project</th>
                          <th className="text-left p-4 text-zinc-400 font-medium">Status</th>
                          <th className="text-left p-4 text-zinc-400 font-medium">User</th>
                          <th className="text-left p-4 text-zinc-400 font-medium">Based on</th>
                          <th className="text-left p-4 text-zinc-400 font-medium">Created</th>
                        </tr>
                      </thead>
                      <tbody>
                        {projects.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="text-center py-12 text-zinc-500">
                              No projects found
                            </td>
                          </tr>
                        ) : (
                          projects.map(project => (
                            <tr key={project.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                              <td className="p-4">
                                <p className="text-white font-medium">{project.name}</p>
                                {project.description && (
                                  <p className="text-sm text-zinc-400 truncate max-w-[300px]">
                                    {project.description}
                                  </p>
                                )}
                              </td>
                              <td className="p-4">
                                <span className={`px-2 py-1 rounded text-xs ${
                                  project.status === 'active' ? 'bg-green-500/20 text-green-400' :
                                  project.status === 'completed' ? 'bg-blue-500/20 text-blue-400' :
                                  project.status === 'archived' ? 'bg-zinc-700 text-zinc-400' :
                                  'bg-amber-500/20 text-amber-400'
                                }`}>
                                  {project.status}
                                </span>
                              </td>
                              <td className="p-4">
                                <div className="flex items-center gap-2">
                                  {project.users?.avatar_url ? (
                                    <img src={project.users.avatar_url} alt="" className="w-6 h-6 rounded-full" />
                                  ) : (
                                    <div className="w-6 h-6 bg-zinc-700 rounded-full flex items-center justify-center">
                                      <User className="w-3 h-3 text-zinc-400" />
                                    </div>
                                  )}
                                  <span className="text-sm text-zinc-400">
                                    {getUserName(project.users)}
                                  </span>
                                </div>
                              </td>
                              <td className="p-4">
                                {project.ideas ? (
                                  <span className="text-sm text-zinc-400">{project.ideas.title}</span>
                                ) : (
                                  <span className="text-sm text-zinc-500">-</span>
                                )}
                              </td>
                              <td className="p-4 text-zinc-400 text-sm">
                                {formatDate(project.created_at)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {projectsTotal > 20 && (
                    <div className="flex items-center justify-between p-4 border-t border-zinc-800">
                      <p className="text-sm text-zinc-400">
                        Showing {(projectsPage - 1) * 20 + 1} - {Math.min(projectsPage * 20, projectsTotal)} of {projectsTotal}
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setProjectsPage(p => Math.max(1, p - 1))}
                          disabled={projectsPage === 1}
                          className="p-2 bg-zinc-800 rounded-lg text-zinc-400 hover:bg-zinc-700 disabled:opacity-50"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setProjectsPage(p => p + 1)}
                          disabled={projectsPage * 20 >= projectsTotal}
                          className="p-2 bg-zinc-800 rounded-lg text-zinc-400 hover:bg-zinc-700 disabled:opacity-50"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
