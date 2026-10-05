import { ILaufschriftBannerLabels, LaufschriftBanner, SCROLL_SPEED_PX_PER_SECOND } from './LaufschriftBanner';

const labels: ILaufschriftBannerLabels = { region: 'Announcement', pause: 'Pause', play: 'Play' };

class MockResizeObserver {
  public static instances: MockResizeObserver[] = [];
  public observed: Element[] = [];
  public isDisconnected: boolean = false;

  public constructor(public readonly callback: () => void) {
    MockResizeObserver.instances.push(this);
  }

  public observe(target: Element): void {
    this.observed.push(target);
  }

  public unobserve(): void {
    // not needed
  }

  public disconnect(): void {
    this.isDisconnected = true;
  }
}

function query<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }
  return element;
}

function mockOffsetWidth(width: number): jest.SpyInstance {
  return jest.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(width);
}

describe('LaufschriftBanner', () => {
  let host: HTMLDivElement;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('renders the text as plain text inside a labelled region', () => {
    const banner: LaufschriftBanner = new LaufschriftBanner(host, { text: '<b>Hello</b>', labels });

    const region: HTMLElement = query<HTMLElement>('[role="region"]');
    expect(region.getAttribute('aria-label')).toBe('Announcement');
    expect(region.textContent).toBe('<b>Hello</b>');
    expect(host.querySelector('b')).toBeNull();

    banner.dispose();
  });

  it('keeps the themed defaults when no colors are passed', () => {
    const banner: LaufschriftBanner = new LaufschriftBanner(host, { text: 'Hello', labels });

    const region: HTMLElement = query<HTMLElement>('[role="region"]');
    expect(region.style.backgroundColor).toBe('');
    expect(region.style.color).toBe('');

    banner.dispose();
  });

  it('applies configured colors as inline styles', () => {
    const banner: LaufschriftBanner = new LaufschriftBanner(host, {
      text: 'Hello',
      backgroundColor: '#ffd700',
      textColor: '#000000',
      labels
    });

    const region: HTMLElement = query<HTMLElement>('[role="region"]');
    expect(region.style.backgroundColor).toBe('rgb(255, 215, 0)');
    expect(region.style.color).toBe('rgb(0, 0, 0)');

    banner.dispose();
  });

  it('pauses and resumes with the toggle button', () => {
    const banner: LaufschriftBanner = new LaufschriftBanner(host, { text: 'Hello', labels });
    const region: HTMLElement = query<HTMLElement>('[role="region"]');
    const button: HTMLButtonElement = query<HTMLButtonElement>('button');

    expect(button.type).toBe('button');
    expect(button.getAttribute('aria-label')).toBe('Pause');
    expect(banner.isPaused).toBe(false);

    button.click();
    expect(banner.isPaused).toBe(true);
    expect(button.getAttribute('aria-label')).toBe('Play');
    expect(button.title).toBe('Play');
    expect(region.classList.contains('paused')).toBe(true);

    button.click();
    expect(banner.isPaused).toBe(false);
    expect(button.getAttribute('aria-label')).toBe('Pause');
    expect(region.classList.contains('paused')).toBe(false);

    banner.dispose();
  });

  it('derives the animation duration from the track width for a constant speed', () => {
    mockOffsetWidth(1600);
    const banner: LaufschriftBanner = new LaufschriftBanner(host, { text: 'Hello', labels });

    expect(query<HTMLElement>('.track').style.animationDuration).toBe(`${1600 / SCROLL_SPEED_PX_PER_SECOND}s`);

    banner.dispose();
  });

  it('keeps the CSS default duration while the banner has no width', () => {
    mockOffsetWidth(0);
    const banner: LaufschriftBanner = new LaufschriftBanner(host, { text: 'Hello', labels });

    expect(query<HTMLElement>('.track').style.animationDuration).toBe('');

    banner.dispose();
  });

  it('recalculates the duration on window resize when ResizeObserver is not available', () => {
    const widthSpy: jest.SpyInstance = mockOffsetWidth(800);
    const banner: LaufschriftBanner = new LaufschriftBanner(host, { text: 'Hello', labels });
    const track: HTMLElement = query<HTMLElement>('.track');
    expect(track.style.animationDuration).toBe('10s');

    widthSpy.mockReturnValue(1600);
    window.dispatchEvent(new Event('resize'));
    expect(track.style.animationDuration).toBe('20s');

    banner.dispose();
    widthSpy.mockReturnValue(2400);
    window.dispatchEvent(new Event('resize'));
    expect(track.style.animationDuration).toBe('20s');
  });

  describe('with ResizeObserver', () => {
    beforeEach(() => {
      MockResizeObserver.instances = [];
      Object.defineProperty(window, 'ResizeObserver', {
        configurable: true,
        writable: true,
        value: MockResizeObserver
      });
    });

    afterEach(() => {
      delete (window as unknown as Record<string, unknown>).ResizeObserver;
    });

    it('observes the track and disconnects on dispose', () => {
      const widthSpy: jest.SpyInstance = mockOffsetWidth(800);
      const banner: LaufschriftBanner = new LaufschriftBanner(host, { text: 'Hello', labels });
      const track: HTMLElement = query<HTMLElement>('.track');

      expect(MockResizeObserver.instances).toHaveLength(1);
      const observer: MockResizeObserver = MockResizeObserver.instances[0];
      expect(observer.observed).toEqual([track]);

      widthSpy.mockReturnValue(2400);
      observer.callback();
      expect(track.style.animationDuration).toBe('30s');

      banner.dispose();
      expect(observer.isDisconnected).toBe(true);
    });
  });

  it('removes its DOM on dispose and can be disposed twice', () => {
    const banner: LaufschriftBanner = new LaufschriftBanner(host, { text: 'Hello', labels });
    expect(host.childElementCount).toBe(1);

    banner.dispose();
    banner.dispose();
    expect(host.childElementCount).toBe(0);
  });
});
