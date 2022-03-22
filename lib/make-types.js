
const path = require("path");  
const fs = require('fs');

const gen2dts = require('./gen2dts.js');

function generateAndMakeTypes(taskName, taskNo, makefile, outdir) {
    if (!makefile) return;

    const makefilepath = path.resolve(makefile);
    //console.log(`build: ${makefile}`);

    const makefileinfo = path.parse(makefilepath);


    if (makefileinfo.ext !== ".json") {
        console.error(`> An attempt was made to build with an unknown or unsupported file format: ${makefilepath}`);
        return;
    }

    //console.log(`${procIdx+1}> ============ ${makefileinfo.base} ============`);
    // nexacro module json

    fs.readFile(makefilepath, 'utf8', function (err, data) {
        if (err) {
            console.error(`${taskNo}> Fail build types module: ${makefilepath}\n\t${err.stack}`);
            return;
        }

        try {
            // remove BOM
            const jsonstr = data.trim();
            const result = JSON.parse(jsonstr);

            if (!result.source) {
                console.error(`> An attempt was made to build with an unknown or unsupported file format: ${makefilepath}`);
                return;
            }

            let srcroot, srcfile, outroot;
            if (result.source.path) {
                if (path.isAbsolute(result.source.path)) {
                    srcroot = result.source.path;
                }
                else {
                    srcroot = path.resolve(makefileinfo.dir, result.source.path);
                }
            }
            else {
                srcroot = makefileinfo.dir;
            }

            if (outdir) {
                outroot = path.resolve(outdir);
            }
            else if (result.output && result.output.path) {
                if (path.isAbsolute(result.output.path)) {
                    outroot = result.output.path;
                }
                else {
                    outroot = path.resolve(makefileinfo.dir, result.output.path);
                }
            }

            if (!result.source.files) {
                console.error(`> Missing source files in config: ${makefilepath}`);
                return;
            }

            srcfile = path.resolve(srcroot, result.source.files);            

            const gen_opts = {
                routePattern: result.source.routePattern,
                referenceTypes: result.output.referenceTypes,
                noJsDocComment: result.output.noJsDocComment,
                emitFlat: result.output.emitFlat,
                tsconfig: result.tsconfig
            };
            gen2dts.buildDeclarationModule(taskName, taskNo, srcfile, outroot, gen_opts);
        }
        catch (ex) {
            console.error(`${taskNo}> Fail build types module: ${makefilepath}\n\t${ex.stack}`);
            return;
        }
    });

}

module.exports = generateAndMakeTypes;
