
const { program } = require('commander');
const packageJson = require('../package.json');

const path = require("path");  
const fs = require('fs');
const glob = require('glob');
//const { stringLiteral } = require('../../../babel/node_modules/@babel/types/lib');

var parseString = require('xml2js').parseString;

const strHeaderComment = `// Type definitions for Nexacro N
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
// TypeScript Version: 3.8`;

program
    .version(packageJson.version)
    .argument('<metainfo>', 'target metainfo file expression')
    .option('-s, --source [path]', 'source path (default: current path)')
    .option('-o, --output [path]', 'output path (default: source path)')
    .action((metainfo, options) => {
        // metainfo 체크 필요없음.
        // (argument는 required option이기 때문에, 누락 시 에러출력됨)
        // console.log(metainfo, options ? options.toString() : '');
    });

program.parse();

const opts = program.opts();
const args = program.args;
const cwd = process.cwd();

let srcdir = cwd, outdir;
if (opts.source) {
    if (path.isAbsolute(opts.source)) {
        srcdir = opts.source;
    }
    else {
        srcdir = path.join(cwd, opts.source);
    }
}

if (opts.output) {
    if (path.isAbsolute(opts.output)) {
        outdir = opts.output;
    }
    else {
        outdir = path.join(cwd, opts.output);
    }
}

args.forEach((minfo) => {

    const srcIsAbsolute = path.isAbsolute(minfo);
    const srcfile = srcIsAbsolute ? minfo : path.join(srcdir, minfo);
    
    glob(srcfile, function (err, matches) {
        if (err) throw err;

        if (glob.hasMagic(srcfile))
        matches.forEach(matched => {
            const realname = path.basename(matched);

            let outfile;
            if (!outdir) {
                // if outdir is undefined, outdir = srcdir
                outfile = matched + '.d.ts';
            }
            else if (srcIsAbsolute) {
                
                let relpath = path.relative(path.dirname(srcfile), path.dirname(matched)) || '';
                relpath = relpath.replace('..\\', '.\\');

                outfile = path.join(outdir, relpath, realname + '.d.ts');
            }
            else {
                const relpath = path.relative(srcdir, path.dirname(matched)) || '';
                outfile = path.join(outdir, relpath, realname + '.d.ts');
            }
            const outpath = path.dirname(outfile);

            console.log(`> generate declaration file: ${matched} ->  ${outfile}`);

            fs.readFile(matched, 'utf8', function (err, data) {
                if (err) {
                    console.log(err.message);
                    return;
                }
        
                parseMetainfo(data, function (err, result) {
                    if (result) {
                        if (!fs.existsSync(outpath)) {
                            fs.mkdirSync(outpath, {recursive : true});
        
                            if (!fs.existsSync(outpath)) {
                                console.log(`Failed to create directory '${outpath}'.`);
                                return;
                            }
                        }
                        fs.writeFileSync(outfile, result);
                    }
                });
            });
        });
    });
});

function parseMetainfo(text, callback) {
    var self = this;

    const parse_opts = {};
    parseString(text, parse_opts, function (err, result) {
        if (!result.MetaInfo) {
            console.error('An attempt was made to parse a metainfo file with an unknown or unsupported format.');
            callback.call(null, err, null);
            return;
        }
        //console.dir(result, {depth:2});
        let dtsStr = '';
        const info = result.MetaInfo;
        if (info.Object && info.Object.length > 0) {
            info.Object.forEach(objectInfo => dtsStr += make_dts_from_objectNode(objectInfo));
        }
        else if (info.UnitInfo) {
            //console.dir(result, {depth:2});
            //dtsStr = JSON.stringify(result, null, '\t');
            dtsStr = make_dts_from_UintInfoNode(info.UnitInfo);
        }
        else if (info.EnumInfo) {
            //console.dir(result, {depth:2});
            //dtsStr = JSON.stringify(result, null, '\t');
            dtsStr = make_dts_from_EnumInfoNode(info.EnumInfo);
        }

        callback.call(null, err, dtsStr);
    });
}

