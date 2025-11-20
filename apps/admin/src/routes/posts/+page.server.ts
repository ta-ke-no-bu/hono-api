import { PUBLIC_API_BASE_URL } from '$env/static/public';
import { extractErrorMessage } from '@lib/server/extract-error-message';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Cookies } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

function resolveSessionToken(locals: App.Locals, cookies: Cookies) {
  if (!locals.user) {
    throw redirect(303, '/login');
  }

  const token = cookies.get('session');
  if (!token) {
    throw redirect(303, '/login');
  }

  return token;
}

const DEFAULT_LIMIT = 20;
const CATEGORY_NONE_VALUE = '__NONE__';

export const load: PageServerLoad = async ({ locals, cookies, fetch, url }) => {
  if (!locals.user) {
    throw redirect(303, '/login');
  }

  const token = cookies.get('session');
  if (!token) {
    throw redirect(303, '/login');
  }

  const postSettingIdParam = (url.searchParams.get('postSettingId') ?? '').trim();
  const keywordParam = (url.searchParams.get('keyword') ?? '').trim();
  const titleParam = (url.searchParams.get('title') ?? '').trim();
  const categoryIdRaw = (url.searchParams.get('categoryId') ?? '').trim();
  const statusRaw = (url.searchParams.get('status') ?? '').trim().toUpperCase();
  const detailRaw = (url.searchParams.get('detailEnabled') ?? '').trim();

  const statusParam = ['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(statusRaw) ? statusRaw : '';
  const detailParam = detailRaw === 'true' || detailRaw === 'false' ? detailRaw : '';
  const categoryIdParam = categoryIdRaw || '';

  const postsUrl = new URL(`${PUBLIC_API_BASE_URL}/app/api/posts`);
  if (postSettingIdParam) {
    postsUrl.searchParams.set('postSettingId', postSettingIdParam);
  }
  if (keywordParam) {
    postsUrl.searchParams.set('keyword', keywordParam);
  }
  if (titleParam) {
    postsUrl.searchParams.set('title', titleParam);
  }
  if (categoryIdParam) {
    postsUrl.searchParams.set('categoryId', categoryIdParam);
  }
  if (statusParam) {
    postsUrl.searchParams.set('status', statusParam);
  }
  if (detailParam) {
    postsUrl.searchParams.set('detailEnabled', detailParam);
  }

  const [postsResponse, postSettingsResponse, categoriesResponse] = await Promise.all([
    fetch(postsUrl.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    }),
    fetch(`${PUBLIC_API_BASE_URL}/app/api/post-settings`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
    fetch(`${PUBLIC_API_BASE_URL}/app/api/categories`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
  ]);

  if (!postsResponse.ok) {
    throw error(postsResponse.status, '投稿一覧の取得に失敗しました');
  }

  const allPosts = await postsResponse.json();
  const totalCount = Array.isArray(allPosts) ? allPosts.length : 0;

  let postSettings: Array<{
    id: string;
    name: string;
    slug: string;
    status: string;
  }> = [];

  if (postSettingsResponse.ok) {
    const rawSettings = await postSettingsResponse.json();
    if (Array.isArray(rawSettings)) {
      postSettings = rawSettings.map((setting: Record<string, unknown>) => ({
        id: String(setting.id ?? ''),
        name: String(setting.name ?? ''),
        slug: String(setting.slug ?? ''),
        status: String(setting.status ?? 'INACTIVE'),
      }));
    }
  }

  let categories: Array<{
    id: string;
    name: string;
  }> = [];

  if (categoriesResponse.ok) {
    const rawCategories = await categoriesResponse.json();
    if (Array.isArray(rawCategories)) {
      categories = rawCategories.map((category: Record<string, unknown>) => ({
        id: String(category.id ?? ''),
        name: String(category.name ?? ''),
      }));
    }
  }

  const limitParam = Number(url.searchParams.get('limit') ?? DEFAULT_LIMIT);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : DEFAULT_LIMIT;
  const pageParam = Number(url.searchParams.get('page') ?? 1);
  const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1;

  const totalPages = limit > 0 ? Math.ceil(totalCount / limit) : 1;
  const safePage = totalPages > 0 ? Math.min(page, totalPages) : 1;
  const start = (safePage - 1) * limit;
  const end = start + limit;

  const pagedPosts = Array.isArray(allPosts) ? allPosts.slice(start, end) : [];

  return {
    posts: pagedPosts,
    meta: {
      page: safePage,
      limit,
      totalCount,
      totalPages,
      hasNextPage: totalPages > 0 && safePage < totalPages,
      hasPreviousPage: totalPages > 0 && safePage > 1,
    },
    filters: {
      postSettingId: postSettingIdParam ?? null,
      keyword: keywordParam || null,
      title: titleParam || null,
      categoryId: categoryIdParam || null,
      status: statusParam || null,
      detailEnabled: detailParam || null,
    },
    postSettings,
    categories,
    categoryNoneValue: CATEGORY_NONE_VALUE,
  };
};

export const actions: Actions = {
  delete: async ({ request, cookies, locals, fetch }) => {
    const token = resolveSessionToken(locals, cookies);
    const formData = await request.formData();
    const postId = formData.get('postId');
    const currentPostSettingId = formData.get('currentPostSettingId');

    if (typeof postId !== 'string' || !postId) {
      return fail(400, { message: '投稿IDが不正です。' });
    }

    try {
      const response = await fetch(`${PUBLIC_API_BASE_URL}/app/api/posts/${postId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const message = await extractErrorMessage(
          response,
          '投稿の削除に失敗しました。時間をおいて再度お試しください。',
        );
        return fail(response.status, { message });
      }

      return {
        success: true,
        message: '投稿を削除しました。',
        postSettingId: typeof currentPostSettingId === 'string' ? currentPostSettingId : null,
      };
    } catch (error) {
      console.error('投稿削除中にエラーが発生しました:', error);
      return fail(500, { message: 'サーバーエラーが発生しました。' });
    }
  },
};
