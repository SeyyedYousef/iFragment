// ***********************************************************
// This example support/e2e.ts is processed and
// loaded automatically before your test files.
// ***********************************************************

// Custom Cypress command to mimic a Telegram Web App login
declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Custom command to visit the app as if it was opened inside Telegram.
       * @example cy.visitAsTelegram('/dashboard')
       */
      visitAsTelegram(url: string): Chainable<Element>;
    }
  }
}

Cypress.Commands.add('visitAsTelegram', (url) => {
  const tgWebAppData = 'user=%7B%22id%22%3A99281932%2C%22first_name%22%3A%22Andrew%22%2C%22last_name%22%3A%22Rogue%22%2C%22username%22%3A%22rogue%22%2C%22language_code%22%3A%22en%22%2C%22is_premium%22%3Atrue%2C%22allows_write_to_pm%22%3Atrue%7D&hash=89d6079ad6762351f38c6dbbc41bb53048019256a9443988af7a48bcad16ba31&signature=5O_G2H_wXgI32v2G-w0y-W_O3G_4G&auth_date=1716922846&query_id=AAHdF60pAAAAANYXrSkW1';
  
  // Combine the target url with the hash parameters
  const hashPrefix = url.includes('#') ? '&' : '#';
  const fullUrl = `${url}${hashPrefix}tgWebAppData=${tgWebAppData}&tgWebAppVersion=7.2&tgWebAppPlatform=weba&tgWebAppThemeParams=%7B%7D`;

  return cy.visit(fullUrl);
});

// Global before hook for generic intercepts
beforeEach(() => {
  cy.intercept('GET', '**/api/v1/**', { statusCode: 200, body: {} }).as('apiGet');
  cy.intercept('POST', '**/api/v1/**', { statusCode: 200, body: {} }).as('apiPost');
});
