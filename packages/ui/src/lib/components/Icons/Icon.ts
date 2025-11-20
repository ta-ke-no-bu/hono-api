export type IconName = 'check' | 'x' | 'info' | 'alert' | 'home';

import type { SVGAttributes } from 'svelte/elements'

export interface IconProps
  extends Omit<SVGAttributes<SVGSVGElement>, 'class' | 'className' | 'color'> {
  name: IconName
  size?: 'sm' | 'md' | 'lg'
  color?: string
  customClass?: string
}
