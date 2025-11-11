// Test Route Parser - New parser architecture
// Tests for lexer, parser, resolver, and engine

TestFramework.describe('Route Parser Architecture', function({ it }) {

    // ============================================
    // TEST LEXER
    // ============================================

    it('RouteLexer.tokenize() should split and normalize input', () => {
        const input = "kord Payge q822 gonzz";
        const tokens = window.RouteLexer.tokenize(input);

        assert.equals(tokens.length, 4, 'Should have 4 tokens');
        assert.equals(tokens[0].text, 'KORD', 'First token should be KORD');
        assert.equals(tokens[1].text, 'PAYGE', 'Second token should be PAYGE');
        assert.equals(tokens[2].text, 'Q822', 'Third token should be Q822');
        assert.equals(tokens[3].text, 'GONZZ', 'Fourth token should be GONZZ');
        assert.equals(tokens[0].index, 0, 'First token index should be 0');
    });

    it('RouteLexer.tokenize() should handle empty input', () => {
        const tokens = window.RouteLexer.tokenize('');
        assert.equals(tokens.length, 0, 'Empty input should return empty array');
    });

    it('RouteLexer.tokenize() should filter extra whitespace', () => {
        const input = "  KORD    PAYGE  ";
        const tokens = window.RouteLexer.tokenize(input);

        assert.equals(tokens.length, 2, 'Should have 2 tokens');
        assert.equals(tokens[0].text, 'KORD', 'First token should be KORD');
    });

    // ============================================
    // TEST PARSER
    // ============================================

    it('RouteParser should recognize airway segment pattern', () => {
        const tokens = window.RouteLexer.tokenize('PAYGE Q822 GONZZ');
        const result = window.RouteParser.parse(tokens);

        assert.equals(result.tree.length, 1, 'Should have 1 node');
        assert.equals(result.tree[0].type, 'AIRWAY_SEGMENT', 'Should be airway segment');
        assert.equals(result.tree[0].from.text, 'PAYGE', 'From should be PAYGE');
        assert.equals(result.tree[0].airway.text, 'Q822', 'Airway should be Q822');
        assert.equals(result.tree[0].to.text, 'GONZZ', 'To should be GONZZ');
    });

    it('RouteParser should recognize procedure with transition', () => {
        const tokens = window.RouteLexer.tokenize('MTHEW.CHPPR1');
        const result = window.RouteParser.parse(tokens);

        assert.equals(result.tree.length, 1, 'Should have 1 node');
        assert.equals(result.tree[0].type, 'PROCEDURE', 'Should be procedure');
        assert.equals(result.tree[0].transition, 'MTHEW', 'Transition should be MTHEW');
        assert.equals(result.tree[0].procedure, 'CHPPR1', 'Procedure should be CHPPR1');
        assert.isTrue(result.tree[0].explicit, 'Should be explicit transition');
    });

    it('RouteParser should recognize procedure base (auto-transition)', () => {
        const tokens = window.RouteLexer.tokenize('CHPPR1');
        const result = window.RouteParser.parse(tokens);

        assert.equals(result.tree.length, 1, 'Should have 1 node');
        assert.equals(result.tree[0].type, 'PROCEDURE_OR_WAYPOINT', 'Should be procedure or waypoint');
        assert.equals(result.tree[0].procedureName, 'CHPPR', 'Procedure name should be CHPPR');
        assert.equals(result.tree[0].procedureNumber, '1', 'Procedure number should be 1');
        assert.isFalse(result.tree[0].explicit, 'Should not be explicit transition');
    });

    it('RouteParser should recognize coordinates', () => {
        const tokens = window.RouteLexer.tokenize('4814N/06848W');
        const result = window.RouteParser.parse(tokens);

        assert.equals(result.tree.length, 1, 'Should have 1 node');
        assert.equals(result.tree[0].type, 'COORDINATE', 'Should be coordinate');
    });

    it('RouteParser should recognize DCT keyword', () => {
        const tokens = window.RouteLexer.tokenize('DCT');
        const result = window.RouteParser.parse(tokens);

        assert.equals(result.tree.length, 1, 'Should have 1 node');
        assert.equals(result.tree[0].type, 'DIRECT', 'Should be direct');
    });

    it('RouteParser should parse complex route', () => {
        const tokens = window.RouteLexer.tokenize('KORD PAYGE Q822 GONZZ DCT MTHEW.CHPPR1 KATL');
        const result = window.RouteParser.parse(tokens);

        assert.equals(result.tree.length, 5, 'Should have 5 nodes');
        // Note: KORD/KATL marked as PROCEDURE_OR_WAYPOINT - resolver will determine actual type
        assert.isTrue(
            result.tree[0].type === 'WAYPOINT' || result.tree[0].type === 'PROCEDURE_OR_WAYPOINT',
            'First should be waypoint or ambiguous'
        );
        assert.equals(result.tree[1].type, 'AIRWAY_SEGMENT', 'Second should be airway segment');
        assert.equals(result.tree[2].type, 'DIRECT', 'Third should be direct');
        assert.equals(result.tree[3].type, 'PROCEDURE', 'Fourth should be procedure');
        assert.isTrue(
            result.tree[4].type === 'WAYPOINT' || result.tree[4].type === 'PROCEDURE_OR_WAYPOINT',
            'Fifth should be waypoint or ambiguous'
        );
    });

    it('RouteParser should handle chained airways', () => {
        const tokens = window.RouteLexer.tokenize('PAYGE Q822 GONZZ Q822 FNT');
        const result = window.RouteParser.parse(tokens);

        assert.equals(result.tree.length, 2, 'Should have 2 airway segments');
        assert.equals(result.tree[0].type, 'AIRWAY_SEGMENT', 'First should be airway segment');
        assert.equals(result.tree[0].from.text, 'PAYGE', 'First from should be PAYGE');
        assert.equals(result.tree[0].to.text, 'GONZZ', 'First to should be GONZZ');
        assert.equals(result.tree[1].type, 'AIRWAY_SEGMENT', 'Second should be airway segment');
        assert.equals(result.tree[1].from.text, 'GONZZ', 'Second from should be GONZZ');
        assert.equals(result.tree[1].to.text, 'FNT', 'Second to should be FNT');
    });

});
