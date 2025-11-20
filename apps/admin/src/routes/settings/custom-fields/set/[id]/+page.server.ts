import type { Cookies } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
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

export const load: PageServerLoad = async ({ params, locals, cookies }) => {
  resolveSessionToken(locals, cookies);
  throw redirect(307, `/post-settings/${params.id}`);
};

export const actions: Actions = {};
