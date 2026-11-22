/* US Letter at 96 dpi, with 1-inch margins (as in Google Docs).
   These must match the --ph, --gap and --m variables in styles.css. */
export const PAGE_W = 816;
export const PAGE_H = 1056;
export const GAP = 24; // gray space between sheets on screen
export const MARGIN = 96;
/** distance from the top of one sheet to the top of the next */
export const PITCH = PAGE_H + GAP;
