import { PUBLIC_API_BASE_URL } from '$env/static/public';
// apps/admin/src/routes/logs/errors/+page.server.ts
import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, cookies, fetch }) => {
  if (!locals.user) {
    throw redirect(303, '/login');
  }

  const token = cookies.get('session');
  if (!token) {
    throw redirect(303, '/login');
  }

  let errorLogs = [];
  try {
    const response = await fetch(`${PUBLIC_API_BASE_URL}/app/api/logs/errors`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      errorLogs = await response.json();
    } else {
      console.error('Failed to fetch error logs:', response.status, await response.text());
      throw error(response.status, 'エラーログ一覧の取得に失敗しました');
    }
  } catch (e) {
    console.error('Error fetching error logs:', e);
    throw error(500, 'サーバーエラーが発生しました');
  }

  return {
    errorLogs,
  };
};