function make_dts_from_EnumInfoNode (enumInfoNode) {

    if (!enumInfoNode || enumInfoNode.length < 1) {
        console.error('Unexpected \'EnumInfo\' tag in a metainfo file.');
        return;
    }

    /**UnitInfo Structure
     * {
     *    "$": {
     *        "id": "AcceptValueType",
     *        "composit": "false",
     *        "delimiter": "",
     *        "description": "px 과 % 를 동시사용"
     *    },
     *    "Enum": [
     *        {
     *            "$": {
     *                "name": "allowinvalid",
     *                "description": "아이템에 없는 value 값도 설정가능"
     *            }
     *        },
     *        {
     *            "$": {
     *                "name": "ignoreinvalid",
     *                "description": "아이템에 없는 value 값도 설정불가능"
     *            }
     *        }
     *    ]
     * }
     */

    // 'composit=true' 일 경우, property type 지정할 때 Enum Type이 아니라 string type으로 해야 할 듯 (Enum2와는 다름)

    let strEnumId, isComposite = false, strDelimiter = '', enum_codes = [];
    enumInfoNode.forEach(enumInfo => {
        if (!enumInfo || !enumInfo.$) return;

        strEnumId = enumInfo.$.id;
        if (!strEnumId) return;

        isComposite = (enumInfo.$.composit === 'true');
        strDelimiter = enumInfo.$.delimiter;
        // composit=true 일 경우, 'string' 타입을 추가.
        // - Enum2와 같이 미리 모든 조합을 만들어서 제공할 수 없음
        //   factorial + non-order 특성으로 인해 예상되는 모든 조합을 만드는 것은 불필요하다고 보임.

        if (!enumInfo.Enum || enumInfo.Enum.length === 0)
            return;
        
        let enum_items = [];
        enumInfo.Enum.forEach(item => {
            enum_items.push(item.$.name.replace(/'/g, '\\\''));
        });

        const enumType = `'${enum_items.join('\' | \'')}'`;
        const enumCompositeType = `\`\${${enumType}}\` | \`\${${enumType}}${strDelimiter}\${string}\``;

        //if (isComposite) {
            //let strEnumItemID = 'Enum'+ strEnumId;
            //enum_codes.push(`declare enum ${strEnumItemID} { ${enum_items.join(', ')} };`);
            //enum_codes.push(`type ${strEnumId} = keyof typeof ${strEnumItemID} | \`\${keyof typeof ${strEnumItemID}}${strDelimiter}\${string}\`;`);
        //}
        //else {
        //    enum_codes.push(`type ${strEnumId} = ${enumType};`);
        //}
        enum_codes.push(`export type ${strEnumId} = ${isComposite ? enumCompositeType : enumType};`);
    });

    const dtsStr = `${strHeaderComment}

declare namespace nexacro.Enum {

    ${enum_codes.join('\n\t')}

}`;

    return dtsStr;
};

function make_dts_from_UintInfoNode (unitInfoNode) {

    if (!unitInfoNode || unitInfoNode.length < 1) {
        console.error('Unexpected \'UnitInfo\' tag in a metainfo file.');
        return;
    }

    /**UnitInfo Structure
     * {
     *    "$": {
     *        "id": "PixelPercent",
     *        "usetranslate": "false",
     *        "description": "px 과 % 를 동시사용"
     *    },
     *    "Unit": [
     *        {
     *            "$": {
     *                "symbol": "px",
     *                "minlimit": "0.0",
     *                "maxlimit": "65536.0",
     *                "transrate": "",
     *                "description": "pixel"
     *            }
     *        },
     *        {
     *            "$": {
     *                "symbol": "%",
     *                "minlimit": "0.0",
     *                "maxlimit": "100.0",
     *                "transrate": "",
     *                "description": "percent"
     *            }
     *        }
     *    ]
     * }
     */
    let strUnitId, strTypeValue, type_codes = [];
    unitInfoNode.forEach(unitInfo => {
        if (!unitInfo || !unitInfo.$) return;

        strUnitId = unitInfo.$.id;
        if (!strUnitId) return;

        if (!unitInfo.Unit || unitInfo.Unit.length === 0) {
            strTypeValue = 'void';
        }
        else {
            let unit_symbols = [];
            unitInfo.Unit.forEach(unit => {
                if (unit.$.symbol !== '' && unit.$.symbol !== 'undefined') {
                    unit_symbols.push(unit.$.symbol);
                }
            });

            if (unit_symbols.length == 0) { 
                strTypeValue = 'void';
            }
            else if (unit_symbols.length == 1) {
                strTypeValue = `\`\${number}${unit_symbols[0]}\``;
            }
            else {
                unit_symbols.forEach((symbol, idx, thisArray) => thisArray[idx] = `\'${symbol.replace(/'/g, '\\\'')}\'`);
                strTypeValue = `\`\${number}\${${unit_symbols.join('|')}}\``;
            }
        }

        type_codes.push(`export type ${strUnitId} = ${strTypeValue};`);
    });

    const dtsStr = `${strHeaderComment}

declare namespace nexacro.Unit {

    ${type_codes.join('\n\t')}

}`;

    return dtsStr;
};

