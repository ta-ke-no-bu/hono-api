import { PUBLIC_API_BASE_URL } from '$env/static/public';
import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

interface ErrorLog {
  id: number;
  statusCode: number | null;
  path: string | null;
  errorMessage: string;
  stackTrace: string | null;
  createdAt: string;
}

export const load: PageServerLoad = async ({ locals, cookies, fetch }) => {
  // 認証済みでなければログインへリダイレクト
  if (!locals.user) {
    throw redirect(303, '/login');
  }

  const token = cookies.get('session');
  if (!token) {
    throw redirect(303, '/login');
  }

  let errorLogs: ErrorLog[] = [];

  try {
    const response = await fetch(`${PUBLIC_API_BASE_URL}/app/api/logs/errors`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      console.error('Failed to fetch error logs overview:', response.status, await response.text());
      throw error(response.status, 'ログ情報の取得に失敗しました');
    }

    errorLogs = await response.json();
  } catch (e) {
    if (e instanceof Error && 'status' in e && typeof e.status === 'number') {
      console.error('Error fetching logs overview with status:', e.status, e.message);
      throw error(e.status, 'ログ情報の取得に失敗しました');
    }

    console.error('Unexpected error while fetching logs overview:', e);
    throw error(500, 'サーバーエラーが発生しました');
  }

  return {
    errorLogs,
  };
};
