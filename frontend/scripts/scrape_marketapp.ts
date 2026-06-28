import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
    console.log('Starting MarketApp scraper...');
    
    // Create CSV file with headers
    const csvPath = path.join(__dirname, '..', '..', 'backend', 'data', 'historical_sales.csv');
    // Ensure directory exists
    const dir = path.dirname(csvPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(csvPath, 'sale_date,username,price_ton\n');

    // Launch browser
    const browser = await chromium.launch({ headless: false }); // Set false so you can see it and solve captcha if needed
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    console.log('Navigating to MarketApp sales page...');
    await page.goto('https://marketapp.org/collection/EQCA14o1-VWhS2efqoh_9M1b_A9DtKTuoqfmkn83AbJzwnPi/sales/', { timeout: 60000 });

    console.log('Waiting for table to load...');
    await page.waitForSelector('table tbody tr', { timeout: 30000 });

    console.log('\n======================================================');
    console.log('🚨 ATTENTION: PLEASE SORT THE PAGE MANUALLY 🚨');
    console.log('You have 20 seconds to click the sort button on the website');
    console.log('and arrange the sales from HIGHEST to LOWEST price.');
    console.log('======================================================\n');
    
    // Countdown timer for 20 seconds
    for (let i = 20; i > 0; i--) {
        process.stdout.write(`Starting scrape in ${i} seconds...\r`);
        await page.waitForTimeout(1000);
    }
    console.log('\nStarting to scrape now!');

    const targetRecords = 100000;
    const scrapedUsernames = new Set();
    let totalScraped = 0;

    console.log(`Starting to scrape up to ${targetRecords} records. This will take a while as it scrolls...`);

    let previousHeight = 0;
    let noNewDataCount = 0;

    while (totalScraped < targetRecords) {
        // Extract rows currently in DOM
        const rows = await page.$$eval('table tbody tr', (elements) => {
            return elements.map(tr => {
                const tds = tr.querySelectorAll('td');
                if (tds.length >= 3) {
                    // This matches the copy-pasted format you provided
                    let dateText = tds[0].innerText.trim().replace(/\n/g, ' ');
                    let usernameText = tds[1].innerText.trim();
                    let priceText = tds[2].innerText.trim().replace(/,/g, ''); // Remove commas from price
                    return { dateText, usernameText, priceText };
                }
                return null;
            }).filter(Boolean);
        });

        let newRecordsInThisBatch = 0;

        for (const row of rows) {
            if (!row) continue;
            
            // Cleanup username (remove @)
            let username = row.usernameText;
            if (username.startsWith('@')) {
                username = username.substring(1);
            }

            // Create a unique key to prevent duplicates
            const uniqueKey = `${username}_${row.priceText}_${row.dateText}`;
            
            if (!scrapedUsernames.has(uniqueKey) && username !== '' && row.priceText !== '') {
                scrapedUsernames.add(uniqueKey);
                
                // Write to CSV
                // Format: sale_date,username,price_ton
                const csvLine = `"${row.dateText}","${username}",${row.priceText}\n`;
                fs.appendFileSync(csvPath, csvLine);
                
                totalScraped++;
                newRecordsInThisBatch++;
                
                if (totalScraped % 500 === 0) {
                    console.log(`Scraped ${totalScraped} records so far...`);
                }
                
                if (totalScraped >= targetRecords) break;
            }
        }

        if (totalScraped >= targetRecords) break;

        // Scroll down to load more
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        
        // Wait for new data to load
        await page.waitForTimeout(2000); // 2 seconds wait

        // Check if we hit the bottom and no new data is loading
        const currentHeight = await page.evaluate(() => document.body.scrollHeight);
        if (currentHeight === previousHeight && newRecordsInThisBatch === 0) {
            noNewDataCount++;
            if (noNewDataCount > 5) { // Try 5 times before giving up
                console.log('Reached the end of the available list or API is rate-limiting.');
                break;
            }
        } else {
            noNewDataCount = 0;
            previousHeight = currentHeight;
        }
    }

    console.log(`\nFinished! Successfully scraped ${totalScraped} records.`);
    console.log(`File saved at: ${csvPath}`);

    await browser.close();
}

run().catch(console.error);
