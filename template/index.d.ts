// Type definitions for Nexacro N
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
// TypeScript Version: 3.8

${ref_types ? ref_types.map((types) => `/// <reference types="${types}" />`).join('\n') : ''}

${ref_paths ? ref_paths.map((path) => `/// <reference path="${path}" />`).join('\n') : ''}

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

    function trace(...args: any[]): void;
}

export as namespace nexacro;

// Support AMD require
export = nexacro;
