import { test, expect } from '@playwright/test';

/**
 * Wallet Connection E2E Tests
 */

test.describe('Wallet Connection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('@smoke @critical should display connect wallet button', async ({ page }) => {
    const connectButton = page.getByRole('button', { name: /connect wallet/i });
    await expect(connectButton).toBeVisible();
  });

  test('should show wallet selection modal when connect clicked', async ({ page }) => {
    await page.getByRole('button', { name: /connect wallet/i }).click();
    
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();
    
    // Check for Polkadot.js extension option
    const polkadotOption = page.getByText('Polkadot.js');
    await expect(polkadotOption).toBeVisible();
  });

  test('should handle wallet not installed error', async ({ page }) => {
    // Mock no wallet installed
    await page.evaluate(() => {
      // @ts-ignore
      delete window.injectedWeb3;
    });

    await page.getByRole('button', { name: /connect wallet/i }).click();
    await page.getByText('Polkadot.js').click();

    // Should show error message
    const errorMessage = page.getByText(/wallet not found/i);
    await expect(errorMessage).toBeVisible();
  });

  test('should connect to wallet successfully', async ({ page }) => {
    // Mock wallet extension
    await page.evaluate(() => {
      // @ts-ignore
      window.injectedWeb3 = {
        'polkadot-js': {
          enable: async () => ({
            accounts: {
              get: async () => [
                {
                  address: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
                  meta: { name: 'Alice' },
                  type: 'sr25519'
                }
              ],
              subscribe: () => {}
            },
            signer: {}
          })
        }
      };
    });

    await page.getByRole('button', { name: /connect wallet/i }).click();
    await page.getByText('Polkadot.js').click();

    // Should show connected account
    await expect(page.getByText('5Grw...utQY')).toBeVisible();
    await expect(page.getByText('Alice')).toBeVisible();
  });

  test('should disconnect wallet', async ({ page }) => {
    // First connect
    await page.evaluate(() => {
      // @ts-ignore
      window.injectedWeb3 = {
        'polkadot-js': {
          enable: async () => ({
            accounts: {
              get: async () => [
                {
                  address: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
                  meta: { name: 'Alice' },
                  type: 'sr25519'
                }
              ],
              subscribe: () => {}
            },
            signer: {}
          })
        }
      };
    });

    await page.getByRole('button', { name: /connect wallet/i }).click();
    await page.getByText('Polkadot.js').click();

    // Disconnect
    await page.getByRole('button', { name: /disconnect/i }).click();

    // Should show connect button again
    await expect(page.getByRole('button', { name: /connect wallet/i })).toBeVisible();
  });

  test('should persist wallet connection on reload', async ({ page, context }) => {
    // Mock wallet and connect
    await page.evaluate(() => {
      // @ts-ignore
      window.injectedWeb3 = {
        'polkadot-js': {
          enable: async () => ({
            accounts: {
              get: async () => [
                {
                  address: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
                  meta: { name: 'Alice' },
                  type: 'sr25519'
                }
              ],
              subscribe: () => {}
            },
            signer: {}
          })
        }
      };
    });

    await page.getByRole('button', { name: /connect wallet/i }).click();
    await page.getByText('Polkadot.js').click();

    // Reload page
    await page.reload();

    // Should still be connected
    await expect(page.getByText('5Grw...utQY')).toBeVisible();
  });
});