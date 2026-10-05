# banner-mit-laufschrift

## Summary

SharePoint Framework **Application Customizer** that shows a scrolling text banner ("Laufschrift", marquee) in the
**Top placeholder** of every modern page of a site collection. Text and colors are configured through the properties
of a **User Custom Action with scope Site** (site collection).

- Uses the colors of the SharePoint site theme by default and follows theme changes
- Optional custom background and text colors, with automatic contrast if only one is set
- Accessible: pauses on hover, pause/play button, honors the "reduce motion" setting
- No additional dependencies (plain TypeScript/DOM, no React)

## Used SharePoint Framework Version

![version](https://img.shields.io/badge/version-1.23.2-green.svg)

## Applies to

- [SharePoint Framework](https://aka.ms/spfx)
- [Microsoft 365 tenant](https://docs.microsoft.com/sharepoint/dev/spfx/set-up-your-developer-tenant)

## Properties

The extension reads the `ClientSideComponentProperties` JSON of the User Custom Action:

| Property          | Required | Description                                                                                   |
| ----------------- | -------- | --------------------------------------------------------------------------------------------- |
| `bannerText`      | yes      | Text to scroll. If empty, nothing is rendered. Shown as plain text (HTML is not interpreted). |
| `backgroundColor` | no       | Any CSS color, e.g. `#ffd700`, `rgb(0 120 212)`, `navy`.                                      |
| `textColor`       | no       | Any CSS color.                                                                                |

```json
{ "bannerText": "Wartungsarbeiten am Freitag ab 18:00 Uhr", "backgroundColor": "", "textColor": "" }
```

### Color rules

| `backgroundColor` | `textColor` | Result                                                                                                                                                                      |
| ----------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| empty             | empty       | Site theme: background `themePrimary`, text theme slot `white` (the pairing of SharePoint primary buttons; readable in light and dark themes, updates when the theme changes) |
| set               | set         | Both colors are used as configured                                                                                                                                          |
| set               | empty       | Text becomes white if white reaches the WCAG AA contrast ratio (4.5:1) with the background, otherwise black                                                                  |
| empty             | set         | Background becomes white or black by the same rule                                                                                                                          |

Invalid color values are ignored (treated as empty) and logged as a warning in the browser console.

## Behavior

- Scrolls from right to left at a constant speed (80 px/s), independent of text length and screen width.
- Pauses while the mouse is over the text.
- Pause/play button that can also be used with the keyboard (WCAG 2.2.2 "Pause, Stop, Hide").
- If the user has enabled "reduce motion" in the operating system (`prefers-reduced-motion`), the text is shown
  static and wrapped, and the button is hidden.
- Screen readers read the full text inside a region labelled "Announcement" / "Ankündigung" (English and German UI).
- Keeps working during in-place page navigation and re-renders if SharePoint recreates the placeholder.

**Limitation:** Application customizers only run on modern pages (site pages, modern lists and libraries, ...).
Classic pages such as `/_layouts/15/settings.aspx` do not show the banner.

## Download

`banner-mit-laufschrift.sppkg` is attached to the
[latest release](https://github.com/matthias-glubrecht/BannerMitLaufschrift/releases/latest).
To build it yourself, see [Build](#build).

## Deploy

Upload `banner-mit-laufschrift.sppkg` to the **tenant App Catalog** and keep **Enable this app and add it to all sites**
selected (the default). This makes the extension available on all sites without installing the app on each site, but
it does not show anywhere yet: the package intentionally contains no `ClientSideInstance.xml` or `elements.xml`, so
neither a Tenant Wide Extension entry nor a custom action is created. The banner only appears on site collections where
you add the User Custom Action below.

## Activate on a site collection

Component ID: `18122664-590f-4dac-a1a2-fa943fa1bff4`

### PnP PowerShell

```powershell
Connect-PnPOnline -Url "https://contoso.sharepoint.com/sites/intranet" -Interactive -ClientId "<your Entra ID app client id>"

$properties = @{
  bannerText      = "Wartungsarbeiten am Freitag ab 18:00 Uhr - bitte speichern Sie Ihre Arbeit rechtzeitig."
  backgroundColor = ""
  textColor       = ""
} | ConvertTo-Json -Compress

Add-PnPApplicationCustomizer -Title "Laufschrift" -ClientSideComponentId "18122664-590f-4dac-a1a2-fa943fa1bff4" `
  -ClientSideComponentProperties $properties -Scope Site
```

`-Scope` defaults to `Web` in PnP PowerShell, so specify `-Scope Site` to cover the whole site collection
(including subsites).

Change text or colors later:

```powershell
Set-PnPApplicationCustomizer -ClientSideComponentId "18122664-590f-4dac-a1a2-fa943fa1bff4" -Scope Site `
  -ClientSideComponentProperties $properties
```

Deactivate:

```powershell
Remove-PnPApplicationCustomizer -ClientSideComponentId "18122664-590f-4dac-a1a2-fa943fa1bff4" -Scope Site -Force
```

### CLI for Microsoft 365

```bash
m365 spo applicationcustomizer add --webUrl https://contoso.sharepoint.com/sites/intranet --title "Laufschrift" \
  --clientSideComponentId 18122664-590f-4dac-a1a2-fa943fa1bff4 --scope Site \
  --clientSideComponentProperties '{"bannerText":"Wartungsarbeiten am Freitag ab 18:00 Uhr","backgroundColor":"","textColor":""}'
```

When running the CLI from PowerShell, see
[escaping JSON in PowerShell](https://pnp.github.io/cli-microsoft365/user-guide/using-cli#escaping-double-quotes-in-powershell).

## Build

Requires Node.js 22 (see `.nvmrc`).

```powershell
npm install
npm run build
```

This lints, compiles, runs the unit tests and creates `sharepoint/solution/banner-mit-laufschrift.sppkg`.

## Debugging

Adjust `pageUrl` and the sample properties in `config/serve.json` if needed, then:

```powershell
$env:SPFX_SERVE_TENANT_DOMAIN = "contoso.sharepoint.com"
npm start                                  # "default": theme colors
npm start -- --serve-config laufschrift    # "laufschrift": custom background color with automatic text color
```

## Version history

| Version | Date            | Comments        |
| ------- | --------------- | --------------- |
| 1.0.0   | October 5, 2026 | Initial release |

## Disclaimer

**THIS CODE IS PROVIDED _AS IS_ WITHOUT WARRANTY OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING ANY IMPLIED WARRANTIES OF FITNESS FOR A PARTICULAR PURPOSE, MERCHANTABILITY, OR NON-INFRINGEMENT.**

---

## References

- [Build your first SharePoint Framework Extension](https://learn.microsoft.com/sharepoint/dev/spfx/extensions/get-started/build-a-hello-world-extension)
- [Use page placeholders from Application Customizer](https://learn.microsoft.com/sharepoint/dev/spfx/extensions/get-started/using-page-placeholder-with-extensions)
- [Use theme colors in your SharePoint Framework customizations](https://learn.microsoft.com/sharepoint/dev/spfx/use-theme-colors-in-your-customizations)
- [Add-PnPApplicationCustomizer](https://pnp.github.io/powershell/cmdlets/Add-PnPApplicationCustomizer.html)
- [Heft Documentation](https://heft.rushstack.io/)
