import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// POSTリクエストでログアウトを処理
export const POST: RequestHandler = async ({ cookies }) => {
  // セッションCookieを削除
  cookies.delete('session', { path: '/' });

  // ログインページにリダイレクト
  throw redirect(303, '/login');
};
