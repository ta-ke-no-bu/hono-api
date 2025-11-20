import { PUBLIC_API_BASE_URL } from '$env/static/public';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

interface ContactFormDetail {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  successMessage?: string | null;
  autoReplyTemplate?: string | null;
  sendAutoReply: boolean;
  autoReplySubject?: string | null;
  sendAdminNotification: boolean;
  adminNotificationSubject?: string | null;
  adminNotificationTemplate?: string | null;
  isActive: boolean;
  replyToFieldSlug?: string | null;
  turnstileEnabled: boolean;
  notificationEmails: string;
  recipients: Array<{
    id: string;
    email: string;
    type: string;
  }>;
}

interface UpdateFormPayload {
  name?: string;
  slug?: string;
  description?: string;
  successMessage?: string;
  autoReplyTemplate?: string;
  sendAutoReply: boolean;
  autoReplySubject?: string;
  sendAdminNotification: boolean;
  adminNotificationSubject?: string;
  adminNotificationTemplate?: string;
  notificationEmails?: string;
  replyToFieldSlug?: string;
  isActive: boolean;
  turnstileEnabled: boolean;
}

export const load: PageServerLoad = async ({ locals, cookies, fetch, params }) => {
  if (!locals.user) {
    throw redirect(303, '/login');
  }

  const token = cookies.get('session');
  if (!token) {
    throw redirect(303, '/login');
  }

  const response = await fetch(`${PUBLIC_API_BASE_URL}/app/api/contact/forms/${params.id}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 404) {
    throw error(404, 'フォームが見つかりませんでした');
  }

  if (!response.ok) {
    throw error(response.status, 'フォーム詳細の取得に失敗しました');
  }

  const formResponse: Omit<ContactFormDetail, 'notificationEmails'> & {
    recipients: Array<{ email: string }>;
  } = await response.json();

  return {
    form: {
      ...formResponse,
      notificationEmails: formResponse.recipients.map((r) => r.email).join('\n'),
    },
  };
};

export const actions: Actions = {
  save: async ({ request, locals, cookies, fetch, params }) => {
    if (!locals.user) {
      throw redirect(303, '/login');
    }

    const token = cookies.get('session');
    if (!token) {
      throw redirect(303, '/login');
    }

    const formData = await request.formData();

    const payload: UpdateFormPayload = {
      name: String(formData.get('name') ?? '').trim() || undefined,
      slug: String(formData.get('slug') ?? '').trim() || undefined,
      description: String(formData.get('description') ?? '').trim() || undefined,
      successMessage: String(formData.get('successMessage') ?? '').trim() || undefined,
      autoReplyTemplate: String(formData.get('autoReplyTemplate') ?? '').trim() || undefined,
      sendAutoReply: formData.get('sendAutoReply') === 'on',
      autoReplySubject: String(formData.get('autoReplySubject') ?? '').trim() || undefined,
      sendAdminNotification: formData.get('sendAdminNotification') === 'on',
      adminNotificationSubject: String(formData.get('adminNotificationSubject') ?? '').trim() || undefined,
      adminNotificationTemplate: String(formData.get('adminNotificationTemplate') ?? '').trim() || undefined,
      notificationEmails: String(formData.get('notificationEmails') ?? '').trim() || undefined,
      replyToFieldSlug: String(formData.get('replyToFieldSlug') ?? '').trim() || undefined,
      isActive: formData.get('isActive') === 'on',
      turnstileEnabled: formData.get('turnstileEnabled') === 'on',
    };

    const response = await fetch(`${PUBLIC_API_BASE_URL}/app/api/contact/forms/${params.id}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const message = await response.text();
      console.error('フォーム更新に失敗しました', response.status, message);
      return fail(response.status, { message: 'フォームの更新に失敗しました' });
    }

    return { success: true };
  },
};
