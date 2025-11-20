import { PUBLIC_API_BASE_URL } from '$env/static/public';
import { error, fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';

const mailSettingsSchema = z.object({
  adminEmail: z.string().email('管理者メールアドレスの形式が正しくありません'),
  fromEmail: z.string().email('送信元メールアドレスの形式が正しくありません'),
});

export type MailSettings = z.infer<typeof mailSettingsSchema>;

export const load: PageServerLoad = async ({ locals, cookies, fetch, url }) => {
  if (!locals.user) {
    throw redirect(303, '/login');
  }

  const token = cookies.get('session');
  if (!token) {
    throw redirect(303, '/login');
  }

  const response = await fetch(`${PUBLIC_API_BASE_URL}/app/api/settings/contact-email`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  let mailSettings: MailSettings = { adminEmail: '', fromEmail: '' };
  let missing = false;

  if (response.ok) {
    mailSettings = await response.json();
  } else if (response.status === 404) {
    missing = true;
    console.warn('メール設定が未登録のため、空の値を返却します');
  } else {
    console.error('メール設定の取得に失敗しました', response.status);
    throw error(response.status, 'メール設定の取得に失敗しました');
  }
  const updated = url.searchParams.get('updated') === '1';

  return {
    mailSettings,
    updated,
    missing,
  };
};

export const actions: Actions = {
  default: async ({ request, locals, cookies, fetch, url }) => {
    if (!locals.user) {
      throw redirect(303, '/login');
    }

    const token = cookies.get('session');
    if (!token) {
      throw redirect(303, '/login');
    }

    const formData = await request.formData();
    const rawValues = {
      adminEmail: String(formData.get('adminEmail') ?? '').trim(),
      fromEmail: String(formData.get('fromEmail') ?? '').trim(),
    };

    const parsed = mailSettingsSchema.safeParse(rawValues);

    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      return fail(400, {
        errors: fieldErrors,
        values: rawValues,
      });
    }

    const response = await fetch(`${PUBLIC_API_BASE_URL}/app/api/settings/contact-email`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(parsed.data),
    });

    if (!response.ok) {
      const message = await response.text();
      console.error('メール設定の更新に失敗しました', response.status, message);
      return fail(response.status, {
        message: 'メール設定の更新に失敗しました',
        values: rawValues,
      });
    }

    throw redirect(303, `${url.pathname}?updated=1`);
  },
};
