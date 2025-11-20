import type { Meta, StoryObj } from '@storybook/svelte';
import Button from './Button.svelte';

const meta = {
  title: 'UI/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    label: { control: 'text' },
    size: {
      control: { type: 'select' },
      options: ['small', 'medium', 'large'],
      description: 'ボタンのサイズ',
    },
    variant: {
      control: { type: 'select' },
      options: ['default', 'primary', 'secondary', 'danger'],
      description: 'ボタンのバリアント（色）',
    },
    disabled: {
      control: { type: 'boolean' },
      description: 'ボタンを無効にするかどうか',
    },
  },
} satisfies Meta<Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: 'Default Button',
    size: 'medium',
    variant: 'default',
    disabled: false,
  },
};

export const Primary: Story = {
  args: {
    label: 'Primary Button',
    size: 'medium',
    variant: 'primary',
    disabled: false,
  },
};

export const Secondary: Story = {
  args: {
    label: 'Secondary Button',
    size: 'medium',
    variant: 'secondary',
    disabled: false,
  },
};

export const Danger: Story = {
  args: {
    label: 'Danger Button',
    size: 'medium',
    variant: 'danger',
    disabled: false,
  },
};

export const Small: Story = {
  args: {
    label: 'Small Button',
    size: 'small',
    variant: 'primary',
    disabled: false,
  },
};

export const Large: Story = {
  args: {
    label: 'Large Button',
    size: 'large',
    variant: 'primary',
    disabled: false,
  },
};

export const Disabled: Story = {
  args: {
    label: 'Disabled Button',
    size: 'medium',
    variant: 'default',
    disabled: true,
  },
};
