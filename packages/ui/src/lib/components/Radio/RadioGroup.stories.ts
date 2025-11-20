import type { Meta, StoryObj } from '@storybook/svelte';
import RadioGroup from './RadioGroup.svelte';

const meta = {
  title: 'UI/RadioGroup',
  component: RadioGroup,
  tags: ['autodocs'],
  argTypes: {
    name: { control: 'text', description: 'ラジオボタングループ名' },
    options: { control: 'object', description: '選択肢のリスト' },
    selectedValue: { control: 'text', description: '選択された値' },
  },
} satisfies Meta<RadioGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

const defaultOptions = [
  { label: 'オプション A', value: 'optionA' },
  { label: 'オプション B', value: 'optionB' },
  { label: 'オプション C', value: 'optionC' },
];

export const Default: Story = {
  args: {
    name: 'my-group',
    options: defaultOptions,
    selectedValue: 'optionA',
  },
};

export const WithDisabledOption: Story = {
  args: {
    name: 'my-group-disabled',
    options: [
      { label: 'オプション X', value: 'optionX' },
      { label: 'オプション Y (無効)', value: 'optionY', disabled: true },
      { label: 'オプション Z', value: 'optionZ' },
    ],
    selectedValue: 'optionX',
  },
};
