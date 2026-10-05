import {
  BLACK,
  IBannerColors,
  IRgbColor,
  WHITE,
  getContrastRatio,
  getContrastingColor,
  getRelativeLuminance,
  isValidCssColor,
  parseRgbColor,
  resolveBannerColors,
  resolveCssColor
} from './colorUtils';

const WHITE_RGB: IRgbColor = { r: 255, g: 255, b: 255 };
const BLACK_RGB: IRgbColor = { r: 0, g: 0, b: 0 };

describe('parseRgbColor', () => {
  it('parses comma and space separated rgb() values', () => {
    expect(parseRgbColor('rgb(0, 120, 212)')).toEqual({ r: 0, g: 120, b: 212 });
    expect(parseRgbColor('rgb(0 120 212)')).toEqual({ r: 0, g: 120, b: 212 });
  });

  it('composites semi-transparent colors over white', () => {
    expect(parseRgbColor('rgba(0, 0, 0, 0.5)')).toEqual({ r: 128, g: 128, b: 128 });
    expect(parseRgbColor('rgb(0 0 0 / 50%)')).toEqual({ r: 128, g: 128, b: 128 });
    expect(parseRgbColor('rgba(0, 0, 0, 0)')).toEqual({ r: 255, g: 255, b: 255 });
  });

  it('returns undefined for other formats', () => {
    expect(parseRgbColor('red')).toBeUndefined();
    expect(parseRgbColor('oklch(0.5 0.1 200)')).toBeUndefined();
  });
});

describe('contrast helpers', () => {
  it('computes WCAG relative luminance and contrast ratio', () => {
    expect(getRelativeLuminance(BLACK_RGB)).toBe(0);
    expect(getRelativeLuminance(WHITE_RGB)).toBeCloseTo(1);
    expect(getContrastRatio(BLACK_RGB, WHITE_RGB)).toBeCloseTo(21);
    expect(getContrastRatio({ r: 0, g: 120, b: 212 }, WHITE_RGB)).toBeCloseTo(4.53, 2);
  });

  it('prefers white while it reaches WCAG AA (4.5:1), otherwise black', () => {
    expect(getContrastingColor(BLACK_RGB)).toBe(WHITE);
    expect(getContrastingColor(WHITE_RGB)).toBe(BLACK);
    // SharePoint blue: white 4.53:1 (black would be 4.64:1)
    expect(getContrastingColor({ r: 0, g: 120, b: 212 })).toBe(WHITE);
    expect(getContrastingColor({ r: 255, g: 215, b: 0 })).toBe(BLACK);
    // Boundary: #767676 reaches 4.54:1 with white, #777777 only 4.48:1
    expect(getContrastingColor({ r: 118, g: 118, b: 118 })).toBe(WHITE);
    expect(getContrastingColor({ r: 119, g: 119, b: 119 })).toBe(BLACK);
  });

  it('always returns a color that meets WCAG AA', () => {
    for (let value: number = 0; value <= 255; value += 5) {
      const samples: IRgbColor[] = [
        { r: value, g: value, b: value },
        { r: value, g: 0, b: 0 },
        { r: 0, g: value, b: 0 },
        { r: 0, g: 0, b: value },
        { r: 255, g: value, b: 0 }
      ];
      samples.forEach((color: IRgbColor) => {
        const contrast: IRgbColor = getContrastingColor(color) === WHITE ? WHITE_RGB : BLACK_RGB;
        expect(getContrastRatio(color, contrast)).toBeGreaterThanOrEqual(4.5);
      });
    }
  });
});

describe('isValidCssColor', () => {
  it('accepts valid CSS colors', () => {
    expect(isValidCssColor('#0078d4')).toBe(true);
    expect(isValidCssColor('rebeccapurple')).toBe(true);
    expect(isValidCssColor('rgb(1, 2, 3)')).toBe(true);
  });

  it('rejects invalid values and injection attempts', () => {
    expect(isValidCssColor('notacolor')).toBe(false);
    expect(isValidCssColor('red; background: url(x)')).toBe(false);
  });
});

describe('resolveCssColor', () => {
  it('resolves named and hex colors to RGB', () => {
    expect(resolveCssColor('red')).toEqual({ r: 255, g: 0, b: 0 });
    expect(resolveCssColor('#0078d4')).toEqual({ r: 0, g: 120, b: 212 });
  });

  it('does not leave the probe element in the document', () => {
    resolveCssColor('red');
    expect(document.body.childElementCount).toBe(0);
  });
});

describe('resolveBannerColors', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('keeps the themed defaults when no colors are configured', () => {
    const expected: IBannerColors = { backgroundColor: undefined, textColor: undefined, warnings: [] };
    expect(resolveBannerColors(undefined, undefined)).toEqual(expected);
    expect(resolveBannerColors('', '  ')).toEqual(expected);
  });

  it('uses both configured colors as they are (trimmed)', () => {
    expect(resolveBannerColors(' #ff0000 ', 'white')).toEqual({
      backgroundColor: '#ff0000',
      textColor: 'white',
      warnings: []
    });
  });

  it('picks a contrasting text color for a configured background color', () => {
    expect(resolveBannerColors('#ffd700', '')).toEqual({ backgroundColor: '#ffd700', textColor: BLACK, warnings: [] });
    expect(resolveBannerColors('navy', undefined)).toEqual({ backgroundColor: 'navy', textColor: WHITE, warnings: [] });
  });

  it('picks a contrasting background color for a configured text color', () => {
    expect(resolveBannerColors('', '#ffffff')).toEqual({ backgroundColor: BLACK, textColor: '#ffffff', warnings: [] });
    expect(resolveBannerColors(undefined, 'black')).toEqual({ backgroundColor: WHITE, textColor: 'black', warnings: [] });
  });

  it('ignores invalid colors with a warning', () => {
    const result: IBannerColors = resolveBannerColors('notacolor', 'blue');
    expect(result.backgroundColor).toBe(WHITE);
    expect(result.textColor).toBe('blue');
    expect(result.warnings).toEqual(['Ignoring invalid backgroundColor "notacolor".']);
  });

  it('ignores non-string values with a warning', () => {
    const result: IBannerColors = resolveBannerColors(42, undefined);
    expect(result.backgroundColor).toBeUndefined();
    expect(result.textColor).toBeUndefined();
    expect(result.warnings).toEqual(['Ignoring backgroundColor because it is not a string.']);
  });

  it('falls back to the theme color when no contrasting color can be computed', () => {
    jest
      .spyOn(window, 'getComputedStyle')
      .mockReturnValue({ color: 'color(display-p3 1 0 0)' } as CSSStyleDeclaration);

    const result: IBannerColors = resolveBannerColors('#ff0000', '');
    expect(result.backgroundColor).toBe('#ff0000');
    expect(result.textColor).toBeUndefined();
    expect(result.warnings).toHaveLength(1);
  });
});
