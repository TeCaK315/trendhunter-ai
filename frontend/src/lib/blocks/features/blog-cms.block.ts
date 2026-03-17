import type { BlockContext, BlockResult } from '../types';
import { createDesignTokens } from '../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);
  const projectName = ctx.safe.projectName;

  return {
    'src/app/blog/page.tsx': `import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { BookOpen, ArrowRight, Calendar } from 'lucide-react';

export default async function BlogPage() {
  const supabase = await createClient();

  const { data: posts } = await supabase
    .from('blog_posts')
    .select('id, title, slug, excerpt, cover_image, created_at, author_name')
    .eq('published', true)
    .order('created_at', { ascending: false })
    .limit(20);

  return (
    <div className="min-h-screen py-16 px-6" style={{ background: '${t.bg}' }}>
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-heading font-bold mb-4" style={{ color: '${t.text}' }}>Блог</h1>
          <p style={{ color: '${t.text70}' }}>Новости, советы и аналитика от ${projectName}</p>
        </div>

        {(!posts || posts.length === 0) ? (
          <p className="text-center py-12" style={{ color: '${t.text50}' }}>Статьи скоро появятся!</p>
        ) : (
          <div className="grid gap-8">
            {posts.map((post: any) => (
              <Link
                key={post.id}
                href={\`/blog/\${post.slug}\`}
                className="group flex gap-6 p-6 rounded-2xl border transition-all hover:scale-[1.01]"
                style={{ borderColor: '${t.primary40}' }}
              >
                {post.cover_image && (
                  <div className="w-48 h-32 rounded-xl overflow-hidden flex-shrink-0 bg-gray-200">
                    <img src={post.cover_image} alt={post.title} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-heading font-bold mb-2 group-hover:opacity-80 transition-all" style={{ color: '${t.text}' }}>
                    {post.title}
                  </h2>
                  {post.excerpt && (
                    <p className="text-sm mb-3 line-clamp-2" style={{ color: '${t.text70}' }}>{post.excerpt}</p>
                  )}
                  <div className="flex items-center gap-4 text-xs" style={{ color: '${t.text50}' }}>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(post.created_at).toLocaleDateString()}
                    </span>
                    {post.author_name && <span>{post.author_name}</span>}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
`,

    'src/app/blog/[slug]/page.tsx': `import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { ArrowLeft, Calendar, User } from 'lucide-react';
import { notFound } from 'next/navigation';

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: post } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('slug', slug)
    .eq('published', true)
    .single();

  if (!post) notFound();

  return (
    <div className="min-h-screen py-16 px-6" style={{ background: '${t.bg}' }}>
      <article className="max-w-3xl mx-auto">
        <Link
          href="/blog"
          className="inline-flex items-center gap-2 text-sm mb-8 hover:opacity-70 transition-all"
          style={{ color: '${t.primary}' }}
        >
          <ArrowLeft className="w-4 h-4" /> Все статьи
        </Link>

        <h1 className="text-4xl font-heading font-bold mb-4" style={{ color: '${t.text}' }}>
          {post.title}
        </h1>

        <div className="flex items-center gap-4 text-sm mb-8" style={{ color: '${t.text50}' }}>
          <span className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            {new Date(post.created_at).toLocaleDateString()}
          </span>
          {post.author_name && (
            <span className="flex items-center gap-1">
              <User className="w-4 h-4" />
              {post.author_name}
            </span>
          )}
        </div>

        {post.cover_image && (
          <div className="rounded-2xl overflow-hidden mb-8">
            <img src={post.cover_image} alt={post.title} className="w-full h-auto" />
          </div>
        )}

        <div
          className="prose prose-lg max-w-none"
          style={{ color: '${t.text80}' }}
          dangerouslySetInnerHTML={{ __html: post.content || '' }}
        />
      </article>
    </div>
  );
}
`,
  };
}
