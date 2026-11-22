/** Current visual scale of an element that sits inside the scaled page (1 when not scaled). */
export const scaleOf = (el: HTMLElement) => (el.offsetWidth ? el.getBoundingClientRect().width / el.offsetWidth : 1) || 1;