function make_dts_from_objectNode (objectNode) {
    //console.log(JSON.stringify(objectNode, '\n')); 

    const objId = objectNode.$.id;
    const objInfos = objectNode.ObjectInfo;

    if (!objId || !objInfos || objInfos.length < 1){
        console.error('An attempt was made to parse a metainfo file with an unknown or unsupported format.');
        return;
    }

    //console.log(JSON.stringify(objectNode));

    const objInfo = objInfos[0].$;

    let propertyInfos, methodInfos, eventhandlerInfos, controlInfos;

    if (objectNode.PropertyInfo && objectNode.PropertyInfo.length > 0) {
        propertyInfos = objectNode.PropertyInfo[0].Property;
    }

    if (objectNode.MethodInfo && objectNode.MethodInfo.length > 0) {
        methodInfos = objectNode.MethodInfo[0].Method;
    }

    if (objectNode.EventHandlerInfo && objectNode.EventHandlerInfo.length > 0) {
        eventhandlerInfos = objectNode.EventHandlerInfo[0].EventHandler;
    }

    // control은 propertyinfo에서 이미 추가됨.
    // controlinfo 태그는 css 편집용
    //if (objectNode.ControlInfo && objectNode.ControlInfo.length > 0) {
    //    controlInfos = objectNode.ControlInfo[0].Control;
    //}

    return interface_template(objId, objInfo, propertyInfos, methodInfos, eventhandlerInfos, controlInfos);
};

// 임시: metainfo에 관련 정보를 추가해야 함.
const static_clsnames = [
    'nexacroAPI',
    'Application'
];

function metaType2Type (metaType, undefinedType) {
    switch (metaType)
    {
        // array의 경우, Generic 이면 좋은데. 예를 들어, Index Array이면 'number[]'
        case 'Array': return 'any[]';
        case 'Boolean': return 'boolean';
        case 'Number':  return 'number';
        case 'Number2': return 'number' | 'string';        

        // Metainfo에 'Object'로 되어 있는데, '((arg:type, ..) => return)', 'nexacro.Component' 등 구체적인 Object Type으로 변경할 필요가 있음.
        // - stock일 경우, Final Object Type을 지정할 수 없으니 Final Object Type으로 변환가능한 표현방법 정의 필요.
        //   ex) addEventHandler(eventid: string, objfunc: (obj: nexacro.Button, e: nexacro.ClickEventInfo): null, target?: nexacro.Environment | nexacro.Application | nexacro.Form | nexacro.InnerForm ): number
        case 'Object':  return 'object';
        case 'Position': 
        case 'PositionBase':
            return 'number' | 'string';
        case 'String':  return 'string';
        case '':    return undefinedType;
        case 'Variant' : return 'any';

        default:
            return metaType;
    }
}

