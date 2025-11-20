import { PUBLIC_API_BASE_URL } from '$env/static/public';
import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

interface AuditLog {
  id: number;
  createdAt: string;
  userId: number | null;
  eventType: string;
  ipAddress: string | null;
  userAgent: string | null;
  details: string | null;
}

interface AuditLogResponse {
  logs: AuditLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const load: PageServerLoad = async ({ locals, cookies, url }) => {
  // 認証済みでなければログインへリダイレクト
  if (!locals.user) {
    throw redirect(303, '/login');
  }

  const token = cookies.get('session');
  if (!token) {
    throw redirect(303, '/login');
  }

  // URLパラメータからページを取得、デフォルトは1
  const page = Number.parseInt(url.searchParams.get('page') || '1', 10);
  const limit = Number.parseInt(url.searchParams.get('limit') || '10', 10);

  try {
    const response = await fetch(`${PUBLIC_API_BASE_URL}/app/api/audit-logs?page=${page}&limit=${limit}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 404 || response.status >= 500) {
      // API未実装またはエラーの場合
      return {
        auditLogs: [],
        totalPages: 0,
        currentPage: page,
      };
    }

    if (!response.ok) {
      console.error('Failed to fetch audit logs:', response.status, await response.text());
      throw error(response.status, '監査ログの取得に失敗しました');
    }

    const data: AuditLogResponse = await response.json();

    return {
      auditLogs: data.logs,
      totalPages: data.totalPages,
      currentPage: data.page,
    };
  } catch (e) {
    if (e instanceof Error && 'status' in e) {
      console.error('Error fetching audit logs with status:', e.status, e.message);
      throw error(500, '監査ログの取得に失敗しました');
    }

    console.error('Unexpected error while fetching audit logs:', e);
    throw error(500, 'サーバーエラーが発生しました');
  }
};
