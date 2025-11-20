import type { Meta, StoryObj } from '@storybook/svelte';
import Textarea from './Textarea.svelte';

const meta = {
  title: 'UI/Textarea',
  component: Textarea,
  tags: ['autodocs'],
  argTypes: {
    value: { control: 'text', description: '入力値' },
    placeholder: { control: 'text', description: 'プレースホルダーテキスト' },
    disabled: { control: 'boolean', description: '無効状態' },
    rows: { control: 'number', description: '表示行数' },
    customClass: { control: 'text', description: '追加のCSSクラス' },
  },
} satisfies Meta<Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    value: '',
    placeholder: 'テキストを入力してください',
    disabled: false,
    rows: 3,
  },
};

export const WithValue: Story = {
  args: {
    value: `これは入力済みのテキストです。
複数行のテキストを入力できます。`,
    placeholder: 'テキストを入力してください',
    disabled: false,
    rows: 5,
  },
};

export const Disabled: Story = {
  args: {
    value: 'このテキストエリアは無効です。',
    placeholder: 'テキストを入力してください',
    disabled: true,
    rows: 3,
  },
};