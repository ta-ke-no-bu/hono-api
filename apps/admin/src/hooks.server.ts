import { env as publicEnv } from '$env/dynamic/public';
import { JWT_SECRET } from '$env/static/private';
import { redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit';
import type { JWTPayload } from 'jose';
import { jwtVerify } from 'jose';

// JWTペイロードの型定義
interface JwtPayload extends JWTPayload {
  userId: number;
  email: string;
  // API側で定義されている他のプロパティ
}

function getSecretKey(): Uint8Array {
  return new TextEncoder().encode(JWT_SECRET);
}

// Cloudflare Pages等の環境変数を逐次検証し、不足時は即座に検知する
function resolvePublicConfig() {
  const apiBase = publicEnv.PUBLIC_API_BASE_URL?.trim();
  const assetBase = publicEnv.PUBLIC_ASSET_BASE_URL?.trim();

  if (!apiBase) {
    throw new Error('PUBLIC_API_BASE_URL が設定されていません。Cloudflare Pages か .env で必ず指定してください。');
  }

  return {
    apiBase,
    assetBase: assetBase ?? '',
  };
}

function generateNonce(): string {
  const workerCrypto = globalThis.crypto;
  if (workerCrypto?.randomUUID) {
    return workerCrypto.randomUUID();
  }
  if (workerCrypto?.getRandomValues) {
    const bytes = new Uint8Array(16);
    workerCrypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  return Math.random().toString(36).slice(2);
}

async function verifySession(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload as JwtPayload;
  } catch {
    return null;
  }
}

export const handle: Handle = async ({ event, resolve }) => {
  console.warn('hooks.server.ts: handle function started for', event.url.pathname);
  // CSP nonceを生成
  const nonce = generateNonce();
  event.locals.nonce = nonce; // テンプレートで利用できるようにlocalsに保存
  const { apiBase, assetBase } = resolvePublicConfig();

  // APIのベースURLをlocalsに設定
  event.locals.apiBase = apiBase;

  const token = event.cookies.get('session');
  const unprotectedRoutes = ['/login', '/register']; // 認証が不要なルート

  // 管理画面ではCSPをより緩和（認証済みエリアなのでリスクが低い）
  const isAdminArea =
    event.url.pathname.startsWith('/dashboard') ||
    event.url.pathname.startsWith('/settings') ||
    event.url.pathname.startsWith('/users') ||
    event.url.pathname.startsWith('/audit-logs') ||
    event.url.pathname.startsWith('/contact') ||
    event.url.pathname.startsWith('/posts') ||
    event.url.pathname.startsWith('/logs');

  const imageSrcDirectives = ["'self'", 'data:'] as string[];
  if (assetBase) {
    imageSrcDirectives.push(assetBase);
  }
  const imgSrcDirective = imageSrcDirectives.join(' ');

  const adminAreaCsp = `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https: https://www.google.com https://www.gstatic.com http:; style-src 'self' 'unsafe-inline'; img-src ${imgSrcDirective}; connect-src 'self' https: http:; font-src 'self' data:; object-src 'none'; media-src 'self'; frame-src 'self' https://www.google.com https://recaptcha.net https://www.gstatic.com https://challenges.cloudflare.com; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests;`;
  const defaultCsp = `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https: https://www.gstatic.com http:; style-src 'self' 'unsafe-inline'; img-src ${imgSrcDirective}; connect-src 'self' https: http:; font-src 'self' data:; object-src 'none'; media-src 'self'; frame-src 'self' https://www.google.com https://recaptcha.net https://www.gstatic.com https://challenges.cloudflare.com; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests;`;
  const cspHeader = isAdminArea ? adminAreaCsp : defaultCsp;

  event.setHeaders({
    'Content-Security-Policy': cspHeader,
  });

  // 認証が不要なルートにいる場合は何もしない
  if (unprotectedRoutes.includes(event.url.pathname)) {
    console.warn('Unprotected route:', event.url.pathname, 'Token present:', !!token);
    // ログイン済みの場合はダッシュボードにリダイレクト
    if (token) {
      console.warn('Token found, verifying session...');
      const decoded = await verifySession(token);
      if (decoded) {
        console.warn('Token valid, redirecting to dashboard');
        throw redirect(303, '/dashboard');
      }
      console.warn('Token invalid, deleting session cookie');
      // トークンが無効な場合はCookieを削除して何もしない（ログインページに留まる）
      event.cookies.delete('session', { path: '/' });
    }
    console.warn('Continuing with unprotected route');
    return resolve(event);
  }

  // ここから下は保護されたルートの処理

  // トークンがない場合はログインページにリダイレクト
  if (!token) {
    throw redirect(303, '/login');
  }

  try {
    // トークンを検証
    const decoded = await verifySession(token);
    if (!decoded) {
      throw new Error('invalid token');
    }
    // ユーザー情報を event.locals に保存
    event.locals.user = { id: decoded.userId, email: decoded.email };
    event.locals.token = token;
  } catch (error) {
    // トークンが無効な場合 (改ざん、期限切れなど)
    console.error('Invalid token:', error);
    // 不正なCookieを削除
    event.cookies.delete('session', { path: '/' });
    // ログインページにリダイレクト
    throw redirect(303, '/login');
  }

  // 認証済みの場合はリクエストを続行
  const response = await resolve(event);
  return response;
};
