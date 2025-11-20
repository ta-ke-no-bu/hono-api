import type { Meta, StoryObj } from '@storybook/svelte';
import Select from './Select.svelte';

const meta = {
  title: 'UI/Select',
  component: Select,
  tags: ['autodocs'],
  argTypes: {
    value: { control: 'text', description: '選択された値' },
    options: { control: 'object', description: '選択肢のリスト' },
    disabled: { control: 'boolean', description: '無効状態' },
    customClass: { control: 'text', description: '追加のCSSクラス' },
  },
} satisfies Meta<Select>;

export default meta;
type Story = StoryObj<typeof meta>;

const defaultOptions = [
  { label: 'Option 1', value: '1' },
  { label: 'Option 2', value: '2' },
  { label: 'Option 3', value: '3' },
];

export const Default: Story = {
  args: {
    value: '',
    options: defaultOptions,
    disabled: false,
  },
};

export const WithValue: Story = {
  args: {
    value: '2',
    options: defaultOptions,
    disabled: false,
  },
};

export const Disabled: Story = {
  args: {
    value: '1',
    options: defaultOptions,
    disabled: true,
  },
};

export const WithDisabledOption: Story = {
  args: {
    value: '',
    options: [
      { label: 'Option A', value: 'a' },
      { label: 'Option B (Disabled)', value: 'b', disabled: true },
      { label: 'Option C', value: 'c' },
    ],
    disabled: false,
  },
};
