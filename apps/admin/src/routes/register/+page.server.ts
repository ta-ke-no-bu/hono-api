import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';

const registerSchema = z
  .object({
    email: z.string().trim().email('正しい形式のメールアドレスを入力してください。'),
    name: z.string().trim().min(1, '氏名は必須です。').max(50, '氏名は50文字以内で入力してください。'),
    password: z
      .string()
      .min(8, 'パスワードは8文字以上で入力してください。')
      .max(72, 'パスワードは72文字以内で入力してください。'),
    confirmPassword: z.string(),
  })
  .superRefine((value, ctx) => {
    if (value.password !== value.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'パスワードが一致しません。',
        path: ['confirmPassword'],
      });
    }
  });

export const load: PageServerLoad = async () => ({});

export const actions: Actions = {
  register: async ({ request, fetch, locals }) => {
    const formData = await request.formData();

    const parsed = registerSchema.safeParse({
      email: formData.get('email'),
      name: formData.get('name'),
      password: formData.get('password'),
      confirmPassword: formData.get('confirmPassword'),
    });

    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      return fail(400, {
        message: '入力内容を確認してください。',
        fieldErrors,
        values: {
          email: formData.get('email')?.toString() ?? '',
          name: formData.get('name')?.toString() ?? '',
        },
      });
    }

    const payload = {
      email: parsed.data.email,
      password: parsed.data.password,
      name: parsed.data.name,
    };

    try {
      const response = await fetch(`${locals.apiBase}/app/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let message = '登録処理に失敗しました。';
        try {
          const errorData: { message?: string } = await response.json();
          if (errorData.message) {
            message = errorData.message;
          }
        } catch (jsonError) {
          console.error('Register JSON parse error:', jsonError);
        }
        return fail(response.status, {
          message,
          values: {
            email: payload.email,
            name: payload.name,
          },
        });
      }
    } catch (error) {
      console.error('Register error:', error);
      return fail(500, {
        message: 'サーバーエラーが発生しました。',
        values: {
          email: parsed.data.email,
          name: parsed.data.name,
        },
      });
    }

    throw redirect(303, '/login?registered=1');
  },
};