function interface_properties_template (propinfos) {

    var prop_str_list = [], prop_setter_list = [], omit_list = [];

    if (propinfos) {
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

        var str_propType, str_setterParamType, is_optionable, str_props = '';
        propinfos.forEach(propinfo => {
            
            let prop_attrs = propinfo.$;

            if (prop_attrs.unused === "true") {
                omit_list.push(`'${prop_attrs.name}'`);
                return;
            }

            // jsdoc comments
            if (prop_attrs.description.length > 0 || prop_attrs.deprecated === 'true') {
                prop_str_list.push('/**');

                if (prop_attrs.description.length > 0) {
                    //let descs = prop_attrs.description.split(/\r?\n/);
                    //descs.forEach(desc => prop_str_list.push(` * ${desc}`));
                    prop_str_list.push(` * ${prop_attrs.description.replace(/[\r\n|\r|\n]/gm, '')}`);
                }
                if (prop_attrs.deprecated === 'true') {
                    prop_str_list.push(` * @deprecated`);
                }
                prop_str_list.push(' */');
            }

            //if (prop_attrs.readonly === 'true' || prop_attrs.initonly === 'true')
            //    str_props += "readonly ";
            // setter만을 허용하기 때문에 항상 readonly
            str_props = "readonly ";

            switch (prop_attrs.edittype)
            {
                case 'Boolean':
                    str_propType = str_setterParamType = 'boolean';
                    break;

                case 'Number':
                    str_propType = str_setterParamType = 'number';
                    // normal type일 때는 unitinfo 무시

                    if (prop_attrs.group === 'Style' && prop_attrs.unitinfo) {
                        const unitType = `nexacro.Unit.${prop_attrs.unitinfo}`;
                        str_propType = `${unitType}`; // it is not number type
                        str_setterParamType += '|' + str_propType;
                    }
                    break;

                case 'Number2': 
                    let delimiter = prop_attrs.delimiter;
                    if (!delimiter || delimiter.length == 0) delimiter = ' ';

                    // ex) buttonsize (edittype='Number2' & unitinfo='Size')
                    // Number2 type의 경우, unit symbol을 값에 사용하지 않는다?
                    str_propType = str_setterParamType = `number | \`\${number}\` | \`\${number}${delimiter}\${number}\``;
                    break;
                
                case 'Enum':
                    str_propType = str_setterParamType = `nexacro.Enum.${prop_attrs.enuminfo}`;
                    break;

                case 'Enum2':
                    // Enum2 = '<enum value><delimiter><enum2 value>'; 
                    //   delimiter : default=' '
                    if (prop_attrs.enuminfo && prop_attrs.enuminfo2) {
                        const enum1Type = `nexacro.Enum.${prop_attrs.enuminfo}`;
                        const enum2Type = `nexacro.Enum.${prop_attrs.enuminfo2}`;
                        const delimiter = prop_attrs.delimiter || ' ';
                        str_propType = `${enum1Type} | \`\${${enum1Type}}${delimiter}\${${enum2Type}}\``;
                    }
                    else {
                        str_propType = 'any';
                    }
                    str_setterParamType = str_propType;
                    break;

                case 'Object':
                    // object type 보다는 실제 Object의 Type을 명시해주는 것이 좋은데 알수가 없다. 
                    // edittype='Object' 일 때, 'objectinfo' 속성등이 비어있어, Object Reference 정보를 찾을 수 없다.
                    // ex: hscrollbar, components, fromobject 등 
                    // + TOPS에 데이터느 들어가 있으나 metainfo 파일 생성 시 누락되는 것 같다고 함.
                    // + array도 object type임
                    str_propType = str_setterParamType = 'object';
                    break;

                case 'HotKey':
                    // edittype이 'enum'이 아니지만, enuminfo가 지정된 경우 (ex. HotKey)
                    if (prop_attrs.enuminfo) 
                    {
                        str_propType = `nexacro.Enum.${prop_attrs.enuminfo}`;
                    }
                    else {
                        str_propType = 'string';
                    }
                    str_setterParamType = str_propType;
                    break;

                case 'Position':
                    if (prop_attrs.unitinfo === 'PixelPercent') {
                        // ex:control.left (edittype='Position' & unitinfo='PixelPercent')
                        // nexacro.Rect의 left, ... 등 position property의 경우, 
                        // 실제 값은 number type 만 처리 가능한데 edittype=position, unitinfo=Pixel로 지정되어 있음
                        const unitType = `nexacro.Unit.${prop_attrs.unitinfo}`;
                        // str_propType = `number | ${unitType}`;
                        str_propType = `number | ${unitType}`;
                    }
                    else {
                        str_propType = 'number';
                    }
                    str_setterParamType = str_propType;

                    break;

                case 'PositionBase':
                    //str_propType = 'number | \`${number}${\'px\'|\'%\'}\` | \`${string}:${number}${\'px\'|\'%\'}\`';
                    const unitType = `nexacro.Unit.PixelPercent`;
                    str_propType = `number | ${unitType} | \`\${string}:\${${unitType}}\``;
                    str_setterParamType = str_propType;

                    // PositionBase Type일 경우, unitinfo를 사용하지 않음.
                    // empty string type guard할 수 없음

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
                    str_propType = str_setterParamType = 'string';

                    break;
                
            }

            // - nullable 여부 필드 없음. 항상 optional.
            is_optionable = true;

            str_props += `${prop_attrs.name}${is_optionable ? '?: ' : ': '}${str_propType};`;
            prop_str_list.push(str_props);

            if (prop_attrs.readonly !== 'true' && prop_attrs.initonly !== 'true') {
                // jsdoc comments
                prop_setter_list.push('/**');

                //let descs = prop_attrs.description.split(/\r?\n/);
                //descs.forEach((desc, idx) => { 
                //    if (idx == 0) prop_setter_list.push(` * @param v - ${desc}`);
                //    else          prop_setter_list.push(` *            ${desc}`);
                //});
                prop_setter_list.push(` * @param v - ${prop_attrs.description.replace(/[\r\n|\r|\n]/gm, '')}`);

                if (prop_attrs.deprecated === 'true') {
                    prop_setter_list.push(` * @deprecated`);
                }
                prop_setter_list.push(' */');
                
                // setter function
                str_props = `set_${prop_attrs.name}(v: ${str_setterParamType}): void;`;
                prop_setter_list.push(str_props);
            }
        });
        
    }

    const propertycodes = prop_str_list.concat(prop_setter_list);

    return { props: propertycodes, omit: omit_list };
};

