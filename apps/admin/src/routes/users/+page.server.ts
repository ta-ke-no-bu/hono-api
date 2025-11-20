import { PUBLIC_API_BASE_URL } from '$env/static/public';
// apps/admin/src/routes/users/+page.server.ts
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

  let users = [];
  try {
    const response = await fetch(`${PUBLIC_API_BASE_URL}/app/api/users`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      users = await response.json();
    } else {
      console.error('Failed to fetch users:', response.status, await response.text());
      throw error(response.status, 'ユーザー一覧の取得に失敗しました');
    }
  } catch (e) {
    if (e instanceof Error && 'status' in e && typeof e.status === 'number') {
      console.error('Error fetching users with status:', e.status, e.message);
      throw error(e.status, e.message);
    }
    console.error('Error fetching users:', e);
    throw error(500, 'サーバーエラーが発生しました');
  }

  return {
    users,
  };
};
