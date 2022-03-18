
const path = require("path");  
const fs = require('fs');
const glob = require('glob');

const DTSGenerator = require('./DTSGenerator');

function getOutputFilePath (srcfile, matchedfile, outroot) {
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

    const reldirname = path.dirname(relpath);
    const reldirs = reldirname.split(path.sep).filter(val => val !== '.' && val !== '..');
    const outdir = path.join(outroot, path.join.apply(null, reldirs));

    const filename = path.basename(matchedfile, '.info');

    return path.join(outdir, filename + '.d.ts');
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

function generateMetainfo2Dts(procIdx, procName, srcfile, outdir) {
    if (!srcfile) return;

    console.log(`${procIdx+1}> ============ ${procName} ============`);

    const filepath = path.resolve(srcfile);
    //console.log(`generate: ${srcfile}`);

    glob(filepath, function (err, matches) {
        if (err) throw err;

        let matched_cnt = matches.length;
        let succeed = 0, failed = 0;

        matches.forEach((matchedfile, idx) => {

            const extname = path.extname(matchedfile);

            if (extname === '.info') {
                // metainfo
                const outfile = getOutputFilePath(srcfile, matchedfile, outdir);
                console.log(`${procIdx+1}> [${idx+1}] Generating declaration file: ${matchedfile} ->  ${outfile}`);

                DTSGenerator.generate(matchedfile, outfile, (err, result) => {
                    if (err) {
                        console.error(`${procIdx+1}> [${idx+1}] Fail generate declaration file: ${outfile}\n\t${err.stack}`);
                        failed++;
                    }
                    else {
                        console.log(`${procIdx+1}> Complete generate declaration file: ${result}`);
                        succeed++;
                    }

                    if (matched_cnt === (succeed + failed)) {
                        console.log(`${procIdx+1}> ============ Total: ${matched_cnt} file(s), Succeess: ${succeed}, Fail: ${failed} ============`);
                    }
                });
            }
            else if (extname === ".json") {
                // nexacro module json

                console.log(`${procIdx+1}> [${idx+1}] Generating declaration file: ${matchedfile}`);

                getMetaInfosFromModuleJson(matchedfile, (err, metafiles) => {

                        if (err) {
                            console.error(`${procIdx+1}> [${idx+1}] Fail generate declaration file: ${matchedfile}\n\t${err.stack}`);
                            failed++;

                            if (matched_cnt === (succeed + failed)) {
                                console.log(`${procIdx+1}> ============ Total: ${matched_cnt} file(s), Succeess: ${succeed}, Fail: ${failed} ============`);
                            }
                        }
                        else {
                            const srcroot = path.dirname(matchedfile);                            
                            if (!outdir) {
                                outdir = path.dirname(matchedfile);
                            }                            

                            matched_cnt += (metafiles.length - 1); // -1 : module json


                            metafiles.forEach((metafile, subidx) => {
                                const realmetafile = metafile.replace('metainfo/', 'metainfo/KOR/');
                                const metafilepath = path.resolve(srcroot, realmetafile);

                                const outfile = getOutputFilePath(srcfile, metafilepath, outdir);
                                console.log(`${procIdx+1}> [${idx+1}/${subidx+1}] Generating declaration file: ${metafilepath} ->  ${outfile}`);

                                DTSGenerator.generate(metafilepath, outfile, (err, result) => {
                                    if (err) {
                                        console.error(`${procIdx+1}> [${idx+1}/${subidx+1}] Fail generate declaration file: ${outfile}\n\t${err.stack}`);
                                        failed++;
                                    }
                                    else {
                                        console.log(`${procIdx+1}> [${idx+1}/${subidx+1}] Complete generate declaration file: ${result}`);
                                        succeed++;
                                    }
                
                                    if (matched_cnt === (succeed + failed)) {
                                        console.log(`${procIdx+1}> ============ Total: ${matched_cnt} file(s), Succeess: ${succeed}, Fail: ${failed} ============`);
                                    }
                                });
                            });
                        }
                    }
                );
            }
            else {
                console.error(`> An attempt was made to generate d.ts with an unknown or unsupported file format: ${metafile}`);
                failed++;

                if (matched_cnt === (succeed + failed)) {
                    console.log(`${procIdx+1}> ============ Total: ${matched_cnt} file(s), Succeess: ${succeed}, Fail: ${failed} ============`);
                }
            }
        });
    });
}

module.exports = generateMetainfo2Dts;
