import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { deployStaticFiles, waitForDeployment } from '@/lib/vercel';

interface LandingConfig {
  trend_id: string;
  trend_title: string;
  positioning: {
    tagline: string;
    value_proposition: string;
  };
  pain_points: string[];
  features: Array<{ title: string; description: string }>;
  pricing?: {
    model: string;
    tiers: Array<{ name: string; price: string; features: string }>;
  };
  cta_text: string;
  analytics_endpoint: string;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function generateLandingHTML(config: LandingConfig): string {
  const painPointsHtml = config.pain_points
    .slice(0, 5)
    .map(p => `
      <div class="pain-card">
        <div class="pain-icon">&#x26A0;&#xFE0F;</div>
        <p>${escapeHtml(p)}</p>
      </div>
    `).join('');

  const featuresHtml = config.features
    .slice(0, 6)
    .map((f, i) => {
      const icons = ['&#x26A1;', '&#x1F3AF;', '&#x1F4A1;', '&#x1F4C8;', '&#x1F512;', '&#x1F91D;'];
      return `
        <div class="feature-card">
          <div class="feature-icon">${icons[i] || '&#x2728;'}</div>
          <h3>${escapeHtml(f.title)}</h3>
          <p>${escapeHtml(f.description)}</p>
        </div>
      `;
    }).join('');

  const pricingHtml = config.pricing?.tiers?.length
    ? `
      <section class="pricing" id="pricing">
        <h2>Pricing</h2>
        <div class="pricing-grid">
          ${config.pricing.tiers.map((tier, i) => `
            <div class="pricing-card${i === 1 ? ' featured' : ''}">
              <h3>${escapeHtml(tier.name)}</h3>
              <div class="price">${escapeHtml(tier.price)}</div>
              <p class="tier-features">${escapeHtml(tier.features)}</p>
              <button class="cta-btn${i === 1 ? '' : ' secondary'}" onclick="scrollToSignup()">${escapeHtml(config.cta_text)}</button>
            </div>
          `).join('')}
        </div>
      </section>
    `
    : '';

  const analyticsEndpoint = escapeHtml(config.analytics_endpoint);
  const landingId = escapeHtml(config.trend_id);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(config.trend_title)}</title>
  <meta name="description" content="${escapeHtml(config.positioning.value_proposition)}">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0a0a0f;
      color: #e4e4e7;
      line-height: 1.6;
      min-height: 100vh;
    }
    .container { max-width: 1100px; margin: 0 auto; padding: 0 24px; }

    /* Hero */
    .hero {
      padding: 100px 0 80px;
      text-align: center;
      background: linear-gradient(180deg, #0a0a1a 0%, #0a0a0f 100%);
      position: relative;
      overflow: hidden;
    }
    .hero::before {
      content: '';
      position: absolute;
      top: -50%;
      left: 50%;
      transform: translateX(-50%);
      width: 600px;
      height: 600px;
      background: radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%);
      pointer-events: none;
    }
    .hero h1 {
      font-size: clamp(2rem, 5vw, 3.5rem);
      font-weight: 800;
      color: #fff;
      margin-bottom: 20px;
      position: relative;
    }
    .hero .subtitle {
      font-size: 1.2rem;
      color: #a1a1aa;
      max-width: 600px;
      margin: 0 auto 40px;
      position: relative;
    }
    .hero .cta-btn { position: relative; }

    /* CTA Button */
    .cta-btn {
      display: inline-block;
      padding: 16px 40px;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      color: #fff;
      border: none;
      border-radius: 12px;
      font-size: 1.1rem;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
      text-decoration: none;
    }
    .cta-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 30px rgba(99,102,241,0.4);
    }
    .cta-btn.secondary {
      background: transparent;
      border: 1px solid #3f3f46;
      color: #e4e4e7;
    }
    .cta-btn.secondary:hover {
      border-color: #6366f1;
      box-shadow: 0 4px 15px rgba(99,102,241,0.2);
    }

    /* Pain Points */
    .pain-section {
      padding: 80px 0;
      background: #0c0c14;
    }
    .pain-section h2 {
      text-align: center;
      font-size: 2rem;
      color: #fff;
      margin-bottom: 16px;
    }
    .pain-section .section-sub {
      text-align: center;
      color: #71717a;
      margin-bottom: 48px;
    }
    .pain-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 20px;
    }
    .pain-card {
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 12px;
      padding: 24px;
      display: flex;
      gap: 16px;
      align-items: flex-start;
    }
    .pain-icon { font-size: 1.5rem; flex-shrink: 0; }
    .pain-card p { color: #a1a1aa; font-size: 0.95rem; }

    /* Features */
    .features {
      padding: 80px 0;
    }
    .features h2 {
      text-align: center;
      font-size: 2rem;
      color: #fff;
      margin-bottom: 48px;
    }
    .features-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 24px;
    }
    .feature-card {
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 12px;
      padding: 28px;
      transition: border-color 0.2s;
    }
    .feature-card:hover { border-color: #6366f1; }
    .feature-icon { font-size: 2rem; margin-bottom: 16px; }
    .feature-card h3 {
      color: #fff;
      font-size: 1.1rem;
      margin-bottom: 8px;
    }
    .feature-card p { color: #a1a1aa; font-size: 0.9rem; }

    /* Pricing */
    .pricing {
      padding: 80px 0;
      background: #0c0c14;
    }
    .pricing h2 {
      text-align: center;
      font-size: 2rem;
      color: #fff;
      margin-bottom: 48px;
    }
    .pricing-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 24px;
      max-width: 900px;
      margin: 0 auto;
    }
    .pricing-card {
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 16px;
      padding: 32px;
      text-align: center;
    }
    .pricing-card.featured {
      border-color: #6366f1;
      position: relative;
    }
    .pricing-card h3 { color: #fff; margin-bottom: 16px; }
    .price {
      font-size: 2.5rem;
      font-weight: 800;
      color: #fff;
      margin-bottom: 16px;
    }
    .tier-features { color: #a1a1aa; font-size: 0.9rem; margin-bottom: 24px; }

    /* Signup */
    .signup-section {
      padding: 80px 0;
      text-align: center;
    }
    .signup-section h2 {
      font-size: 2rem;
      color: #fff;
      margin-bottom: 12px;
    }
    .signup-section .section-sub {
      color: #71717a;
      margin-bottom: 32px;
    }
    .signup-form {
      display: flex;
      gap: 12px;
      max-width: 480px;
      margin: 0 auto;
    }
    .signup-form input {
      flex: 1;
      padding: 14px 20px;
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 12px;
      color: #fff;
      font-size: 1rem;
      outline: none;
    }
    .signup-form input:focus { border-color: #6366f1; }
    .signup-form input::placeholder { color: #52525b; }
    .signup-success {
      display: none;
      color: #34d399;
      font-weight: 600;
      margin-top: 16px;
    }
    .signup-error {
      display: none;
      color: #f87171;
      font-size: 0.9rem;
      margin-top: 8px;
    }

    /* Footer */
    footer {
      padding: 40px 0;
      text-align: center;
      border-top: 1px solid #18181b;
      color: #52525b;
      font-size: 0.85rem;
    }

    @media (max-width: 640px) {
      .signup-form { flex-direction: column; }
      .hero { padding: 60px 0 40px; }
    }
  </style>
</head>
<body>

  <!-- Hero -->
  <section class="hero">
    <div class="container">
      <h1>${escapeHtml(config.positioning.tagline)}</h1>
      <p class="subtitle">${escapeHtml(config.positioning.value_proposition)}</p>
      <button class="cta-btn" onclick="scrollToSignup()" id="hero-cta">${escapeHtml(config.cta_text)}</button>
    </div>
  </section>

  <!-- Pain Points -->
  ${config.pain_points.length > 0 ? `
  <section class="pain-section">
    <div class="container">
      <h2>The Problem</h2>
      <p class="section-sub">Real pain points from actual users</p>
      <div class="pain-grid">
        ${painPointsHtml}
      </div>
    </div>
  </section>
  ` : ''}

  <!-- Features -->
  ${config.features.length > 0 ? `
  <section class="features">
    <div class="container">
      <h2>How We Solve It</h2>
      <div class="features-grid">
        ${featuresHtml}
      </div>
    </div>
  </section>
  ` : ''}

  <!-- Pricing -->
  ${pricingHtml}

  <!-- Signup -->
  <section class="signup-section" id="signup">
    <div class="container">
      <h2>${escapeHtml(config.cta_text)}</h2>
      <p class="section-sub">Be the first to know when we launch</p>
      <form class="signup-form" id="signupForm" onsubmit="handleSignup(event)">
        <input type="email" id="emailInput" placeholder="your@email.com" required />
        <button type="submit" class="cta-btn">Sign Up</button>
      </form>
      <p class="signup-success" id="signupSuccess">&#x2705; You're on the list! We'll notify you at launch.</p>
      <p class="signup-error" id="signupError"></p>
    </div>
  </section>

  <footer>
    <div class="container">
      <p>&copy; ${new Date().getFullYear()} ${escapeHtml(config.trend_title)}. All rights reserved.</p>
    </div>
  </footer>

  <script>
    var ANALYTICS = '${analyticsEndpoint}';
    var LANDING_ID = '${landingId}';

    // Track page view
    function trackEvent(type, meta) {
      try {
        fetch(ANALYTICS, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            landing_id: LANDING_ID,
            event_type: type,
            metadata: Object.assign({ referrer: document.referrer, user_agent: navigator.userAgent }, meta || {}),
            timestamp: new Date().toISOString()
          })
        }).catch(function() {});
      } catch(e) {}
    }

    // Page view on load
    trackEvent('page_view');

    // CTA click tracking
    document.getElementById('hero-cta').addEventListener('click', function() {
      trackEvent('click_cta');
    });

    function scrollToSignup() {
      document.getElementById('signup').scrollIntoView({ behavior: 'smooth' });
    }

    function handleSignup(e) {
      e.preventDefault();
      var email = document.getElementById('emailInput').value;
      if (!email) return;

      trackEvent('signup', { email: email });

      document.getElementById('signupForm').style.display = 'none';
      document.getElementById('signupSuccess').style.display = 'block';
      document.getElementById('signupError').style.display = 'none';
    }
  </script>
</body>
</html>`;
}

export async function POST(request: NextRequest) {
  try {
    const body: LandingConfig = await request.json();

    // Validate required fields
    if (!body.trend_id || !body.trend_title || !body.positioning?.tagline) {
      return NextResponse.json(
        { error: 'trend_id, trend_title, and positioning.tagline are required' },
        { status: 400 }
      );
    }

    // Get Vercel token from cookies
    const cookieStore = await cookies();
    const vercelToken = cookieStore.get('vercel_token')?.value;

    if (!vercelToken) {
      return NextResponse.json(
        { error: 'Vercel authentication required. Please connect your Vercel account first.' },
        { status: 401 }
      );
    }

    // Generate HTML
    const html = generateLandingHTML(body);

    // Project name from trend title
    const projectName = `landing-${body.trend_id.substring(0, 8)}`;

    // Deploy to Vercel as static files
    const deployResult = await deployStaticFiles(vercelToken, projectName, {
      'index.html': html,
    });

    if (!deployResult.success) {
      return NextResponse.json(
        { error: deployResult.error || 'Failed to deploy landing page' },
        { status: 500 }
      );
    }

    // Wait for deployment to complete (max 60 seconds)
    let landingUrl = deployResult.projectUrl || deployResult.deploymentUrl || '';
    if (deployResult.deploymentId) {
      const waitResult = await waitForDeployment(vercelToken, deployResult.deploymentId, 60000);
      if (waitResult.url) {
        landingUrl = `https://${waitResult.url}`;
      }
    }

    // Register landing in analytics
    try {
      const origin = request.headers.get('origin') || request.headers.get('host') || 'localhost:3001';
      const protocol = origin.startsWith('localhost') ? 'http' : 'https';
      const baseUrl = origin.startsWith('http') ? origin : `${protocol}://${origin}`;
      await fetch(`${baseUrl}/api/landing-analytics`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          landing_id: body.trend_id,
          trend_title: body.trend_title,
          landing_url: landingUrl,
        }),
      });
    } catch {
      // Non-critical — analytics registration can fail silently
    }

    return NextResponse.json({
      success: true,
      landing_url: landingUrl,
      deployment_id: deployResult.deploymentId,
      landing_id: body.trend_id,
      html_preview: html.substring(0, 500),
    });
  } catch (error) {
    console.error('[generate-landing] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate landing page' },
      { status: 500 }
    );
  }
}
