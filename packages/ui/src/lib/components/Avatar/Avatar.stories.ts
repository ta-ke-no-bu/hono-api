import type { Meta, StoryObj } from '@storybook/svelte';
import Avatar from './Avatar.svelte';

const meta = {
  title: 'UI/Avatar',
  component: Avatar,
  tags: ['autodocs'],
  argTypes: {
    src: { control: 'text', description: '画像URL' },
    alt: { control: 'text', description: '代替テキスト' },
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg'],
      description: 'アバターのサイズ',
    },
    initials: { control: 'text', description: '画像がない場合のイニシャル' },
    customClass: { control: 'text', description: '追加のCSSクラス' },
  },
} satisfies Meta<Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithImage: Story = {
  args: {
    src: 'https://via.placeholder.com/150/FF0000/FFFFFF?text=User', // 仮の画像URL
    alt: 'ユーザー画像',
    size: 'md',
  },
};

export const WithInitials: Story = {
  args: {
    src: '', // 画像なし
    initials: 'JD',
    alt: 'John Doe',
    size: 'md',
  },
};

export const DefaultIcon: Story = {
  args: {
    src: '', // 画像なし
    initials: '', // イニシャルなし
    alt: 'デフォルトユーザー',
    size: 'md',
  },
};

export const SmallAvatar: Story = {
  args: {
    src: 'https://via.placeholder.com/50/0000FF/FFFFFF?text=S',
    alt: '小さいアバター',
    size: 'sm',
  },
};

export const LargeAvatar: Story = {
  args: {
    src: 'https://via.placeholder.com/200/008000/FFFFFF?text=L',
    alt: '大きいアバター',
    size: 'lg',
  },
};

export const ImageErrorFallback: Story = {
  args: {
    src: 'invalid-image-url', // 存在しないURLでエラーをシミュレート
    initials: 'ER',
    alt: 'エラーフォールバック',
    size: 'md',
  },
};
