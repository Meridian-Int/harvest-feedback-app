export const ACCEPT = 'image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime';
export function checkFile(file: Pick<File, 'size' | 'type' | 'name'>, maxBytes: number): string | null {
  if (file.size > maxBytes) return 'Choose a file smaller than 50 MB.';
  if (!ACCEPT.split(',').includes(file.type) && !(file.type === '' && /\.(png|jpe?g|webp|mp4|webm|mov)$/i.test(file.name))) return 'Choose a PNG, JPG, WebP, MP4, WebM or MOV file.';
  return null;
}
