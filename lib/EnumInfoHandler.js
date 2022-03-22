
const path = require("path");  
const NexacroMetaInfoHandler = require("./MetaInfoHandler");

class NexacroMetaEnumInfoHandler extends NexacroMetaInfoHandler {
    constructor() {
        super();
    }

    #nameSpace = "nexacro.Enum";
    #enumList = [];

    parse(enumRootNode) {
        if (!enumRootNode) {
            console.error('not enough arguments for function.');
            return false;
        }

        if (enumRootNode.length == 0) {
            console.error('Not found \'EnumInfo\' tag in a metainfo file.');
            return false;
        }

        enumRootNode.forEach(enumInfoNode => {

            const enum_attrs = enumInfoNode.$;
            if (!enum_attrs) {
                console.error('An attempt was made to parse a metainfo file with an unknown or unsupported format.');
                return;
            }

            const enumId = enum_attrs.id;
            if (!enumId) {
                console.error('missing id attribute of enuminfo.');
                return;
            }

            const enumInfo = { 
                name: enumId, 
                composite: (enum_attrs.composit === 'true'), 
                delimiter: enum_attrs.delimiter,
                values: []
            };
            this.#enumList.push(enumInfo);

            if (!enumInfoNode.Enum || enumInfoNode.Enum.length === 0) {
                return;
            }

            enumInfoNode.Enum.forEach(enumVal => {
                if (enumVal.$) {
                    enumInfo.values.push(enumVal.$.name.replace(/'/g, '\\\''));
                }
            });

        });

        return super.parseDone();
    }

    toDTS(option) {
        if (!this.isParsed())
            return '';

        return this.#generateTypeCode(option)
    }

    #generateTypeCode () {

        const enum_list = this.#enumList;

        let enumCodes = [];
        enum_list.forEach(enuminfo => {
            const typeName = enuminfo.name;
            const isComposite = enuminfo.composite;
            const delimiter = enuminfo.delimiter;

            const normalEnumTypeValue = `'${enuminfo.values.join('\' | \'')}'`;
            const compositeEnumTypeValue = `\`\${${normalEnumTypeValue}}\` | \`\${${normalEnumTypeValue}}${delimiter}\${string}\``;

            enumCodes.push(`type ${typeName} = ${isComposite ? compositeEnumTypeValue : normalEnumTypeValue};`);
        });

        return this.#getDeclarationCode(this.#nameSpace, enumCodes);
    }

    #getDeclarationCode (nameSpace, enumCodes) {
        return `${NexacroMetaInfoHandler.headerComment};
    
declare namespace ${nameSpace} {
    ${enumCodes.join('\n\t')}
}
`;
    }
}

module.exports = NexacroMetaEnumInfoHandler;
