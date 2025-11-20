import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

interface ContactSummary {
  id: string;
  formId: string;
  formName: string;
  formSlug: string;
  displayName: string | null;
  displayEmail: string | null;
  displaySubject: string | null;
  emailStatus: string;
  createdAt: string;
  updatedAt: string;
}

const DEFAULT_LIMIT = 10;

export const load: PageServerLoad = async ({ locals, cookies, fetch, url }) => {
  // 認証済みでなければログインへリダイレクト
  if (!locals.user) {
    throw redirect(303, '/login');
  }

  const token = cookies.get('session');
  if (!token) {
    throw redirect(303, '/login');
  }

  const pageParam = url.searchParams.get('page');
  const limitParam = url.searchParams.get('limit');
  const parsedPage = Number.parseInt(pageParam ?? '1', 10);
  const parsedLimit = Number.parseInt(limitParam ?? String(DEFAULT_LIMIT), 10);
  const page = Number.isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;
  const limit = Number.isNaN(parsedLimit) || parsedLimit < 1 ? DEFAULT_LIMIT : Math.min(parsedLimit, 100);

  let contacts: ContactSummary[] = [];
  let meta = {
    page,
    limit,
    totalCount: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: page > 1,
  };

  try {
    const searchParams = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });

    const response = await fetch(`${locals.apiBase}/app/api/contact?${searchParams.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 404) {
      console.warn('問い合わせ情報が存在しませんでした');
      contacts = [];
    } else if (!response.ok) {
      console.error('Failed to fetch contacts:', response.status, await response.text());
      throw error(response.status, '問い合わせ一覧の取得に失敗しました');
    } else {
      const payload = await response.json();
      if (Array.isArray(payload?.data) && typeof payload?.meta === 'object') {
        contacts = payload.data as ContactSummary[];
        meta = {
          page: payload.meta.page ?? page,
          limit: payload.meta.limit ?? limit,
          totalCount: payload.meta.totalCount ?? payload.data.length,
          totalPages: payload.meta.totalPages ?? 0,
          hasNextPage: Boolean(payload.meta.hasNextPage),
          hasPreviousPage: Boolean(payload.meta.hasPreviousPage),
        };
      } else if (Array.isArray(payload)) {
        contacts = payload as ContactSummary[];
      }
    }
  } catch (e) {
    if (e instanceof Error && 'status' in e && typeof e.status === 'number') {
      console.error('Error fetching contacts with status:', e.status, e.message);
      throw error(e.status, '問い合わせ一覧の取得に失敗しました');
    }

    console.error('Unexpected error while fetching contacts:', e);
    throw error(500, 'サーバーエラーが発生しました');
  }

  return {
    contacts,
    meta,
  };
};
