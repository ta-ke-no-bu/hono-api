import type { Meta, StoryObj } from '@storybook/svelte';
import Input from './Input.svelte';

const meta = {
  title: 'UI/Input',
  component: Input,
  tags: ['autodocs'],
  argTypes: {
    value: { control: 'text', description: '入力値' },
    placeholder: { control: 'text', description: 'プレースホルダーテキスト' },
    disabled: { control: 'boolean', description: '無効状態' },
    customClass: { control: 'text', description: '追加のCSSクラス' },
  },
} satisfies Meta<Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    value: '',
    placeholder: 'テキストを入力してください',
    disabled: false,
  },
};

export const WithValue: Story = {
  args: {
    value: '入力済みのテキスト',
    placeholder: 'テキストを入力してください',
    disabled: false,
  },
};

export const Disabled: Story = {
  args: {
    value: '無効なテキスト',
    placeholder: 'テキストを入力してください',
    disabled: true,
  },
};
