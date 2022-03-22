
const path = require("path");  
const fs = require('fs');
const glob = require('glob');
const readline = require('readline');

const DTSGenerator = require('./DTSGenerator');

function getOutputFilePath (srcfile, matchedfile, outroot, optFlat) {
    if (!outroot) {
        const dirname = path.dirname(matchedfile);
        const filename = path.basename(matchedfile, '.info');
        return path.join(dirname, filename + '.d.ts');
    }

    const relpath = path.relative(srcfile, matchedfile) || '';
    if (!relpath) {
        const dirname = path.parse(matchedfile).dir;
        const filename = path.basename(matchedfile, '.info');
        return path.join(dirname, filename + '.d.ts');
    }

    if (!optFlat) {
        const reldirname = path.dirname(relpath);
        const reldirs = reldirname.split(path.sep).filter(val => val !== '.' && val !== '..');
        outroot = path.join(outroot, path.join.apply(null, reldirs));
    }

    const filename = path.basename(matchedfile, '.info');
    return path.join(outroot, filename + '.d.ts');
}

function getMetaInfosFromModuleJson(jsonfile, callback) {

    fs.readFile(jsonfile, 'utf8', function (err, data) {
        if (err) {
            callback(err);
            return;
        }

        try {
            // remove BOM
            const jsonstr = data.trim();
            const result = JSON.parse(jsonstr);

            if (!result.objInfo) {
                callback(new Error('An attempt was made to parse a Nexacro module json file with an unknown or unsupported format.'));
                return;
            }

            callback(null, result.objInfo);
        }
        catch (ex) {
            callback(ex);
        }
    });
}

function getMetaInfosFromModuleJsonSync(jsonfile) {

    const data = fs.readFileSync(jsonfile, 'utf8');

    // remove BOM
    const jsonstr = data.trim();
    const result = JSON.parse(jsonstr);

    if (!result.objInfo) {
        throw new Error('An attempt was made to parse a Nexacro module json file with an unknown or unsupported format.');
    }

    return result.objInfo;
}

function getGeneratePromise(srcfile, outdir, gen_opts) {

    if (!srcfile) {
        return [Promise.reject(new Error('Missing argument \'source\' file.'))];
    }

    return new Promise((resolve, reject) => {

        glob(srcfile, function (err, matches) {

            if (err) {
                return reject(err);
            }

            if (matches.length == 0) {
                return resolve(null);
            }

            let generatePromises = [];            
            matches.forEach((matchedfile, idx) => {

                const extname = path.extname(matchedfile);
    
                if (extname === '.info') {
                    // metainfo
                    const outfile = getOutputFilePath(srcfile, matchedfile, outdir, gen_opts.emitFlat);   
                    generatePromises.push(DTSGenerator.generatePromise(matchedfile, outfile, gen_opts));
                }
                else if (extname === ".json") {
                    // nexacro module json
    
                    const srcroot = path.dirname(matchedfile);                            
                    if (!outdir) {
                        outdir = path.dirname(matchedfile);
                    }

                    const metafiles = getMetaInfosFromModuleJsonSync(matchedfile);

                    const routePattern = gen_opts.routePattern ? gen_opts.routePattern : { origin: 'metainfo/', route: 'metainfo/*/'};
                    console.log(`> Find metainfo files in the path of the following pattern: ${routePattern.origin} -> ${routePattern.route}`);

                    metafiles.forEach((metafile, subidx) => {

                        let metafilepath;
                        if (routePattern && routePattern.origin) {
                            metafilepath = path.resolve(srcroot, metafile.replace(routePattern.origin, routePattern.route));
                        }
                        else {
                            metafilepath = path.resolve(srcroot, metafile);
                        }

                        const glob_opt = routePattern ? routePattern.globOption : null;
                        const founds = glob.sync(metafilepath, glob_opt);
                        if (!founds || founds.length == 0) {
                            generatePromises.push(Promise.reject(new Error(`Missing metainfo file or could not be found: ${metafilepath}`)));
                            return;
                        }

                        founds.forEach(found => {
                            const outfile = getOutputFilePath(srcfile, found, outdir, gen_opts.emitFlat);
                            generatePromises.push(DTSGenerator.generatePromise(found, outfile, gen_opts));
                        })
                    });
                }
                else {
                    const unexpectedFile = new Error(`> An attempt was made to generate d.ts with an unknown or unsupported file format: ${metafile}`);
                    unexpectedFile.source = matchedfile;

                    generatePromises.push(Promise.reject(unexpectedFile));
                }
            });

            return resolve(generatePromises);
        });
    });
}

function generateDeclaration(taskName, taskNo, srcfile, outdir, gen_opts) {

    if (!srcfile) {
        console.error(`> Missing source file or could not be found: ${srcfile}.`);
        return;
    }

    console.log(`${taskNo}> ======== ${taskName} ========`);

    getGeneratePromise(srcfile, outdir, gen_opts)
        .then((matchPromises) => {

            if (!matchPromises || matchPromises.length == 0) {
                console.error(`${taskNo}> Missing source file or could not be found: ${srcfile}.`);
                return;
            }

            return Promise.allSettled(matchPromises);
        })
        .then((results) => {
            let total = results.length, succeed = 0, failed = 0, skipped = 0;

            results.forEach((result, fileIdx) => {

                if (result.status == 'rejected') {
                    console.error(`${taskNo}> [${fileIdx+1}] Failed to generate d.ts file: ${result.reason.source}\n\t${result.reason.stack}`);
                    failed++;
                }
                else if (result.status == 'fulfilled') {

                    if (result.value) {
                        const taskStatus = result.value.status;
                        if (taskStatus == 'skipped') {
                            console.log(`${taskNo}> [${fileIdx+1}] Skipped to generate d.ts file : ${result.value.source}`);
                            skipped++;
                        }
                        else {
                            console.log(`${taskNo}> [${fileIdx+1}] Complete generate declaration file: ${result.value.output}`);
                            succeed++;
                        }
                    }

                }
            });

            console.log(`${taskNo}> -------- Generated: Total: ${total} file(s), Success: ${succeed}, Fail: ${failed}, Skip: ${skipped} --------`);
        })
        .catch((err) => {
            console.error(`${taskNo}> ${err.stack}`);
        });
}

