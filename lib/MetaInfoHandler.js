
const strHeaderComment = `// Type definitions for Nexacro N
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
// TypeScript Version: 4.3`;

class NexacroMetaInfoHandler {
    constructor() {
        this.#parsed = false;
    }

    #parsed = false;

    static headerComment = strHeaderComment;

    isParsed() { 
        return this.#parsed;
    }

    parseDone() {
        this.#parsed = true;
        return this.isParsed();
    }

    parse() {
        return this.parseDone();
    }

    toDTS() {
        return '';
    }
}

module.exports = NexacroMetaInfoHandler;
