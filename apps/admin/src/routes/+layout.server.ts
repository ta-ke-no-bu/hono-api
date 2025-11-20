import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
  // hooks.server.ts で設定されたユーザー情報を取得し、
  // すべてのページで利用できるように返します。
  return {
    user: locals.user,
  };
};
