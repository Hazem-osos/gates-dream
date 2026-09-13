declare module 'primereact/tree' {
  import { TreeProps, TreeSelectionEvent } from 'primereact/components/tree/Tree';
  export { TreeProps, TreeSelectionEvent };
  export const Tree: React.FC<TreeProps>;
}

declare module 'primereact/treenode' {
  export interface TreeNode {
    key?: string;
    label?: string;
    data?: any;
    icon?: string;
    children?: TreeNode[];
    expanded?: boolean;
  }
}

declare module 'primereact/button' {
  import { ButtonProps } from 'primereact/components/button/Button';
  export { ButtonProps };
  export const Button: React.FC<ButtonProps>;
}

declare module 'primereact/slider' {
  import { SliderProps } from 'primereact/components/slider/Slider';
  export interface SliderChangeEvent {
    value: number;
    originalEvent: Event;
  }
  export { SliderProps };
  export const Slider: React.FC<SliderProps>;
}

declare module 'primereact/card' {
  import { CardProps } from 'primereact/components/card/Card';
  export { CardProps };
  export const Card: React.FC<CardProps>;
}

declare module "primereact/resources/themes/lara-light-indigo/theme.css"
declare module "primereact/resources/primereact.min.css"
declare module "primeicons/primeicons.css" 