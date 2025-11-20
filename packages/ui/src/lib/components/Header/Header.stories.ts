import type { Meta, StoryObj } from '@storybook/svelte';
import Header from './Header.svelte';

const meta = {
  title: 'UI/Header',
  component: Header,
  tags: ['autodocs'],
  argTypes: {
    logoText: { control: 'text', description: 'ロゴのテキスト' },
    logoHref: { control: 'text', description: 'ロゴのリンク先URL' },
    user: { control: 'object', description: 'ログインユーザー情報' },
    menuItems: { control: 'object', description: 'メニュー項目' },
  },
} satisfies Meta<Header>;

export default meta;

type Story = StoryObj<typeof meta>;

export const LoggedIn: Story = {
  args: {
    logoText: '管理画面',
    logoHref: '/dashboard',
    user: { email: 'admin@example.com' },
    menuItems: [
      { href: '/dashboard', label: 'ダッシュボード' },
      { href: '/users', label: '会員管理' },
      { href: '/contact', label: '問い合わせ' },
      { href: '/logs', label: 'ログ' },
    ],
  },
};

export const LoggedOut: Story = {
  args: {
    logoText: '管理画面',
    logoHref: '/',
    user: null,
    menuItems: [], // ログアウト時はメニューは表示されない想定
  },
};

export const CustomLogo: Story = {
  args: {
    logoText: 'My Admin',
    logoHref: '/home',
    user: { email: 'test@example.com' },
    menuItems: [
      { href: '/settings', label: '設定' },
    ],
  },
};
