import { TODO_TAG_PALETTE } from './design-tokens';

const TAG_BACKGROUND_COLORS: Record<string, string> = {
  [TODO_TAG_PALETTE[0]]: '#EAF4FF',
  [TODO_TAG_PALETTE[1]]: '#EBF9EF',
  [TODO_TAG_PALETTE[2]]: '#FFF4E3',
  [TODO_TAG_PALETTE[3]]: '#FFECEA',
  [TODO_TAG_PALETTE[4]]: '#EEEEFB',
  [TODO_TAG_PALETTE[5]]: '#F7EAFB',
  [TODO_TAG_PALETTE[6]]: '#FFEAF1',
  [TODO_TAG_PALETTE[7]]: '#F2F2F7',
};

export interface TagStyleFields {
  color: string;
  bgColor: string;
}

export function getTagBackgroundColor(color: string): string {
  return TAG_BACKGROUND_COLORS[color] || TAG_BACKGROUND_COLORS[TODO_TAG_PALETTE[7]];
}

export function withTagStyle<T extends { color: string }>(tag: T): T & TagStyleFields {
  return {
    ...tag,
    bgColor: getTagBackgroundColor(tag.color),
  };
}
