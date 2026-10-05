export const BLACK: string = '#000000';
export const WHITE: string = '#ffffff';

export interface IRgbColor {
  r: number;
  g: number;
  b: number;
}

export interface IBannerColors {
  /** Inline background color, or undefined to use the themed default. */
  backgroundColor?: string;
  /** Inline text color, or undefined to use the themed default. */
  textColor?: string;
  /** Configuration problems that were corrected and should be logged. */
  warnings: string[];
}

const RGB_PATTERN: RegExp = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+)(%?))?\s*\)$/i;
const WHITE_RGB: IRgbColor = { r: 255, g: 255, b: 255 };
/** WCAG AA minimum contrast ratio for normal text. */
const MIN_CONTRAST_RATIO: number = 4.5;

/** Returns the trimmed string, or undefined for empty or non-string values. */
function normalizeColorValue(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed: string = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function isValidCssColor(value: string): boolean {
  if (typeof CSS !== 'undefined' && typeof CSS.supports === 'function') {
    return CSS.supports('color', value);
  }
  // Fallback for environments without CSS.supports: the CSSOM rejects invalid values.
  const style: CSSStyleDeclaration = document.createElement('span').style;
  style.color = value;
  return style.color !== '';
}

/**
 * Parses rgb()/rgba() strings as returned by getComputedStyle().
 * Semi-transparent colors are composited over white, the usual page background.
 */
export function parseRgbColor(value: string): IRgbColor | undefined {
  const match = RGB_PATTERN.exec(value.trim());
  if (!match) {
    return undefined;
  }

  let alpha: number = 1;
  if (match[4] !== undefined) {
    alpha = parseFloat(match[4]) / (match[5] === '%' ? 100 : 1);
    alpha = Math.min(Math.max(alpha, 0), 1);
  }

  const blend = (channel: string): number =>
    Math.round(Math.min(parseFloat(channel), 255) * alpha + 255 * (1 - alpha));

  return { r: blend(match[1]), g: blend(match[2]), b: blend(match[3]) };
}

/** Lets the browser resolve any CSS color (named, hex, hsl, ...) to RGB. */
export function resolveCssColor(value: string): IRgbColor | undefined {
  const probe: HTMLSpanElement = document.createElement('span');
  probe.style.display = 'none';
  probe.style.color = value;

  const parent: HTMLElement = document.body || document.documentElement;
  parent.appendChild(probe);
  try {
    return parseRgbColor(window.getComputedStyle(probe).color);
  } finally {
    parent.removeChild(probe);
  }
}

function toLinearChannel(channel: number): number {
  const value: number = channel / 255;
  return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
}

/** WCAG 2.x relative luminance (0 = black, 1 = white). */
export function getRelativeLuminance(color: IRgbColor): number {
  return 0.2126 * toLinearChannel(color.r) + 0.7152 * toLinearChannel(color.g) + 0.0722 * toLinearChannel(color.b);
}

/** WCAG 2.x contrast ratio (1 to 21). */
export function getContrastRatio(first: IRgbColor, second: IRgbColor): number {
  const firstLuminance: number = getRelativeLuminance(first);
  const secondLuminance: number = getRelativeLuminance(second);
  return (Math.max(firstLuminance, secondLuminance) + 0.05) / (Math.min(firstLuminance, secondLuminance) + 0.05);
}

/**
 * Returns white if it reaches WCAG AA contrast with the given color, otherwise black.
 * The result always meets AA: whenever white falls short, black exceeds 4.5:1.
 * (A plain "higher contrast wins" rule would put black text on SharePoint blue #0078d4.)
 */
export function getContrastingColor(color: IRgbColor): string {
  return getContrastRatio(color, WHITE_RGB) >= MIN_CONTRAST_RATIO ? WHITE : BLACK;
}

function validateColor(value: unknown, propertyName: string, warnings: string[]): string | undefined {
  if (value !== undefined && value !== null && typeof value !== 'string') {
    warnings.push(`Ignoring ${propertyName} because it is not a string.`);
    return undefined;
  }

  const color: string | undefined = normalizeColorValue(value);
  if (color !== undefined && !isValidCssColor(color)) {
    warnings.push(`Ignoring invalid ${propertyName} "${color}".`);
    return undefined;
  }
  return color;
}

function getAutoContrastColor(givenColor: string, propertyName: string, warnings: string[]): string | undefined {
  const rgb: IRgbColor | undefined = resolveCssColor(givenColor);
  if (!rgb) {
    warnings.push(
      `Could not compute a contrasting color for ${propertyName} "${givenColor}"; using the theme color instead.`
    );
    return undefined;
  }
  return getContrastingColor(rgb);
}

/**
 * Resolves the configured colors:
 * - none configured (or invalid): undefined for both, so the themed defaults apply
 * - both configured: used as they are
 * - only one configured: the other becomes white or black (see getContrastingColor)
 */
export function resolveBannerColors(backgroundColor: unknown, textColor: unknown): IBannerColors {
  const warnings: string[] = [];
  const background: string | undefined = validateColor(backgroundColor, 'backgroundColor', warnings);
  const text: string | undefined = validateColor(textColor, 'textColor', warnings);

  if (background !== undefined && text === undefined) {
    return {
      backgroundColor: background,
      textColor: getAutoContrastColor(background, 'backgroundColor', warnings),
      warnings
    };
  }

  if (text !== undefined && background === undefined) {
    return {
      backgroundColor: getAutoContrastColor(text, 'textColor', warnings),
      textColor: text,
      warnings
    };
  }

  return { backgroundColor: background, textColor: text, warnings };
}
