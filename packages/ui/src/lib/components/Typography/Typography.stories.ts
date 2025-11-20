import type { Meta, StoryObj } from '@storybook/svelte';
import Typography from './Typography.svelte';

const meta = {
  title: 'UI/Typography',
  component: Typography,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'div'],
      description: 'HTMLタグとデフォルトスタイル',
    },
    text: { control: 'text', description: '表示するテキスト' }, // 新しいargType
    color: {
      control: { type: 'select' },
      options: ['text-gray-900', 'text-blue-600', 'text-red-600', 'text-green-600'],
      description: 'テキストの色 (Tailwindクラス)',
    },
    weight: {
      control: { type: 'select' },
      options: ['font-thin', 'font-extralight', 'font-light', 'font-normal', 'font-medium', 'font-semibold', 'font-bold', 'font-extrabold', 'font-black'],
      description: 'フォントの太さ (Tailwindクラス)',
    },
    align: {
      control: { type: 'select' },
      options: ['text-left', 'text-center', 'text-right', 'text-justify'],
      description: 'テキストの配置 (Tailwindクラス)',
    },
    customClass: { control: 'text', description: '追加のCSSクラス' },
  },
} satisfies Meta<Typography>;

export default meta;
type Story = StoryObj<typeof meta>;

export const H1: Story = {
  args: {
    variant: 'h1',
    text: '見出し1 - タイトル',
  },
};

export const H2: Story = {
  args: {
    variant: 'h2',
    text: '見出し2 - サブタイトル',
  },
};

export const Paragraph: Story = {
  args: {
    variant: 'p',
    text: 'これは標準的な段落テキストです。フォントサイズや太さ、色などを変更できます。',
  },
};

export const Span: Story = {
  args: {
    variant: 'span',
    text: 'これはインラインのテキストです。',
  },
};

export const CustomColorAndWeight: Story = {
  args: {
    variant: 'p',
    color: 'text-blue-600',
    weight: 'font-bold',
    text: '青色で太字のテキスト',
  },
};

export const CenteredH3: Story = {
  args: {
    variant: 'h3',
    align: 'text-center',
    text: '中央揃えの見出し3',
  },
};
