// AlignUI cn: clsx + tailwind-merge that knows Align UI's text, shadow and radius scales (see styles/align-theme.css).
import clsx, { type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

export { type ClassValue } from 'clsx';

const texts = ['title-h1', 'title-h2', 'title-h3', 'title-h4', 'title-h5', 'title-h6', 'label-xl', 'label-lg', 'label-md', 'label-sm', 'label-xs', 'paragraph-xl', 'paragraph-lg', 'paragraph-md', 'paragraph-sm', 'paragraph-xs', 'subheading-md', 'subheading-sm', 'subheading-xs', 'subheading-2xs'];
const shadows = ['regular-xs', 'regular-sm', 'regular-md', 'button-primary-focus', 'button-important-focus', 'button-error-focus', 'fancy-buttons-neutral', 'fancy-buttons-primary', 'fancy-buttons-error', 'fancy-buttons-stroke', 'toggle-switch', 'switch-thumb', 'tooltip'];
const radii = ['10', '20'];

export const twMergeConfig = {
  extend: { classGroups: { 'font-size': [{ text: texts }], shadow: [{ shadow: shadows }], rounded: [{ rounded: radii }] } },
};

const customTwMerge = extendTailwindMerge(twMergeConfig);

/** clsx with tailwind-merge, for possible class conflicts. */
export function cnExt(...classes: ClassValue[]) {
  return customTwMerge(clsx(...classes));
}

/** clsx without tailwind-merge. */
export const cn = clsx;
