export type ItemType = 'normal' | 'pack-sheet' | 'pack-kilo' | 'roll';

export interface Item {
  id: string;
  serialNumber: string;
  arabicName: string;
  englishName?: string;
  mainNumber?: string;
  specifications?: string;
  itemType: ItemType;
  weight?: string;
  manufacturer?: string;
  color?: string;
  countryOfOrigin?: string;
  quality?: string;
  size?: string;
  createdAt: Date;
  updatedAt: Date;
}
