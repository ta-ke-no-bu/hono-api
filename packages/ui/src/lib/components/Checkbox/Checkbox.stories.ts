import type { Meta, StoryObj } from '@storybook/svelte';
import Checkbox from './Checkbox.svelte';

const meta = {
  title: 'UI/Checkbox',
  component: Checkbox,
  tags: ['autodocs'],
  argTypes: {
    checked: { control: 'boolean', description: 'チェック状態' },
    label: { control: 'text', description: 'チェックボックスのラベル' },
    disabled: { control: 'boolean', description: '無効状態' },
    customClass: { control: 'text', description: '追加のCSSクラス' },
  },
} satisfies Meta<Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    checked: false,
    label: 'チェックボックス',
    disabled: false,
  },
};

export const Checked: Story = {
  args: {
    checked: true,
    label: 'チェック済み',
    disabled: false,
  },
};

export const Disabled: Story = {
  args: {
    checked: false,
    label: '無効なチェックボックス',
    disabled: true,
  },
};

export const CheckedAndDisabled: Story = {
  args: {
    checked: true,
    label: 'チェック済み（無効）',
    disabled: true,
  },
};
