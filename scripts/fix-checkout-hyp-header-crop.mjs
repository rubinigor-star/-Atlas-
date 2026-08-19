// HYP payment iframe must render in its native viewport.
//
// This script previously wrapped the iframe in a fixed-height container and
// translated the HYP page upward by 132px. That visual crop could hide or
// displace payment-method controls (including wallet UI) and made the hosted
// payment flow dependent on HYP's internal layout.
//
// Keep this file as an intentional no-op because package.json still invokes it
// during build. Any future HYP styling must be done without clipping or
// translating the cross-origin payment page.
