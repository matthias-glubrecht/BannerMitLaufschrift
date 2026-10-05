import { Log } from '@microsoft/sp-core-library';
import {
  BaseApplicationCustomizer,
  PlaceholderContent,
  PlaceholderName
} from '@microsoft/sp-application-base';

import * as strings from 'LaufschriftApplicationCustomizerStrings';
import { IBannerColors, resolveBannerColors } from './colorUtils';
import { LaufschriftBanner } from './LaufschriftBanner';

const LOG_SOURCE: string = 'LaufschriftApplicationCustomizer';

/**
 * Deserialized from the ClientSideComponentProperties JSON of the User Custom Action, e.g.
 * {"bannerText":"Hello","backgroundColor":"","textColor":""}
 */
export interface ILaufschriftApplicationCustomizerProperties {
  /** Text to scroll. Nothing is rendered if empty. */
  bannerText: string;
  /** Optional CSS color. If empty, the site theme (or an automatic contrast color) is used. */
  backgroundColor?: string;
  /** Optional CSS color. If empty, the site theme (or an automatic contrast color) is used. */
  textColor?: string;
}

/** Renders a scrolling text banner ("Laufschrift") in the Top placeholder of every modern page. */
export default class LaufschriftApplicationCustomizer
  extends BaseApplicationCustomizer<ILaufschriftApplicationCustomizerProperties> {

  private _bannerText: string = '';
  private _colors: IBannerColors | undefined;
  private _topPlaceholder: PlaceholderContent | undefined;
  private _banner: LaufschriftBanner | undefined;

  public onInit(): Promise<void> {
    Log.info(LOG_SOURCE, `Initialized ${strings.Title}`);

    const properties: Partial<ILaufschriftApplicationCustomizerProperties> = this.properties || {};
    this._bannerText = typeof properties.bannerText === 'string' ? properties.bannerText.trim() : '';
    if (!this._bannerText) {
      Log.info(LOG_SOURCE, 'No bannerText configured, nothing to render.');
      return Promise.resolve();
    }

    this._colors = resolveBannerColors(properties.backgroundColor, properties.textColor);
    this._colors.warnings.forEach((warning: string) => Log.warn(LOG_SOURCE, warning));

    // Placeholders can appear later or be recreated (e.g. on in-place page navigation).
    this.context.placeholderProvider.changedEvent.add(this, this._renderPlaceholder);
    this._renderPlaceholder();

    return Promise.resolve();
  }

  protected onDispose(): void {
    // The handler is only registered when there is something to render, and SPFx logs an
    // error when removing a handler that was never registered.
    if (this._bannerText) {
      this.context.placeholderProvider.changedEvent.remove(this, this._renderPlaceholder);
    }
    if (this._topPlaceholder) {
      this._topPlaceholder.dispose();
    }
    this._disposeBanner();
    super.onDispose();
  }

  private _renderPlaceholder = (): void => {
    if (!this._bannerText || !this._colors || (this._topPlaceholder && !this._topPlaceholder.isDisposed)) {
      return;
    }

    this._topPlaceholder = this.context.placeholderProvider.tryCreateContent(PlaceholderName.Top, {
      onDispose: this._onPlaceholderDispose
    });
    if (!this._topPlaceholder) {
      Log.info(LOG_SOURCE, 'The Top placeholder is not available on this page.');
      return;
    }

    this._disposeBanner();
    this._banner = new LaufschriftBanner(this._topPlaceholder.domElement, {
      text: this._bannerText,
      backgroundColor: this._colors.backgroundColor,
      textColor: this._colors.textColor,
      labels: {
        region: strings.BannerAriaLabel,
        pause: strings.PauseButtonLabel,
        play: strings.PlayButtonLabel
      }
    });
  };

  private _onPlaceholderDispose = (): void => {
    this._disposeBanner();
    this._topPlaceholder = undefined;
  };

  private _disposeBanner(): void {
    if (this._banner) {
      this._banner.dispose();
      this._banner = undefined;
    }
  }
}
