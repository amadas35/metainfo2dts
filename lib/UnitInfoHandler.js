
const NexacroMetaInfoHandler = require("./MetaInfoHandler");

class NexacroMetaUnitInfoHandler extends NexacroMetaInfoHandler {
    constructor() {
        super();
    }

    #nameSpace = "nexacro.Unit";
    #unitList = [];

    parse(unitRootNode) {
        if (!unitRootNode) {
            console.error('not enough arguments for function.');
            return false;
        }

        if (unitRootNode.length == 0) {
            console.error('Not found \'UnitInfo\' tag in a metainfo file.');
            return false;
        }

        unitRootNode.forEach(unitInfoNode => {

            const unit_attrs = unitInfoNode.$;
            if (!unit_attrs) {
                console.error('An attempt was made to parse a metainfo file with an unknown or unsupported format.');
                return;
            }

            const unitId = unit_attrs.id;
            if (!unitId) {
                console.error('missing id attribute of unitinfo.');
                return;
            }

            const unitInfo = { 
                name: unitId, 
                symbols: []
            };
            this.#unitList.push(unitInfo);

            if (!unitInfoNode.Unit || unitInfoNode.Unit.length === 0) {
                return;
            }

            unitInfoNode.Unit.forEach(unitVal => {
                if (unitVal.$ && unitVal.$.symbol !== '' && unitVal.$.symbol !== 'undefined') {
                    unitInfo.symbols.push(unitVal.$.symbol);
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

        const unit_list = this.#unitList;

        let unitCodes = [];
        unit_list.forEach(unitInfo => {
            const typeName = unitInfo.name;
            const symbols = unitInfo.symbols;

            let typeValue = '';
            if (symbols.length == 0) { 
                typeValue = 'void';
            }
            else if (symbols.length == 1) {
                typeValue = `\`\${number}${symbols[0]}\``;
            }
            else {
                symbols.forEach((symbol, idx, thisArray) => thisArray[idx] = `'${symbol.replace(/'/g, '\\\'')}'`);
                typeValue = `\`\${number}\${${symbols.join('|')}}\``;
            }

            unitCodes.push(`type ${typeName} = ${typeValue};`);
        });

        return this.#getDeclarationCode(this.#nameSpace, unitCodes);
    }

    #getDeclarationCode (nameSpace, unitCodes) {
        return `${NexacroMetaInfoHandler.headerComment};
    
declare namespace ${nameSpace} {
    ${unitCodes.join('\n\t')}
}
`;
    }
}

module.exports = NexacroMetaUnitInfoHandler;
