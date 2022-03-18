
const { program } = require('commander');
const packageJson = require('../package.json');

const path = require("path");  
const fs = require('fs');
const readline = require('readline');

const gen2dts = require('./gen2dts.js');

const cwd = process.cwd();
const configFile = path.join(cwd, 'meta2dts.json');

program
    .version(packageJson.version)
    .argument('[file...]', 'Input metainfo files or nexacro module json file. (allow glob syntax)')
    .option('-o, --output <DIRECTORY>', 'Specify output path.')
    .action((files, opts) => {

        let outdir;
        if (opts.output) {
            outdir = path.resolve(opts.output);
        }

        if (files) {
            
            if (Array.isArray(files)) {
                files.forEach((file, idx) => {
                    let srcfile;

                    if (path.isAbsolute(file)) {
                        srcfile = file;
                    }
                    else {
                        srcfile = path.resolve(cwd, file);
                    }
                    gen2dts(idx, `generate ${file}`, srcfile, outdir);
                });
            }
            else if (typeof files == 'string') {
                if (path.isAbsolute(files)) {
                    srcfile = files;
                }
                else {
                    srcfile = path.resolve(cwd, files);
                }
                gen2dts(0, `generate ${files}`, srcfile, outdir);
            }
        }
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
    .action((arguments, options) => {
        //console.log(arguments, options ? options.toString() : '');
    });



//console.log(process.argv.slice(1).join(' '));

program.parse();

