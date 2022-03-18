
const path = require("path");  
const NexacroMetaInfoHandler = require("./MetaInfoHandler");

// 임시: metainfo에 관련 정보를 추가해야 함.
const static_clsnames = [
    'nexacroAPI',
    'Application',
    'Layout'
];

class NexacroMetaObjectInfoHandler extends NexacroMetaInfoHandler {
    constructor() {
        super();
    }

    #nameSpace = "nexacro";

    #typeName = "";     /* object class type name (from object id) */
    #superTypeName;     /* object super class type name (from objectinfo.inheritance) */
    #className = "";    /* object real class name (from objectinfo.classname) */

    #omitList = [];
    #properties = [];
    #methods = [];

    parse(objRootNode) {

        if (!objRootNode) {
            console.error('not enough arguments for function.');
            return false;
        }

        if (objRootNode.length == 0) {
            console.error('Not found \'Object\' tag in a metainfo file.');
            return false;
        }

        const objNode = objRootNode[0];

        const objId = objNode.$.id;
        const objInfos = objNode.ObjectInfo;

        if (!objId || !objInfos || objInfos.length < 1) {
            console.error('An attempt was made to parse a metainfo file with an unknown or unsupported format.');
            return false;
        }

        /* parse class type info */
        this.#parseClassInfo(objId, objInfos[0].$);

        if (objNode.PropertyInfo && objNode.PropertyInfo.length > 0) {
            const propertyInfos = objNode.PropertyInfo[0].Property;

            if (propertyInfos) {
                propertyInfos.forEach(propertyInfo => this.#parsePropertyInfo(propertyInfo));
            }
        }

        if (objNode.MethodInfo && objNode.MethodInfo.length > 0) {
            const methodInfos = objNode.MethodInfo[0].Method;

            if (methodInfos) {
                methodInfos.forEach(methodInfo => this.#parseMethodInfo(methodInfo));
            }
        }

        if (objNode.EventHandlerInfo && objNode.EventHandlerInfo.length > 0) {
            const eventhandlerInfos = objNode.EventHandlerInfo[0].EventHandler;

            if (eventhandlerInfos) {
                if (!this.#superTypeName) {
                    this.#superTypeName = "nexacro.EventSinkObject";     
                }
                
                eventhandlerInfos.forEach(eventHandlerInfo => this.#parseEventHandlerInfo(eventHandlerInfo));
            }
        }

        return super.parseDone();
    }

    toDTS() {
        if (!this.isParsed())
            return '';

        return this.#generateInterfaceCode()
    }

    #parseClassInfo (objId, objInfo) {
        const idKeys = objId.split('.');
        if (idKeys.length > 2) {
            throw new Error('The maximum number of namespaces cannot exceed 1.');
        }
    
        let nameSpace = 'nexacro', typeName, className;
        if (idKeys.length === 1) {
            className = typeName = idKeys[0];
        }
        else
        {
            nameSpace = idKeys[0]
            className = typeName = idKeys[1];
        }
    
        let superTypeName;
        if (objInfo) {
            // final class decorator가 없다
            // inheritance 정보가 정확히 들어가지 않은게 있음
            superTypeName = objInfo.inheritance;
    
            if (objInfo.classname && objId != objInfo.classname) {
                const clsKeys = objInfo.classname.split('.');
                if (clsKeys.length > 0) {
                    className = clsKeys[clsKeys.length-1];
                }
            }
        }
    
        if (!superTypeName) {
            if (objInfo.subgroup === "EventInfo" || typeName.endsWith("EventInfo")) {
                superTypeName = "nexacro.EventInfo";
            }       
        }

        this.#nameSpace = nameSpace;
        this.#typeName = typeName;
        this.#superTypeName = superTypeName;
        this.#className = className;
    }

    #getPropertyType (propertyAttrNode) {

        let propType = 'any';

        const editType = propertyAttrNode.edittype;
        switch (editType)
        {
            case 'Boolean':
                propType = 'boolean';
                break;

            case 'Number':
                propType = 'number';
                // normal type일 때는 unitinfo 무시

                if (propertyAttrNode.group === 'Style' && propertyAttrNode.unitinfo) {
                    propType = `nexacro.Unit.${propertyAttrNode.unitinfo}`; // it is not number type
                }
                break;

            case 'Number2': 
                let delimiter = propertyAttrNode.delimiter;
                if (!delimiter || delimiter.length == 0) delimiter = ' ';

                // ex) buttonsize (edittype='Number2' & unitinfo='Size')
                // Number2 type의 경우, unit symbol을 값에 사용하지 않는다?
                propType = `number | \`\${number}\` | \`\${number}${delimiter}\${number}\``;
                break;
            
            case 'Enum':
                if (propertyAttrNode.enuminfo === "NamedColor") {
                    propType = 'string';
                }
                else {
                    propType = propertyAttrNode.enuminfo ? `nexacro.Enum.${propertyAttrNode.enuminfo}` : 'any';
                }
                break;

            case 'Enum2':
                // Enum2 = '<enum value><delimiter><enum2 value>'; 
                //   delimiter : default=' '
                if (propertyAttrNode.enuminfo && propertyAttrNode.enuminfo2) {
                    const enum1Type = `nexacro.Enum.${propertyAttrNode.enuminfo}`;
                    const enum2Type = `nexacro.Enum.${propertyAttrNode.enuminfo2}`;
                    const delimiter = propertyAttrNode.delimiter || ' ';
                    propType = `${enum1Type} | \`\${${enum1Type}}${delimiter}\${${enum2Type}}\``;
                }
                else {
                    propType = 'any';
                }
                break;

            case 'Object':
                // object type 보다는 실제 Object의 Type을 명시해주는 것이 좋은데 알수가 없다. 
                // edittype='Object' 일 때, 'objectinfo' 속성등이 비어있어, Object Reference 정보를 찾을 수 없다.
                // ex: hscrollbar, components, fromobject 등 
                // + TOPS에 데이터느 들어가 있으나 metainfo 파일 생성 시 누락되는 것 같다고 함.
                // + array도 object type임
                propType = 'object';

                break;

            case 'HotKey':
                // edittype이 'enum'이 아니지만, enuminfo가 지정된 경우 (ex. HotKey)
                if (propertyAttrNode.enuminfo) 
                {
                    propType = `nexacro.Enum.${propertyAttrNode.enuminfo}`;
                }
                else {
                    propType = 'string';
                }
                break;

            case 'Position':
                if (propertyAttrNode.unitinfo === 'PixelPercent') {
                    // ex:control.left (edittype='Position' & unitinfo='PixelPercent')
                    // nexacro.Rect의 left, ... 등 position property의 경우, 
                    // 실제 값은 number type 만 처리 가능한데 edittype=position, unitinfo=Pixel로 지정되어 있음
                    propType = `number | nexacro.Unit.${propertyAttrNode.unitinfo}`;
                }
                else {
                    propType = 'number';
                }

                break;

            case 'PositionBase':
                //str_propType = 'number | \`${number}${\'px\'|\'%\'}\` | \`${string}:${number}${\'px\'|\'%\'}\`';
                const unitType = 'nexacro.Unit.PixelPercent';
                propType = `number | ${unitType} | \`\${string}:\${${unitType}}\``;

                // PositionBase Type일 경우, unitinfo를 사용하지 않음.
                // empty string type guard할 수 없음

                break;

            case '':
                if (propertyAttrNode.name === "fromobject" || propertyAttrNode.name === "fromreferenceobject") {
                    propType = 'object';
                } 
                else {
                    propType = 'any';
                }
                break;

            default:

                // String
                // MultilineString
                // ID
                // DatasetID, ColumnID, IconID, ImageID.... xxxID
                // FileName
                // URL
                // CssClass
                // Color, Font, Background, ..., Style Properties
                // Border
                // ...
                propType = 'string';

                break;
            
        }

        return propType;
    }

    #getVariableType (typeString, undefinedType) {

        if (undefinedType === undefined) undefinedType = 'any';
        if (!typeString) return undefinedType;
    
        let metaTypes = typeString.split(','), valTypes = [];
        metaTypes.forEach(type => {
    
            type = type.trim();
            switch (type)
            {
                // array의 경우, Generic 이면 좋은데. 예를 들어, Index Array이면 'number[]'
                case 'Array': 
                    valTypes.push('any[]'); 
                    break;
    
                case 'Boolean': 
                    valTypes.push('boolean'); 
                    break;
    
                // addExportItem(...): argument constExportItemType 의 type에 Constant 사용됨. 
                // 실제는 Enum인데, 정의할 필드가 없음
                case 'Constant':
                    valTypes.push('any'); 
                    break;
    
                case 'Decimal': 
                    valTypes.push('nexacro.Decimal'); 
                    break;
    
                // type에 integer를 사용한 케이스가 있음.
                case 'Integer': 
                case 'Number':
                    valTypes.push('number'); 
                    break;
    
                case 'Number2': 
                    valTypes.push('number'); 
                    valTypes.push('string'); 
                    break;
    
                // Metainfo에 'Object'로 되어 있는데, '((arg:type, ..) => return)', 'nexacro.Component' 등 구체적인 Object Type으로 변경할 필요가 있음.
                // - stock일 경우, Final Object Type을 지정할 수 없으니 Final Object Type으로 변환가능한 표현방법 정의 필요.
                //   ex) addEventHandler(eventid: string, objfunc: (obj: nexacro.Button, e: nexacro.ClickEventInfo): null, target?: nexacro.Environment | nexacro.Application | nexacro.Form | nexacro.InnerForm ): number
                case 'Object':  
                    valTypes.push('object'); 
                    break;
    
                case 'Position': 
                case 'PositionBase':
                    valTypes.push('number'); 
                    valTypes.push('string'); 
                    break;
    
                case 'String':
                    valTypes.push('string'); 
                    break;
    
                case 'Variant' : 
                    valTypes.push('any'); 
                    break;
    
                default:
                    valTypes.push(type); 
                    break;
            }
        });
    
        return valTypes.join('|');
    }

