// Type definitions for Nexacro N
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
// TypeScript Version: 3.8

${ref_paths}

interface nexacroGetSetter {
    (name: string): Function|null;
}


declare global {
    interface Object {
        getSetter?: nexacroGetSetter;
        __proto__: object|null;
    }

    interface Window {
        opera?: boolean;
    }

    interface Document {
        documentMode?: number;
    }
}

export as namespace nexacro;

// Support AMD require
export = nexacro;
