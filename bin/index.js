
const { program } = require('commander');
const packageJson = require('../package.json');

const path = require("path");  
const fs = require('fs');
const readline = require('readline');

const gen2dts = require('../lib/gen2dts.js');
const makeTypes = require('../lib/make-types.js');

const cwd = process.cwd();
const configFile = path.join(cwd, 'meta2dts.json');

program
    .version(packageJson.version)
    .argument('<file...>', 'Input metainfo files or nexacro module json file. (allow glob syntax)')
    .option('-o, --output <DIRECTORY>', 'Specify output path.')
    .option('--omit', 'omit jsdoc comment.', false)
    .option('-r, --route <ORIGIN:ROUTE>', 'Route path of metainfo directory. (Ignore if the file is not a module file)', 'metainfo/:metainfo/*/')
    .option('--emit-flat', 'flatten the output path to the root.', false)
    .action((files, opts) => {

        let srcfile, outdir;
        if (opts.output) {
            outdir = path.resolve(opts.output);
        }

        let gen_opts = {};
        if (opts.omit) {
            gen_opts.noJsDocComment = true;
        }

        if (opts.route) {
            const routeVal = opts.route.split(':');
            if (routeVal.length != 2) {
                throw new Error(`Wrong argument. ('-r, --route <ORIGIN:ROUTE>')`);
            }

            const origin = routeVal[0].replace(/\'/g, '').replace(/\"/g, '').trim();
            const route = routeVal[1].replace(/\'/g, '').replace(/\"/g, '').trim();
            if (origin) {
                gen_opts.routePattern = { origin:origin , route: route };
            }
        }

        if (opts.emitFlat) {
            gen_opts.emitFlat = opts.emitFlat;
        }

        files.forEach((file, idx) => {
            if (path.isAbsolute(file)) {
                srcfile = file;
            }
            else {
                srcfile = path.resolve(cwd, file);
            }
            
            gen2dts.generateDeclaration(`generate '${file}'`, idx+1, srcfile, outdir, gen_opts);
        });
    });

program
    .command('init')
    .description('Initializes a Nexacro meta2dts project and creates a meta2dts.json file.')
    .action(function () {
        const templatedir = path.join(__dirname, '../template');
        const configTemplateFile = path.join(templatedir, 'meta2dts.json');
        if (!fs.existsSync(configTemplateFile)) {
            throw 'missing a template file for \'meta2dts.json\'.';
        }

        fs.readFile(configTemplateFile, (err, data) => {
            if (err) throw err;

            fs.writeFile(configFile, data, { "encoding": 'utf8', "flag": 'wx' }, (err) => { 
                if (err) {

                    if (err.code == "EEXIST") {
                        console.error(`File ${configFile} already exists.`);

                        const rl = readline.createInterface(process.stdin, process.stdout);
                        rl.question("Overwrite? [y/n]: ", function(answer) {
                            if(answer === "y") {
                                fs.writeFile(configFile, data, { "encoding": 'utf8', "flag": 'w' }, (err) => {
                                    if (err) {
                                        rl.close();
                                        throw err;
                                    }

                                    console.log(`Wrote to ${configFile}.`);
                                    console.log(`${data}`);
                                    rl.close();
                                });
                            }
                            else {
                                rl.close();
                            }
                        });
                        rl.write('y');
                    }
                    else {
                        throw err; 
                    }
                }
                else {
                    console.log(`Wrote to ${configFile}.`);
                    console.log(`${data}`);
                }
            });
        });
    });

program
    .command('build')
    .description('Build project given the path to its configuration file, or to a folder with a meta2dts.json.')
    .argument('[file...]', 'Input meta2dts.json files or a folder with a meta2dts.json.')
    .option('-o, --output <DIRECTORY>', 'Specify output path.')
    .option('--reference <TYPES>', 'Specify dependency declaration packages. (only for build project)')
    .action((files, opts) => {
        // create Types Module

        let outdir;
        if (opts.output) {
            outdir = path.resolve(opts.output);
        }

        if (files && files.length > 0) {
            if (Array.isArray(files)) {
                files.forEach((file, idx) => {
                    let srcfile;

                    if (path.isAbsolute(file)) {
                        srcfile = file;
                    }
                    else {
                        srcfile = path.resolve(cwd, file);
                    }
                    makeTypes(`build '${file}'`, idx+1, srcfile, outdir);
                });
            }
        }
        else {
            const srcfile = path.resolve('meta2dts.json');
            if (!fs.existsSync(srcfile)) {
                throw new Error(`Missing file name or could not be found: 'meta2dts.json'.`);
            }
            else {
                makeTypes(`build '${srcfile}'`, 1, srcfile, outdir);
            }
        }
    });



//console.log(process.argv.slice(1).join(' '));

program.parse();

