// Route Lexer - Tokenization for aviation routes
// Converts raw input string into structured tokens

/**
 * Tokenize route input into structured tokens
 * @param {string} input - Raw route string
 * @returns {Array} Array of token objects
 */
function tokenize(input) {
    if (!input || typeof input !== 'string') {
        return [];
    }

    // Normalize: uppercase and split on whitespace
    const rawTokens = input
        .trim()
        .toUpperCase()
        .split(/\s+/)
        .filter(t => t.length > 0);

    // Create structured token objects
    return rawTokens.map((text, index) => ({
        text: text,           // Token text (uppercase)
        index: index,         // Position in token array
        type: null,           // Will be filled by parser/resolver
        raw: input.split(/\s+/)[index] || text  // Original case
    }));
}

/**
 * Get token at specific index (null if out of bounds)
 * @param {Array} tokens - Token array
 * @param {number} index - Index to retrieve
 * @returns {Object|null} Token or null
 */
function peek(tokens, index) {
    return index >= 0 && index < tokens.length ? tokens[index] : null;
}

/**
 * Check if token matches a pattern
 * @param {Object} token - Token object
 * @param {RegExp} pattern - Regex pattern
 * @returns {boolean} True if matches
 */
function matches(token, pattern) {
    return token && pattern.test(token.text);
}

// ============================================
// EXPORTS
// ============================================

window.RouteLexer = {
    tokenize,
    peek,
    matches
};
