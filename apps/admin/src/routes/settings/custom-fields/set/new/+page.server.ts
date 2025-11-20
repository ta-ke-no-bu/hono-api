import type { Cookies } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

function ensureAuthenticated(locals: App.Locals, cookies: Cookies) {
  if (!locals.user || !cookies.get('session')) {
    throw redirect(303, '/login');
  }
}

export const load: PageServerLoad = async ({ locals, cookies }) => {
  ensureAuthenticated(locals, cookies);
  throw redirect(307, '/post-settings/new');
};

export const actions: Actions = {};