function stringToTemplateLiteral (str, params) {
    const names = Object.keys(params);
    const vals = Object.values(params);
    return new Function(...names, `return \`${str}\`;`)(...vals);
}

function createIndexFile(outfile, refTypes, refFiles) {

    const isImportNexacro = (refTypes.length > 0 && refTypes.findIndex((types) => types.match(/[\/|\\]nexacro(?:[\/|\\])?$/g) != null) > -1);
    const templateRoot = path.resolve(__dirname, '../template/');

    return new Promise((resolve, reject) => {
        let templateFile;
        if (isImportNexacro) {
            templateFile = path.resolve(templateRoot, 'import.d.ts');
        }
        else {
            templateFile = path.resolve(templateRoot, 'index.d.ts');
        }

        fs.readFile(templateFile, "utf8", (err, data) => {
            if (err) {
                reject(err);
                return;
            }

            const result = stringToTemplateLiteral(data, { ref_types: refTypes, ref_paths: refFiles });

            const outdir = path.dirname(outfile);
            if (!fs.existsSync(outdir)) {
                fs.mkdirSync(outdir, {recursive : true});

                if (!fs.existsSync(outdir)) {
                    reject(new Error(`Failed to create directory '${outdir}'.`));
                    return;
                }
            }

            fs.writeFile(outfile, result, (err) => {
                if (err) {
                    reject(err);
                    return;
                }
    
                resolve(outfile);
            });
        });
    });
}

function createTSConfigFile(tsconfigFile, gen_opts) {

    return new Promise((resolve, reject) => {

        const outdir = path.dirname(tsconfigFile);
        if (!fs.existsSync(outdir)) {
            fs.mkdirSync(outdir, {recursive : true});

            if (!fs.existsSync(outdir)) {
                reject(new Error(`Failed to create directory '${outdir}'.`));
                return;
            }
        }

        if (!gen_opts) gen_opts = {};

        fs.writeFile(tsconfigFile, JSON.stringify(gen_opts, null, '\t'), (err) => {
            if (err) {
                reject(err);
                return;
            }

            resolve(tsconfigFile);
        });
    });
}

function buildDeclarationModule(taskName, taskNo, srcfile, outdir, gen_opts) {

    if (!srcfile) {
        console.error(`> Missing source file or could not be found: ${srcfile}.`);
        return;
    }

    console.log(`${taskNo}> ======== ${taskName} ========`);

    getGeneratePromise(srcfile, outdir, gen_opts)
        .then((matchPromises) => {

            if (!matchPromises || matchPromises.length == 0) {
                return Promise.reject(`Missing source file or could not be found: ${srcfile}.`);
            }

            return Promise.allSettled(matchPromises);
        })
        .then((results) => {
            let total = results.length, succeed = 0, failed = 0, skipped = 0;

            let refFiles = [];
            results.forEach((result, fileIdx) => {

                if (result.status == 'rejected') {
                    console.error(`${taskNo}> [${fileIdx+1}] Failed to generate d.ts file: ${result.reason.source}\n\t${result.reason.stack}`);
                    failed++;
                }
                else if (result.status == 'fulfilled') {

                    if (result.value) {
                        const taskStatus = result.value.status;
                        if (taskStatus == 'skipped') {
                            console.log(`${taskNo}> [${fileIdx+1}] Skipped to generate d.ts file : ${result.value.source}`);
                            skipped++;
                        }
                        else {
                            console.log(`${taskNo}> [${fileIdx+1}] Complete generate declaration file: ${result.value.output}`);
                            succeed++;

                            const refFilePath = path.relative(outdir, result.value.output);
                            refFiles.push(refFilePath);
                        }
                    }
                }
            });

            console.log(`${taskNo}> -------- Generated: Total: ${total} file(s), Success: ${succeed}, Fail: ${failed}, Skip: ${skipped} --------`);

            const indexFile = path.resolve(outdir, './index.d.ts');
            const refTypes = gen_opts.referenceTypes || [];

            return createIndexFile(indexFile, refTypes, refFiles);
        })
        .then((result) => {
            console.log(`${taskNo}> Created '${result}'`);

            const tsconfigFile = path.resolve(outdir, './tsconfig.json');
            return createTSConfigFile(tsconfigFile, gen_opts.tsconfig);
        })
        .then((result) => {
            console.log(`${taskNo}> Created '${result}'`);

            const pathMap = outdir.split(path.sep);
            return Promise.resolve(pathMap.slice(pathMap.length-1));
        })
        .then((moduleName) => {
            console.log(`${taskNo}> -------- Finished Build: '${moduleName}' --------`);
        })
        .catch((err) => {
            console.error(`${taskNo}> ${err.stack}`);
        });
}

module.exports = {
    generateDeclaration,
    buildDeclarationModule
};
