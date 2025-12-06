/**
 * Document Chunker - Splits large documents into semantic chunks for vector embedding
 *
 * Designed for:
 * - Markdown documentation files
 * - Code files (preserves function boundaries)
 * - General text content
 *
 * Features:
 * - Preserves header context in chunks
 * - Configurable chunk size and overlap
 * - Semantic boundary detection
 */

class DocumentChunker {
  constructor(options = {}) {
    this.maxChunkSize = options.maxChunkSize || 2000; // characters
    this.overlapSize = options.overlapSize || 200; // overlap between chunks
    this.minChunkSize = options.minChunkSize || 100;
  }

  /**
   * Chunk a markdown document into semantic sections
   * Preserves header hierarchy for context
   *
   * @param {string} content - Markdown content
   * @param {object} metadata - Base metadata for all chunks
   * @returns {Array<{content: string, metadata: object}>}
   */
  chunkMarkdown(content, metadata = {}) {
    const chunks = [];
    const lines = content.split('\n');

    let currentChunk = '';
    let currentHeaders = [];
    let chunkIndex = 0;

    for (const line of lines) {
      // Check if line is a header
      const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);

      if (headerMatch) {
        // Save current chunk if it has content
        if (currentChunk.trim().length >= this.minChunkSize) {
          chunks.push({
            content: this.buildChunkContent(currentHeaders, currentChunk),
            metadata: {
              ...metadata,
              chunkIndex,
              headers: currentHeaders.map(h => h.text)
            }
          });
          chunkIndex++;
        }

        // Update header stack
        const level = headerMatch[1].length;
        const headerText = headerMatch[2];

        // Remove headers of same or lower level
        currentHeaders = currentHeaders.filter(h => h.level < level);
        currentHeaders.push({ level, text: headerText });

        currentChunk = '';
      } else {
        // Add line to current chunk
        if (currentChunk.length + line.length > this.maxChunkSize) {
          // Save chunk and start new one with overlap
          if (currentChunk.trim().length >= this.minChunkSize) {
            chunks.push({
              content: this.buildChunkContent(currentHeaders, currentChunk),
              metadata: {
                ...metadata,
                chunkIndex,
                headers: currentHeaders.map(h => h.text)
              }
            });
            chunkIndex++;
          }

          // Keep overlap from end of previous chunk
          currentChunk = currentChunk.slice(-this.overlapSize) + '\n' + line;
        } else {
          currentChunk += (currentChunk ? '\n' : '') + line;
        }
      }
    }

    // Don't forget the last chunk
    if (currentChunk.trim().length >= this.minChunkSize) {
      chunks.push({
        content: this.buildChunkContent(currentHeaders, currentChunk),
        metadata: {
          ...metadata,
          chunkIndex,
          headers: currentHeaders.map(h => h.text)
        }
      });
    }

    return chunks;
  }

  /**
   * Build chunk content with header context
   */
  buildChunkContent(headers, content) {
    const headerContext = headers
      .map(h => `${'#'.repeat(h.level)} ${h.text}`)
      .join('\n');

    return headerContext
      ? `${headerContext}\n\n${content.trim()}`
      : content.trim();
  }

  /**
   * Chunk code files (preserves function boundaries where possible)
   *
   * @param {string} content - Code content
   * @param {object} metadata - Base metadata
   * @returns {Array<{content: string, metadata: object}>}
   */
  chunkCode(content, metadata = {}) {
    const chunks = [];
    const lines = content.split('\n');

    let currentChunk = '';
    let chunkIndex = 0;
    let braceDepth = 0;

    for (const line of lines) {
      currentChunk += (currentChunk ? '\n' : '') + line;

      // Track brace depth for function boundaries
      braceDepth += (line.match(/{/g) || []).length;
      braceDepth -= (line.match(/}/g) || []).length;

      // Chunk at function boundaries or size limit
      const atFunctionBoundary = braceDepth === 0 && currentChunk.trim().length >= this.minChunkSize;
      const atSizeLimit = currentChunk.length >= this.maxChunkSize;

      if (atFunctionBoundary || atSizeLimit) {
        chunks.push({
          content: currentChunk.trim(),
          metadata: {
            ...metadata,
            chunkIndex,
            type: 'code'
          }
        });
        chunkIndex++;
        currentChunk = '';
      }
    }

    // Don't forget remaining content
    if (currentChunk.trim()) {
      chunks.push({
        content: currentChunk.trim(),
        metadata: {
          ...metadata,
          chunkIndex,
          type: 'code'
        }
      });
    }

    return chunks;
  }

  /**
   * Chunk plain text with sentence awareness
   *
   * @param {string} content - Plain text content
   * @param {object} metadata - Base metadata
   * @returns {Array<{content: string, metadata: object}>}
   */
  chunkText(content, metadata = {}) {
    const chunks = [];
    const sentences = content.split(/(?<=[.!?])\s+/);

    let currentChunk = '';
    let chunkIndex = 0;

    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > this.maxChunkSize) {
        if (currentChunk.trim().length >= this.minChunkSize) {
          chunks.push({
            content: currentChunk.trim(),
            metadata: {
              ...metadata,
              chunkIndex
            }
          });
          chunkIndex++;
        }
        currentChunk = sentence;
      } else {
        currentChunk += (currentChunk ? ' ' : '') + sentence;
      }
    }

    if (currentChunk.trim().length >= this.minChunkSize) {
      chunks.push({
        content: currentChunk.trim(),
        metadata: {
          ...metadata,
          chunkIndex
        }
      });
    }

    return chunks;
  }

  /**
   * Auto-detect content type and chunk accordingly
   *
   * @param {string} content - Content to chunk
   * @param {string} filename - Original filename (for type detection)
   * @param {object} metadata - Base metadata
   * @returns {Array<{content: string, metadata: object}>}
   */
  autoChunk(content, filename = '', metadata = {}) {
    const ext = filename.split('.').pop()?.toLowerCase();

    // Markdown files
    if (ext === 'md' || content.includes('# ')) {
      return this.chunkMarkdown(content, { ...metadata, source: filename });
    }

    // Code files
    if (['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'go', 'rs'].includes(ext)) {
      return this.chunkCode(content, { ...metadata, source: filename, language: ext });
    }

    // Default to text chunking
    return this.chunkText(content, { ...metadata, source: filename });
  }
}

module.exports = new DocumentChunker();
