import { PUBLIC_API_BASE_URL } from '$env/static/public';
// apps/admin/src/routes/logs/errors/[id]/+page.server.ts
import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, cookies, params, fetch }) => {
  if (!locals.user) {
    throw redirect(303, '/login');
  }

  const token = cookies.get('session');
  if (!token) {
    throw redirect(303, '/login');
  }

  try {
    const response = await fetch(`${PUBLIC_API_BASE_URL}/app/api/logs/errors/${params.id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 404) {
      throw error(404, 'エラーログが見つかりませんでした');
    }

    if (!response.ok) {
      console.error('Failed to fetch error log:', response.status, await response.text());
      throw error(response.status, 'エラーログの取得に失敗しました');
    }

    const errorLog = await response.json();

    return {
      errorLog,
    };
  } catch (e) {
    if (e instanceof Error && 'status' in e && typeof e.status === 'number') {
      throw error(e.status, e.message);
    }
    console.error('Error fetching error log:', e);
    throw error(500, 'サーバーエラーが発生しました');
  }
};
