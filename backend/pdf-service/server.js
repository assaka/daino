require('dotenv').config();
const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Large limit for HTML content

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'PDF Generator',
    timestamp: new Date().toISOString()
  });
});

// Generate PDF endpoint
app.post('/generate-pdf', async (req, res) => {
  const requestId = Math.random().toString(36).substring(7);

  try {
    console.log(`📄 [${requestId}] PDF generation request received`);

    const { html, options = {} } = req.body;

    if (!html) {
      return res.status(400).json({
        success: false,
        error: 'HTML content is required'
      });
    }

    console.log(`📄 [${requestId}] HTML length: ${html.length} characters`);
    console.log(`📄 [${requestId}] Options:`, options);

    // Launch browser
    console.log(`🚀 [${requestId}] Launching Chromium...`);
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--disable-extensions'
      ],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium'
    });

    try {
      const page = await browser.newPage();
      console.log(`📄 [${requestId}] Setting HTML content...`);

      await page.setContent(html, {
        waitUntil: 'networkidle0',
        timeout: 30000
      });

      console.log(`📄 [${requestId}] Generating PDF...`);
      const pdfBuffer = await page.pdf({
        format: options.format || 'A4',
        printBackground: true,
        margin: options.margin || {
          top: '20px',
          right: '20px',
          bottom: '20px',
          left: '20px'
        }
      });

      console.log(`✅ [${requestId}] PDF generated successfully! Size: ${pdfBuffer.length} bytes`);

      // Return PDF as base64
      res.json({
        success: true,
        pdf: pdfBuffer.toString('base64'),
        size: pdfBuffer.length
      });

    } finally {
      await browser.close();
      console.log(`🔒 [${requestId}] Browser closed`);
    }

  } catch (error) {
    console.error(`❌ [${requestId}] PDF generation error:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Capture screenshot endpoint
app.post('/capture-screenshot', async (req, res) => {
  const requestId = Math.random().toString(36).substring(7);

  try {
    console.log(`📸 [${requestId}] Screenshot capture request received`);

    const { url, options = {} } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL is required'
      });
    }

    console.log(`📸 [${requestId}] URL: ${url}`);
    console.log(`📸 [${requestId}] Options:`, options);

    // Launch browser with performance optimizations
    console.log(`🚀 [${requestId}] Launching Chromium...`);
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-default-apps',
        '--disable-sync',
        '--disable-translate',
        '--metrics-recording-only',
        '--mute-audio',
        '--no-first-run',
        '--safebrowsing-disable-auto-update',
        '--ignore-certificate-errors',
        '--ignore-ssl-errors',
        '--disable-features=TranslateUI',
        '--disable-renderer-backgrounding',
        '--enable-features=NetworkService,NetworkServiceInProcess',
        '--force-color-profile=srgb'
      ],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium'
    });

    try {
      const page = await browser.newPage();

      // Block unnecessary resources for faster loading
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        const resourceType = request.resourceType();
        // Block fonts, media, and other non-essential resources
        if (['media', 'font', 'websocket', 'manifest', 'other'].includes(resourceType)) {
          request.abort();
        } else {
          request.continue();
        }
      });

      // Set viewport size
      await page.setViewport({
        width: options.viewportWidth || 1920,
        height: options.viewportHeight || 1080,
        deviceScaleFactor: options.deviceScaleFactor || 1
      });

      console.log(`📸 [${requestId}] Navigating to URL...`);

      // Navigate to the page - use domcontentloaded for fastest response
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 30000 // 30 second navigation timeout
      });

      console.log(`📸 [${requestId}] DOM loaded, waiting for images...`);

      // Wait for images to load (with timeout)
      try {
        await page.evaluate(() => {
          return Promise.all(
            Array.from(document.images)
              .filter(img => !img.complete)
              .map(img => new Promise((resolve) => {
                img.onload = img.onerror = resolve;
                setTimeout(resolve, 5000); // Max 5s per image
              }))
          );
        });
      } catch (e) {
        console.log(`📸 [${requestId}] Some images may not have loaded`);
      }

      // Short additional wait for any final rendering
      const waitTime = options.waitTime || 1000; // Default to 1 second
      await new Promise(resolve => setTimeout(resolve, waitTime));
      console.log(`📸 [${requestId}] Waited ${waitTime}ms for final render`)

      console.log(`📸 [${requestId}] Capturing screenshot...`);

      // Take screenshot (JPEG is faster than PNG)
      const format = options.format || 'jpeg';
      const screenshotOptions = {
        type: format,
        fullPage: options.fullPage !== false, // Default to true
        encoding: 'binary'
      };

      // Add quality for JPEG
      if (format === 'jpeg') {
        screenshotOptions.quality = options.quality || 80;
      }

      const screenshotBuffer = await page.screenshot(screenshotOptions);

      console.log(`✅ [${requestId}] Screenshot captured! Size: ${screenshotBuffer.length} bytes`);

      // Return screenshot as base64
      res.json({
        success: true,
        screenshot: screenshotBuffer.toString('base64'),
        size: screenshotBuffer.length,
        format: options.format || 'png',
        viewport: {
          width: options.viewportWidth || 1920,
          height: options.viewportHeight || 1080
        }
      });

    } finally {
      await browser.close();
      console.log(`🔒 [${requestId}] Browser closed`);
    }

  } catch (error) {
    console.error(`❌ [${requestId}] Screenshot capture error:`, error);
    console.error(`❌ [${requestId}] Error stack:`, error.stack);
    console.error(`❌ [${requestId}] Error type:`, error.constructor.name);

    // Provide more specific error messages
    let errorMessage = error.message;
    if (error.message.includes('timeout')) {
      errorMessage = `Page load timeout: The page took too long to load (>30s)`;
    } else if (error.message.includes('net::ERR')) {
      errorMessage = `Network error: Unable to reach the URL - ${error.message}`;
    } else if (error.message.includes('Navigation failed')) {
      errorMessage = `Navigation failed: The page could not be loaded - ${error.message}`;
    }

    res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log('='.repeat(60));
  console.log(`📄 PDF & Screenshot Service running on port ${PORT}`);
  console.log(`📄 Health check: http://localhost:${PORT}/health`);
  console.log(`📄 Generate PDF: POST http://localhost:${PORT}/generate-pdf`);
  console.log(`📸 Capture Screenshot: POST http://localhost:${PORT}/capture-screenshot`);
  console.log(`📄 Chromium path: ${process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium'}`);
  console.log('='.repeat(60));
});
