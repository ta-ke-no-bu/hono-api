import { dev } from '$app/environment';
import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';

const loginSchema = z.object({
  email: z.string().trim().email('正しい形式のメールアドレスを入力してください。'),
  password: z
    .string()
    .min(8, 'パスワードは8文字以上で入力してください。')
    .max(72, 'パスワードは72文字以内で入力してください。'),
});

export const load: PageServerLoad = async ({ url }) => {
  console.warn('+page.server.ts: load function started for', url.pathname);
  try {
    const successMessage =
      url.searchParams.get('registered') === '1' ? 'アカウント登録が完了しました。ログインしてください。' : null;

    return { successMessage };
  } catch (error) {
    console.error('+page.server.ts: load function error:', error);
    throw error; // Re-throw to ensure SvelteKit catches it
  }
};

export const actions: Actions = {
  login: async ({ request, cookies, fetch, locals }) => {
    // cookiesとfetchを引数に追加
    const formData = await request.formData();
    const rawEmail = formData.get('email');
    const rawPassword = formData.get('password');
    const rawTurnstileToken = formData.get('turnstileToken');
    console.warn('Server received rawTurnstileToken type:', typeof rawTurnstileToken);
    console.warn(
      'Server received rawTurnstileToken length:',
      typeof rawTurnstileToken === 'string' ? rawTurnstileToken.length : 0,
    );
    console.warn('Development mode:', dev);

    const parsed = loginSchema.safeParse({
      email: typeof rawEmail === 'string' ? rawEmail : '',
      password: typeof rawPassword === 'string' ? rawPassword : '',
    });

    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      return fail(400, {
        message: '入力内容を確認してください。',
        fieldErrors,
        values: { email: formData.get('email')?.toString() ?? '' },
      });
    }

    if (typeof rawTurnstileToken !== 'string') {
      return fail(400, {
        message: 'Turnstileトークンが無効です。',
        values: { email: parsed.data.email },
      });
    }

    const credentials: {
      email: string;
      password: string;
      turnstileToken: string;
    } = {
      email: parsed.data.email,
      password: parsed.data.password,
      turnstileToken: rawTurnstileToken as string,
    };

    let token: string;

    try {
      const response = await fetch(`${locals.apiBase}/app/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        let message = 'ログインに失敗しました。';
        try {
          const errorData: { message?: string } = await response.json();
          if (errorData.message) {
            message = errorData.message;
          }
        } catch (jsonError) {
          console.error('Login JSON parse error (non-ok response):', jsonError);
        }
        console.error('Login API returned non-ok response:', response.status, message);
        return fail(response.status, {
          message,
          values: { email: credentials.email },
        });
      }

      const responseData = await response.json();

      token = responseData.token;

      if (!token) {
        console.error('Token not found in API response.');
        return fail(500, {
          message: '認証トークンがAPIレスポンスに含まれていません。',
        });
      }
    } catch (error) {
      console.error('Login action network error:', error);
      return fail(500, {
        message: 'サーバーエラーが発生しました。',
        values: { email: credentials.email },
      });
    }

    // 成功したらredirect
    console.warn('Login successful, setting session cookie and redirecting to dashboard');
    console.warn(`Token received: ${token ? `${token.substring(0, 20)}...` : 'null'}`);

    cookies.set('session', token, {
      path: '/',
      httpOnly: true,
      secure: !dev,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
    });

    console.warn('Session cookie set, redirecting to /dashboard');
    throw redirect(303, '/dashboard');
  },
};
