import { PUBLIC_API_BASE_URL } from '$env/static/public';
// apps/admin/src/routes/users/[id]/+page.server.ts
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, cookies, params, fetch }) => {
  if (!locals.user) {
    throw redirect(303, '/login');
  }

  const token = cookies.get('session');
  if (!token) {
    throw redirect(303, '/login');
  }

  try {
    const response = await fetch(`${PUBLIC_API_BASE_URL}/app/api/users/${params.id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 404) {
      throw error(404, 'ユーザーが見つかりませんでした');
    }

    if (response.status === 400) {
      throw error(400, 'ユーザーIDが不正です');
    }

    if (!response.ok) {
      console.error('Failed to fetch user:', response.status, await response.text());
      throw error(response.status, 'ユーザー情報の取得に失敗しました');
    }

    const user = await response.json();

    if (!user || typeof user !== 'object') {
      throw error(500, 'ユーザー情報の取得に失敗しました');
    }

    return {
      user,
    };
  } catch (e) {
    if (e instanceof Error && 'status' in e && typeof e.status === 'number') {
      throw error(e.status, e.message);
    }
    console.error('Error fetching user:', e);
    throw error(500, 'サーバーエラーが発生しました');
  }
};

export const actions: Actions = {
  updateUser: async ({ request, cookies, params, fetch }) => {
    const data = await request.formData();
    const email = data.get('email');
    const name = data.get('name');

    if (!email || typeof email !== 'string') {
      return fail(400, { message: 'メールアドレスは必須です。' });
    }

    const token = cookies.get('session');
    if (!token) {
      throw redirect(303, '/login');
    }

    try {
      const response = await fetch(`${PUBLIC_API_BASE_URL}/app/api/users/${params.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email, name }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return fail(response.status, {
          message: errorData.message || '更新に失敗しました。',
        });
      }

      return { success: true, message: 'ユーザー情報を更新しました。' };
    } catch (error) {
      console.error('Error updating user:', error);
      return fail(500, { message: 'サーバーエラーが発生しました。' });
    }
  },

  deleteUser: async ({ cookies, params, fetch }) => {
    const token = cookies.get('session');
    if (!token) {
      throw redirect(303, '/login');
    }

    try {
      const response = await fetch(`${PUBLIC_API_BASE_URL}/app/api/users/${params.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        return fail(response.status, {
          message: errorData.message || '削除に失敗しました。',
        });
      }

      // 削除成功後、ユーザー一覧ページにリダイレクト
      throw redirect(303, '/users');
    } catch (error) {
      console.error('Error deleting user:', error);
      return fail(500, { message: 'サーバーエラーが発生しました。' });
    }
  },
};