function interface_methods_template (methodinfos) {

    var method_str_list = [], omit_list = [];

    if (methodinfos) {

        var str_method = '';
        methodinfos.forEach(methodinfo => {
            
            let method_attrs = methodinfo.$, method_syntax = methodinfo.Syntax[0];
            if (method_attrs.unused === "true") {
                omit_list.push(`'${method_attrs.name}'`);
                return;
            }

            // syntax가 여러 형태를 지원하는 경우, syntax 태그 하나에 혼합되어 있어 처리불가함.
            // - Method 태그하위에 Syntax 태그가 여러개 오는 구조가 적합 : 변경필요
            //   ex) Dataset.setRowTypeNF( nRow, nRowType ) 
            //       Dataset.setRowTypeNF( nRow, strRowType )
            // 다중 syntax 여부를 할 수 없기 때문에, 아래와 같이 Argument 3개로 나옴.
            //   결과) setRowTypeNF(nRow?: number, nRowType?: number, strRowType?: string)

            let syntax_text = method_syntax.$;
            let return_type = 'null', return_desc;
            let arg_infos, arg_desc = [];

            if (method_syntax.Return && method_syntax.Return.length > 0) {
                return_type = metaType2Type(method_syntax.Return[0].$.type, 'null');
                return_desc = method_syntax.Return[0].$.description;
            }

            if (method_syntax.Arguments && method_syntax.Arguments.length > 0) {
                arg_infos = method_syntax.Arguments[0].Argument;
            }

            // Metainfo의 method argument XML의 순서가 syntax 순서와 다름.
            let arg_codes = [];
            if (arg_infos && arg_infos.length > 0) {
                arg_infos.forEach(arg_info => {
                    const argument = arg_info.$; 
                    const arg_type = metaType2Type(argument.type, 'any');

                    let arg_code = `${argument.name}${argument.option ? '?' : ''}: ${arg_type}`;
                    arg_codes.push(arg_code);

                    //let descs = argument.description.split(/\r?\n/);
                    //descs.forEach((desc, idx) => { 
                    //    desc = desc.trim();
                    //    if (desc == '') return;
                    //
                    //    if (idx == 0) arg_desc.push(` * @param ${argument.name} - ${desc}`);
                    //    else          arg_desc.push(` *            ${desc}`);
                    //});
                    
                    arg_desc.push(`${argument.name} - ${argument.description.replace(/[\r\n|\r|\n]/gm, '')}`);
                });
            }

            // jsdoc comments
            if (method_attrs.description.length > 0 || 
                arg_desc.length > 0 || 
                return_desc || 
                method_attrs.deprecated === 'true') {

                method_str_list.push('/**');

                if (method_attrs.description.length > 0) {
                    method_str_list.push(` * ${method_attrs.description}`);
                }

                arg_desc.forEach(desc => method_str_list.push(` * @param ${desc}`));
                //arg_desc.forEach(desc => method_str_list.push(desc));

                if (return_desc) {
                    //let descs = return_desc.split(/\r?\n/);
                    //descs.forEach((desc, idx) => { 
                    //    desc = desc.trim();
                    //    if (desc == '') return;
                    //    
                    //    if (idx == 0) method_str_list.push(` * @returns ${desc}`);
                    //    else          method_str_list.push(` *          ${desc}`);
                    //});
                    method_str_list.push(` * @returns ${return_desc.replace(/[\r\n|\r|\n]/gm, '')}`);
                }
                
                if (method_attrs.deprecated === 'true') {
                    method_str_list.push(` * @deprecated`);
                }
                method_str_list.push(' */');
            }

            str_method = `${method_attrs.name}(${arg_codes.join(', ')}): ${return_type};`;

            method_str_list.push(str_method);
        });
        
    }

    return { props: method_str_list, omit: omit_list };
};

