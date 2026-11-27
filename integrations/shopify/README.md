# OIM banner for Shopify (proof of concept)

A theme section that shows one `.oim.png` in the store's current language.
Switching the store language switches the banner text; no image per language.

## Try it

1. Create a development store from a Shopify Partner account.
2. Online Store > Themes > Edit code > `sections` > New File named `oim-banner.liquid` (type the `.liquid` extension yourself), and paste `sections/oim-banner.liquid`.
3. Upload your `.oim.png` in Content > Files and copy its link.
4. In the theme editor, add the **OIM banner** section and paste the link.
5. Add a second language in Settings > Languages and switch it on the storefront.

The player loads from `cdn.oim.media`. The section passes `localization.language.iso_code`
(`es-MX` becomes `es`) to the player's `lang` attribute.
