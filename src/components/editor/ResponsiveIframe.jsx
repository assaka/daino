import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * ResponsiveIframe - Renders content in an iframe with viewport constraints
 * This enables true responsive behavior without transforming classes
 */
export function ResponsiveIframe({ viewport = 'desktop', children, className = '' }) {
  const iframeRef = useRef(null);
  const [iframeDocument, setIframeDocument] = useState(null);
  const isInitialized = useRef(false);

  const getViewportStyles = () => {
    switch (viewport) {
      case 'mobile':
        return { width: '375px', height: '100%' };
      case 'tablet':
        return { width: '768px', height: '100%' };
      case 'desktop':
      default:
        return { width: '100%', height: '100%' };
    }
  };

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    // Only initialize once
    if (isInitialized.current) return;
    isInitialized.current = true;

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) return;

    // Get all stylesheets from parent document
    const parentStylesheets = Array.from(document.styleSheets);

    // Set up iframe document
    iframeDoc.open();
    iframeDoc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              margin: 0;
              padding: 0;
              overflow-x: hidden;
            }
          </style>
        </head>
        <body>
          <div id="root"></div>
        </body>
      </html>
    `);
    iframeDoc.close();

    // Copy all stylesheets to iframe
    parentStylesheets.forEach((stylesheet) => {
      try {
        if (stylesheet.href) {
          // External stylesheet
          const link = iframeDoc.createElement('link');
          link.rel = 'stylesheet';
          link.href = stylesheet.href;
          iframeDoc.head.appendChild(link);
        } else if (stylesheet.cssRules) {
          // Inline stylesheet
          const style = iframeDoc.createElement('style');
          Array.from(stylesheet.cssRules).forEach((rule) => {
            style.appendChild(iframeDoc.createTextNode(rule.cssText));
          });
          iframeDoc.head.appendChild(style);
        }
      } catch (e) {
        // Handle CORS errors for external stylesheets
        console.warn('Could not copy stylesheet:', e);
      }
    });

    setIframeDocument(iframeDoc);
  }, []);

  const viewportStyles = getViewportStyles();
  const wrapperClass = viewport === 'desktop'
    ? `${className} h-full`
    : `${className} mx-auto bg-gray-50 py-4 h-full`;

  return (
    <div className={wrapperClass} style={{ minHeight: '100vh' }}>
      <iframe
        ref={iframeRef}
        style={{
          ...viewportStyles,
          border: viewport === 'desktop' ? 'none' : '1px solid #e5e7eb',
          borderRadius: viewport === 'desktop' ? '0' : '8px',
          boxShadow: viewport === 'desktop' ? 'none' : '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          display: 'block',
          margin: viewport === 'desktop' ? '0' : '0 auto',
          minHeight: viewport === 'desktop' ? '100vh' : '667px'
        }}
        title="Responsive Preview"
      />
      {iframeDocument && createPortal(
        children,
        iframeDocument.getElementById('root')
      )}
    </div>
  );
}