    #parsePropertyInfo (propertyNode) {

        if (propertyNode && propertyNode.$) {
            // - metainfo에 property의 type이 명시되어 있지 않음. (edittype과 value type은 다름)
            // - unitinfo 사용 시 unit이 없는 타입 허용여부, unit 문자를 사용하지 않을 때 값 형식 등의 정보가 없음.
            // - unitinfo가 값의 일부분에 해당하는 단위정보만을 의미하는 경우가 있음. 
            //   ex: 
            //    [[font property info]]
            //      <Property name="font" group="Style" subgroup="font" edittype="Font" unitinfo="FontSize2" ... />
            //
            //    [[fontsize2 unitinfo]]
            //      <UnitInfo id="FontSize2" usetranslate="false" description="nexacro17 ( pt, px )">
            //          <Unit symbol="pt" minlimit="false" maxlimit="65536" transrate="" description="point" />
            //          <Unit symbol="px" minlimit="false" maxlimit="65536" transrate="" description="pixel" />
            //      </UnitInfo>
            // 
            //    [[syntax]]
            //      font ::= [<font-style>] [<font-weight>] <font-size> ['/'<line-height>] <font-family>
            //      <font-style> ::= 'normal' | 'italic'
            //      <font-weight> ::= 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900'
            //      <font-size> ::= <nSize> 'px'|'pt'
            //      <line-height> ::= 'normal' | <nValue> | <nPixel>'px' | <nPercent>'%'
            //      <font-family> ::= <font-name> [',' <font-name>]*
    
            const prop_attrs = propertyNode.$;

            const omit_list = this.#omitList, prop_list = this.#properties, method_list = this.#methods;
            if (prop_attrs.unused === "true") {
                omit_list.push(prop_attrs.name);
                return;
            }

            let proppertyInfo = { name: prop_attrs.name };

            if (prop_attrs.description.length > 0) {
                proppertyInfo.description = prop_attrs.description;
            }            
            if (prop_attrs.deprecated === 'true') {
                proppertyInfo.deprecated = prop_attrs.deprecated === 'true';
            }

            // setter만을 허용하기 때문에 항상 readonly
            proppertyInfo.readonly = true;
            proppertyInfo.type = this.#getPropertyType(prop_attrs);

            // - nullable 여부 필드 없음. 항상 optional.
            proppertyInfo.option = true;

            prop_list.push(proppertyInfo);

            if (prop_attrs.readonly !== 'true' && prop_attrs.initonly !== 'true') {

                let setterArgType = proppertyInfo.type;
                if (prop_attrs.edittype == 'Number' && prop_attrs.group === 'Style' && prop_attrs.unitinfo) {
                    setterArgType = 'number|' + proppertyInfo.type;
                }
                
                method_list.push({ name: `set_${prop_attrs.name}`, deprecated: prop_attrs.deprecated === 'true',
                    args: [
                        { name: 'v', type: setterArgType, description: prop_attrs.description }
                    ],
                    return: {
                        type: 'void'
                    }
                });
            }           
        }
    }

    #parseMethodInfo (methodNode) {
                
        if (methodNode && methodNode.$) {

            let method_attrs = methodNode.$, method_syntax = methodNode.Syntax[0];

            const omit_list = this.#omitList, method_list = this.#methods;
            if (method_attrs.unused === "true") {
                omit_list.push(method_attrs.name);
                return;
            }
            else if (method_attrs.override === "true") {
                omit_list.push(method_attrs.name);
            }

            // syntax가 여러 형태를 지원하는 경우, syntax 태그 하나에 혼합되어 있어 처리불가함.
            // - Method 태그하위에 Syntax 태그가 여러개 오는 구조가 적합 : 변경필요
            //   ex) Dataset.setRowTypeNF( nRow, nRowType ) 
            //       Dataset.setRowTypeNF( nRow, strRowType )
            // 다중 syntax 여부를 할 수 없기 때문에, 아래와 같이 Argument 3개로 나옴.
            //   결과) setRowTypeNF(nRow?: number, nRowType?: number, strRowType?: string)

            let methodInfo = { 
                name: method_attrs.name, 
                deprecated: method_attrs.deprecated === 'true',
                args: [],
                return : {
                    type: 'null'
                }
            };

            if (method_attrs.description && method_attrs.description.length > 0) {
                methodInfo.description = method_attrs.description;
                methodInfo.hasDescription = true;
            }

            if (method_syntax.Return && method_syntax.Return.length > 0) {
                const return_attrs = method_syntax.Return[0].$;
                if (return_attrs) {
                    methodInfo.return.type = this.#getVariableType(return_attrs.type, 'null');
                    if (methodInfo.return.type.indexOf('|') > 0) {
                        methodInfo.return.typeForComment = `(${methodInfo.return.type})`;
                    }
                    else {
                        methodInfo.return.typeForComment = methodInfo.return.type;
                    }

                    if (return_attrs.description.length > 0) {
                        methodInfo.return.description = return_attrs.description;
                        methodInfo.hasDescription = true;
                    }
                }
            }

            if (method_syntax.Arguments && method_syntax.Arguments.length > 0) {
                // Metainfo의 method argument XML의 순서가 syntax 순서와 다름.

                const arg_infos = method_syntax.Arguments[0].Argument;
                if (arg_infos && arg_infos.length > 0) {
                    arg_infos.forEach(arg_info => {

                        const arg_attrs = arg_info.$; 
                        if (arg_attrs) {
                            let argType = this.#getVariableType(arg_attrs.type, 'any');
                            if (method_attrs.name === "setEventHandlerLookup" && 
                                arg_attrs.name === "strFunc" && argType === "object") {
                                argType = "string";
                            }

                            let argTypeForComment = argType;
                            if (argType.indexOf('|') > 0) {
                                methodInfo.return.typeForComment = `(${argType})`;
                            }

                            const argInfo = {  
                                name: arg_attrs.name, 
                                type: argType, 
                                typeForComment: argTypeForComment,
                                option: arg_attrs.option === "true"
                            };

                            if (arg_attrs.description.length > 0) {
                                argInfo.description = arg_attrs.description;
                                methodInfo.hasDescription = true;
                            }

                            methodInfo.args.push(argInfo);
                        }
                    });
                }
            }

            method_list.push(methodInfo);
        }
    }

    #parseEventHandlerInfo (eventHandlerNode) {

        if (eventHandlerNode && eventHandlerNode.$) {

            let eventhandler_attrs = eventHandlerNode.$, eventhandler_syntax = eventHandlerNode.Syntax[0];

            const omit_list = this.#omitList, prop_list = this.#properties;
            if (eventhandler_attrs.unused === "true") {
                omit_list.push(eventhandler_attrs.name);
                return;
            }
   
            // syntax가 여러 형태를 지원하는 경우, syntax 태그 하나에 혼합되어 있어 처리불가함.
            // event는 multi syntax 개념이 없다고 봐야.
            //
            // 아래의 syntax 정보는 잘못표기된 것.
            //   as-is) Syntax text = 'Button.onclick(obj:nexacro.Button,e:nexacro.ClickEventInfo);'
            //          Button.onclick은 'nexacro.EventObject<O extends nexacro._EventSinkObject, E extends nexacro.EventInfo>' type 임.
            //          onclick = function (obj, e) { console.log('foo'); } 와 같은 함수 대입을 허용하지 않음
            //
            // nexacro.EventObject MetaInfo가 nexacro.EventListener 에 대한 것으로 보임.
            // - method에 clear 함수 정의가 누락되어 있음 
            

            

            let eventHandlerInfo = { 
                name: eventhandler_attrs.name
            };

            if (eventhandler_attrs.description.length > 0) {
                eventHandlerInfo.description = eventhandler_attrs.description;
            }

            if (eventhandler_attrs.deprecated === 'true') {
                eventHandlerInfo.deprecated = true;
            }

            // parsing syntax text
            let syntax_text = eventhandler_syntax.$.text, objType = 'object', einfoType = 'nexacro.EventInfo';
            let parse_regexp = new RegExp(`^\\w+\\.${eventhandler_attrs.name}\\(\\w+:(\\w+|\\w+\\.\\w+)\\s*,\\s*\\w+:(\\w+|\\w+\\.\\w+)\\)(?:\\s*$|\\s*;\\s*$)`, 'g');

            let parse_result = parse_regexp.exec(syntax_text);
            if (parse_result) {
                if (parse_result.length > 1) objType = parse_result[1];
                if (parse_result.length > 2) einfoType = parse_result[2];
            }

            // Argument Tag에 'e' 만 저장됨. 왜? 'obj'는 어디로?
            // - Argument type에 'ClickEventInfo'와 갇이 'nexacro.'이 누락되어 있음
            // ==> 임시로 syntax parsing 해서 사용
            //if (eventhandler_syntax.Arguments && eventhandler_syntax.Arguments.length > 0) {
            //    arg_infos = eventhandler_syntax.Arguments[0].Argument;
            //    if (arg_infos && arg_infos.length > 0) {
            //        arg_infos.forEach(arg_info => {
            //            const argument = arg_info.$; 
            //            if (argument.name === 'e') einfoType = `nexacro.${argument.name}`;
            //        });
            //    }
            //}


            // id와 classname이 다른 경우, 보정
            // ex) CompositeComponent.oncontextmenu(obj:nexacro._CompositeComponent,e:nexacro.ContextMenuEventInfo)
            if (this.#typeName != this.#className) {
                objType = this.#typeName;
            }

            eventHandlerInfo.readonly = true;
            eventHandlerInfo.type = `nexacro.EventObject<${objType}, ${einfoType}>`;

            // - nullable 여부 필드 없음. 항상 optional.
            eventHandlerInfo.option = true;

            prop_list.push(eventHandlerInfo);
        }
    }

    #hasContructor () {
        return (static_clsnames.indexOf(this.#typeName) < 0);
    }

    #generateInterfaceCode () {

        let typeName = this.#typeName, superTypeName = this.#superTypeName;
        const omit_list = this.#omitList, prop_list = this.#properties, method_list = this.#methods;

        let interfaceCodes = [];

        let typeGeneric = '', explicitTypeGeneric = '', omitKeyTypeName = '';
        if (typeName === 'EventObject') {
            //typeGeneric = '<O extends nexacro.EventSinkObject, E extends nexacro.EventInfo>';
            typeGeneric = '<O, E>';
            explicitTypeGeneric = '<nexacro.EventSinkObject, nexacro.EventInfo>';
        }

        // generate code from omit list
        if (superTypeName && omit_list.length > 0) {
            omitKeyTypeName    = `${typeName}OmitKeys`;
            interfaceCodes.push(`type ${omitKeyTypeName} = ${ omit_list.join('|')};`);
        }

        let extendTypeName = '';
        if (superTypeName) {
            if (omitKeyTypeName) {
                extendTypeName = `Omit<${superTypeName}${typeGeneric}, ${omitKeyTypeName}>`;
            }
            else {
                extendTypeName = `${superTypeName}${typeGeneric}`;
            }
        }

        let ctorCode = '', bodyCodes = [];
        if (this.#hasContructor()) {
            ctorCode = `new(): ${this.#nameSpace}.${typeName}${typeGeneric};\n`;
        }

        prop_list.forEach(propertyInfo => {
            if (propertyInfo.description || propertyInfo.deprecated) {
                bodyCodes.push('/**');

                if (propertyInfo.description) {
                    bodyCodes.push(` * ${propertyInfo.description.replace(/[\r\n|\r|\n]/gm, '')}`);
                }
                if (propertyInfo.deprecated) {
                    bodyCodes.push(` * @deprecated`);
                }
                bodyCodes.push(' */');
            }

            let propCode = '';

            if (propertyInfo.readonly) propCode += "readonly ";
            propCode += `${propertyInfo.name}${propertyInfo.option ? '?: ' : ': '}${propertyInfo.type};`;

            bodyCodes.push(propCode);
        });

        method_list.forEach(methodInfo => {

            let argCodes = [], argDocs = [];
            methodInfo.args.forEach(argInfo => {
                argDocs.push(` * @param {${argInfo.typeForComment}} ${argInfo.name} ${argInfo.description}`);
                argCodes.push(`${argInfo.name}${argInfo.option ? '?' : ''}: ${argInfo.type}`);
            });

            if (methodInfo.hasDescription || methodInfo.deprecated) {
                bodyCodes.push('/**');

                if (methodInfo.description) {
                    bodyCodes.push(` * ${methodInfo.description.replace(/[\r\n|\r|\n]/gm, '')}`);
                }

                argDocs.forEach(argDoc => bodyCodes.push(argDoc));

                if (methodInfo.return.type !== 'null' ) {
                    const returnDesc = methodInfo.return.desc ? methodInfo.return.desc.replace(/[\r\n|\r|\n]/gm, '') : '';
                    bodyCodes.push(` * @returns {${methodInfo.return.typeForComment}} ${returnDesc}`);
                }

                if (methodInfo.deprecated) {
                    bodyCodes.push(` * @deprecated`);
                }
                bodyCodes.push(' */');
            }

            bodyCodes.push(`${methodInfo.name}(${argCodes.join(', ')}): ${methodInfo.return.type};`);
        });

        const interfaceName = `${typeName}${typeGeneric}`;
        const interfaceCode = this.#getInterfaceCode(interfaceName, extendTypeName, ctorCode, bodyCodes);
        interfaceCodes.push(interfaceCode);

        const nameSpace = this.#nameSpace, clsName = this.#className;
        const globalInterfaceName = `${nameSpace}.${typeName}${explicitTypeGeneric}`;
        return this.#getDeclarationCode(nameSpace, clsName, globalInterfaceName, interfaceCodes);
    }

    #getInterfaceCode (interfaceName, extendTypeName, ctorCode, bodyCodes) {
        return `
    interface ${interfaceName} ${extendTypeName ? `extends ${extendTypeName}` : ''} {
        ${ctorCode}
        ${bodyCodes.join('\n\t\t')}
    }`;
    }
    
    #getDeclarationCode (nameSpace, typeName, interfaceName, interfaceCodes) {
        return `${NexacroMetaInfoHandler.headerComment};
    
interface ${nameSpace} {
    ${typeName}: ${interfaceName};
}
    
declare namespace ${nameSpace} {
    ${interfaceCodes.join('\n\t')}
}
`;
    }
}

module.exports = NexacroMetaObjectInfoHandler;
