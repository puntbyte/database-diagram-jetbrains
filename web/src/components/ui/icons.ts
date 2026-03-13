// web/src/components/ui/icons.ts

import KeySvg from '../../assets/icons/key.svg?raw';
import TableSvg from '../../assets/icons/table.svg?raw';
import ZoomInSvg from '../../assets/icons/zoom-in.svg?raw';
import ZoomOutSvg from '../../assets/icons/zoom-out.svg?raw';
import CenterSvg from '../../assets/icons/center.svg?raw';
import GridSvg from '../../assets/icons/grid.svg?raw';
import ChevronUpSvg from '../../assets/icons/chevron-up.svg?raw';

export const Icons = {
  key: KeySvg,
  table: TableSvg,
  zoomIn: ZoomInSvg,
  zoomOut: ZoomOutSvg,
  center: CenterSvg,
  grid: GridSvg,
  chevronUp: ChevronUpSvg
} as const;

export type IconName = keyof typeof Icons;