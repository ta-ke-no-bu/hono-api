import type { Meta, StoryObj } from '@storybook/svelte';
import Radio from './Radio.svelte';

const meta = {
  title: 'UI/Radio',
  component: Radio,
  tags: ['autodocs'],
  argTypes: {
    name: { control: 'text', description: 'ラジオボタングループ名' },
    value: { control: 'text', description: 'ラジオボタンの値' },
    label: { control: 'text', description: 'ラジオボタンのラベル' },
    checked: { control: 'boolean', description: 'チェック状態' },
    disabled: { control: 'boolean', description: '無効状態' },
    customClass: { control: 'text', description: '追加のCSSクラス' },
  },
} satisfies Meta<Radio>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    name: 'default-radio',
    value: 'option1',
    label: 'ラジオオプション1',
    checked: false,
    disabled: false,
  },
};

export const Checked: Story = {
  args: {
    name: 'checked-radio',
    value: 'option2',
    label: 'ラジオオプション2',
    checked: true,
    disabled: false,
  },
};

export const Disabled: Story = {
  args: {
    name: 'disabled-radio',
    value: 'option3',
    label: '無効なラジオオプション3',
    checked: false,
    disabled: true,
  },
};