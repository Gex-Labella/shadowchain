import { test, expect } from '@playwright/test';

/**
 * Shadow Items E2E Tests
 */

test.describe('Shadow Items Management', () => {
  test.beforeEach(async ({ page }) => {
    // Mock wallet connection
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

    await page.goto('/');
    await page.getByRole('button', { name: /connect wallet/i }).click();
    await page.getByText('Polkadot.js').click();
  });

  test('@critical should display empty state when no shadow items', async ({ page }) => {
    await page.goto('/dashboard');
    
    const emptyState = page.getByText(/no shadow items yet/i);
    await expect(emptyState).toBeVisible();
  });

  test('should display authorization flow', async ({ page }) => {
    await page.goto('/dashboard');
    
    const authorizeButton = page.getByRole('button', { name: /authorize syncing/i });
    await expect(authorizeButton).toBeVisible();
    
    await authorizeButton.click();
    
    // Should show consent dialog
    const consentDialog = page.getByRole('dialog');
    await expect(consentDialog).toBeVisible();
    
    // Check consent text
    await expect(page.getByText(/read your github commits/i)).toBeVisible();
    await expect(page.getByText(/read your twitter posts/i)).toBeVisible();
    await expect(page.getByText(/encrypt your data/i)).toBeVisible();
  });

  test('should grant consent and start syncing', async ({ page }) => {
    await page.goto('/dashboard');
    
    await page.getByRole('button', { name: /authorize syncing/i }).click();
    
    // Mock signing consent
    await page.evaluate(() => {
      // @ts-ignore
      window.mockConsentSigned = true;
    });
    
    await page.getByRole('button', { name: /grant consent/i }).click();
    
    // Should show success message
    await expect(page.getByText(/authorization successful/i)).toBeVisible();
    
    // Should show sync status
    await expect(page.getByText(/syncing enabled/i)).toBeVisible();
  });

  test('should display shadow items list', async ({ page }) => {
    // Mock shadow items
    await page.route('**/api/shadow-items', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              id: '1',
              cid: 'QmTest1',
              source: 'GitHub',
              timestamp: Date.now() - 3600000,
              metadata: 'feat: Add new feature'
            },
            {
              id: '2',
              cid: 'QmTest2',
              source: 'Twitter',
              timestamp: Date.now() - 7200000,
              metadata: 'Just shipped Shadow Chain!'
            }
          ]
        })
      });
    });
    
    await page.goto('/dashboard');
    
    // Should display items
    await expect(page.getByText(/feat: Add new feature/i)).toBeVisible();
    await expect(page.getByText(/Just shipped Shadow Chain!/i)).toBeVisible();
    
    // Check source icons
    await expect(page.getByTestId('github-icon')).toBeVisible();
    await expect(page.getByTestId('twitter-icon')).toBeVisible();
  });

  test('@smoke should decrypt shadow item', async ({ page }) => {
    // Mock encrypted item
    await page.route('**/api/shadow-items', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              id: '1',
              cid: 'QmTest1',
              encryptedKey: '0xencryptedkey',
              source: 'GitHub',
              timestamp: Date.now() - 3600000,
              metadata: 'feat: Add new feature'
            }
          ]
        })
      });
    });
    
    // Mock IPFS content
    await page.route('**/ipfs/QmTest1', async route => {
      await route.fulfill({
        status: 200,
        body: Buffer.from('encrypted content here')
      });
    });
    
    await page.goto('/dashboard');
    
    // Click decrypt button
    await page.getByRole('button', { name: /decrypt/i }).click();
    
    // Mock decryption
    await page.evaluate(() => {
      // @ts-ignore
      window.mockDecryptedContent = {
        source: 'GitHub',
        url: 'https://github.com/user/repo/commit/abc123',
        body: 'feat: Add new feature\n\nDetailed commit message',
        timestamp: Date.now() - 3600000
      };
    });
    
    // Should show decrypted content
    await expect(page.getByText(/detailed commit message/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /view on github/i })).toBeVisible();
  });

  test('should handle decryption error', async ({ page }) => {
    // Mock item with invalid key
    await page.route('**/api/shadow-items', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              id: '1',
              cid: 'QmTest1',
              encryptedKey: '0xinvalidkey',
              source: 'GitHub',
              timestamp: Date.now() - 3600000,
              metadata: 'feat: Add new feature'
            }
          ]
        })
      });
    });
    
    await page.goto('/dashboard');
    
    // Click decrypt button
    await page.getByRole('button', { name: /decrypt/i }).click();
    
    // Should show error
    await expect(page.getByText(/failed to decrypt/i)).toBeVisible();
  });

  test('should delete shadow item', async ({ page }) => {
    // Mock shadow items
    await page.route('**/api/shadow-items', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              id: '1',
              cid: 'QmTest1',
              source: 'GitHub',
              timestamp: Date.now() - 3600000,
              metadata: 'feat: Add new feature'
            }
          ]
        })
      });
    });
    
    await page.goto('/dashboard');
    
    // Open item menu
    await page.getByRole('button', { name: /more options/i }).click();
    
    // Click delete
    await page.getByRole('menuitem', { name: /delete/i }).click();
    
    // Confirm deletion
    await page.getByRole('button', { name: /confirm delete/i }).click();
    
    // Should show success message
    await expect(page.getByText(/item deleted/i)).toBeVisible();
    
    // Item should be removed from list
    await expect(page.getByText(/feat: Add new feature/i)).not.toBeVisible();
  });

  test('should export shadow items', async ({ page, context }) => {
    // Mock shadow items
    await page.route('**/api/shadow-items', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              id: '1',
              cid: 'QmTest1',
              source: 'GitHub',
              timestamp: Date.now() - 3600000,
              metadata: 'feat: Add new feature',
              decrypted: {
                source: 'GitHub',
                url: 'https://github.com/user/repo/commit/abc123',
                body: 'feat: Add new feature\n\nDetailed commit message',
                timestamp: Date.now() - 3600000
              }
            }
          ]
        })
      });
    });
    
    await page.goto('/dashboard');
    
    // Setup download promise
    const downloadPromise = page.waitForEvent('download');
    
    // Click export button
    await page.getByRole('button', { name: /export data/i }).click();
    
    // Wait for download
    const download = await downloadPromise;
    
    // Check filename
    expect(download.suggestedFilename()).toContain('shadow-chain-export');
    expect(download.suggestedFilename()).toContain('.json');
  });

  test('should filter shadow items by source', async ({ page }) => {
    // Mock mixed shadow items
    await page.route('**/api/shadow-items', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              id: '1',
              cid: 'QmTest1',
              source: 'GitHub',
              timestamp: Date.now() - 3600000,
              metadata: 'GitHub commit'
            },
            {
              id: '2',
              cid: 'QmTest2',
              source: 'Twitter',
              timestamp: Date.now() - 7200000,
              metadata: 'Twitter post'
            }
          ]
        })
      });
    });
    
    await page.goto('/dashboard');
    
    // Initially both items visible
    await expect(page.getByText('GitHub commit')).toBeVisible();
    await expect(page.getByText('Twitter post')).toBeVisible();
    
    // Filter by GitHub
    await page.getByRole('combobox', { name: /filter by source/i }).selectOption('GitHub');
    
    // Only GitHub item visible
    await expect(page.getByText('GitHub commit')).toBeVisible();
    await expect(page.getByText('Twitter post')).not.toBeVisible();
    
    // Filter by Twitter
    await page.getByRole('combobox', { name: /filter by source/i }).selectOption('Twitter');
    
    // Only Twitter item visible
    await expect(page.getByText('GitHub commit')).not.toBeVisible();
    await expect(page.getByText('Twitter post')).toBeVisible();
  });

  test('should paginate shadow items', async ({ page }) => {
    // Mock many shadow items
    const items = Array.from({ length: 25 }, (_, i) => ({
      id: `${i + 1}`,
      cid: `QmTest${i + 1}`,
      source: i % 2 === 0 ? 'GitHub' : 'Twitter',
      timestamp: Date.now() - (i * 3600000),
      metadata: `Item ${i + 1}`
    }));
    
    await page.route('**/api/shadow-items', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items })
      });
    });
    
    await page.goto('/dashboard');
    
    // First page should show first 10 items
    await expect(page.getByText('Item 1')).toBeVisible();
    await expect(page.getByText('Item 10')).toBeVisible();
    await expect(page.getByText('Item 11')).not.toBeVisible();
    
    // Go to next page
    await page.getByRole('button', { name: /next page/i }).click();
    
    // Second page should show next 10 items
    await expect(page.getByText('Item 1')).not.toBeVisible();
    await expect(page.getByText('Item 11')).toBeVisible();
    await expect(page.getByText('Item 20')).toBeVisible();
  });
});