function interface_eventhandlers_template (eventhandlerinfos) {

    var eventhandler_str_list = [], omit_list = [];

    if (eventhandlerinfos) {

        var str_eventhandler = '';
        eventhandlerinfos.forEach(eventhandlerinfo => {
            
            let eventhandler_attrs = eventhandlerinfo.$, eventhandler_syntax = eventhandlerinfo.Syntax[0];
            if (eventhandler_attrs.unused === "true") {
                omit_list.push(`'${eventhandler_attrs.name}'`);
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
            

            let syntax_text = eventhandler_syntax.$.text, objType = 'object', einfoType = 'nexacro.EventInfo';

            // jsdoc comments
            if (eventhandler_attrs.description.length > 0 || eventhandler_attrs.deprecated === 'true') {
                eventhandler_str_list.push('/**');

                if (eventhandler_attrs.description.length > 0) {
                    //let descs = eventhandler_attrs.description.split(/\r?\n/);
                    //descs.forEach(desc => eventhandler_str_list.push(` * ${desc}`));
                    eventhandler_str_list.push(` * ${eventhandler_attrs.description.replace(/[\r\n|\r|\n]/gm, '')}`);
                }
                if (eventhandler_attrs.deprecated === 'true') {
                    eventhandler_str_list.push(` * @deprecated`);
                }
                eventhandler_str_list.push(' */');
            }


            // parsing syntax text
            let parse_regexp = new RegExp(`^\\w+\\.${eventhandler_attrs.name}\\(\\w+:(\\w+|\\w+\\.\\w+)\\s*,\\s*\\w+:(\\w+|\\w+\\.\\w+)\\)(?:\\s*$|\\s*;\\s*$)`, 'g');
            //console.log(`${syntax_text} ==> ${parse_regexp}`);
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

            str_eventhandler = `readonly ${eventhandler_attrs.name}: nexacro.EventObject<${objType}, ${einfoType}>;`;
            eventhandler_str_list.push(str_eventhandler);
        });
        
    }

    return { props: eventhandler_str_list, omit: omit_list };
};

function interface_controlinfo_template (controlinfos) {

    var control_str_list = [], omit_list = [];

    if (controlinfos) {

        var str_control = '';
        controlinfos.forEach(controlinfo => {
            
            let control_attrs = controlinfo.$;

            // 'unusedcontrol' 는 무엇?
            if (control_attrs.unused === "true") {
                omit_list.push(`'${control_attrs.name}'`);
                return;
            }            

            // jsdoc comments
            if (control_attrs.deprecated === 'true') {
                control_str_list.push('/** @deprecated */');
            }

            str_control = `readonly ${control_attrs.name}: ${control_attrs.classname};`;
            control_str_list.push(str_control);
        });
        
    }

    return { props: control_str_list, omit: omit_list };
};

function interface_template (id, objInfo, propinfos, methodinfos, eventinfos, controlinfos) {
    
    const idKeys = id.split('.');
    if (idKeys.length > 2) {
        console.error('The maximum number of namespaces cannot exceed 1.');
        return '';
    }

    let nameSpace = 'nexacro', clsName;
    if (idKeys.length === 1) {
        clsName = idKeys[0];
    }
    else
    {
        nameSpace = idKeys[0]
        clsName = idKeys[1];
    }

    // hard-coding
    let genericText = '', genericContructor = '', genericForType = '';
    if (clsName === 'EventObject') {
        // EventSinkObject의 실제 Class 명은 nexacro._EventSinkObject 이나
        // metainfo에는 nexacro.EventSinkObject로 되어 있음
        genericText = '<O extends nexacro.EventSinkObject, E extends nexacro.EventInfo>';
        genericContructor = '<O, E>';
        genericForType = '<nexacro.EventSinkObject, nexacro.EventInfo>';
    }

    let str_constructor = '';
    const hasConstructor = (static_clsnames.indexOf(clsName) < 0);
    if (hasConstructor) {
        str_constructor = `new(): ${nameSpace}.${clsName}`;
    }

    let superClsName;
    if (objInfo) {
        // final class decorator가 없다
        // inheritance 정보가 정확히 들어가지 않은게 있음
        superClsName = objInfo.inheritance;
    }

    let propcodes = [], omitkeys = [];
    if (propinfos) {
        const result = interface_properties_template(propinfos);

        if (result.props.length > 0)
            propcodes = propcodes.concat(result.props);

        if (result.omit && result.omit.length > 0)
            omitkeys = omitkeys.concat(result.omit);
    }

    if (methodinfos) {
        const result = interface_methods_template(methodinfos);

        if (result.props.length > 0)
            propcodes = propcodes.concat(result.props);

        if (result.omit && result.omit.length > 0)
            omitkeys = omitkeys.concat(result.omit);
    }

    if (eventinfos) {
        const result = interface_eventhandlers_template(eventinfos);

        if (result.props.length > 0)
            propcodes = propcodes.concat(result.props);

        if (result.omit && result.omit.length > 0)
            omitkeys = omitkeys.concat(result.omit);
    }

    if (controlinfos) {
        const result = interface_controlinfo_template(eventinfos);

        if (result.props.length > 0)
            propcodes = propcodes.concat(result.props);

        if (result.omit && result.omit.length > 0)
            omitkeys = omitkeys.concat(result.omit);
    }

    var interface_codes = [];

    if (superClsName && omitkeys.length > 0) {
        const omitKeysTypeName    = `${clsName}OmitKeys`;
        const omitKeysTypeValue   = omitkeys.join('|');
        superClsName        = `Omit<${superClsName}, ${omitKeysTypeName}>`;

        interface_codes.push(`export type ${omitKeysTypeName} = ${omitKeysTypeValue};`);
    }

    const interface_code = `
    export interface ${clsName}${genericText} ${superClsName ? `extends ${superClsName}${genericText}` : ''} {
        new(): ${nameSpace}.${clsName}${genericContructor};

        ${propcodes.join('\n\t\t')}
    }`;
    interface_codes.push(interface_code);


const str = `${strHeaderComment}

interface ${nameSpace} {
    ${clsName}: ${id}${genericForType};
}

declare namespace ${nameSpace} {
    ${interface_codes.join('\n\t')}
}
`;

    return str;
};
//console.log(`test application: ${program.args} ${program.opts().output}`);
