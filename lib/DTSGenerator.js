const path = require("path");  
const fs = require('fs');

var parseString = require('xml2js').parseString;

const NexacroMetaObjectInfoHandler = require('./ObjectInfoHandler');
const NexacroMetaEnumInfoHandler = require('./EnumInfoHandler');
const NexacroMetaUnitInfoHandler = require('./UnitInfoHandler');

class NexacroDTSGenerator {

    // generateFromXMLData(xmlData[, parse_opts[, gen_opts]], callback)
    static generateFromXMLData (xmlData, parse_opts, gen_opts, callback) {

        if (arguments.length === 2 && typeof parse_opts === 'function') {
            callback = parse_opts;
            parse_opts = {};
        }
        else if (arguments.length === 3 && typeof gen_opts === 'function') {
            callback = gen_opts;
            gen_opts = {};
        }
        else if (!xmlData || (parse_opts != null && typeof parse_opts !== 'object')
            || (gen_opts != null && typeof gen_opts !== 'object')
            || (callback != null && typeof callback !== 'function')) {
            throw new Error('Wrong arguments.');
        }

        if (!parse_opts) {
            parse_opts = {};
        }

        if (!gen_opts) {
            gen_opts = {};
        }

        if (!callback) {
            callback = function (err) {
                if (err) throw err;
            };
        }

        parseString(xmlData, parse_opts, (err, result) => {

            if (!result.MetaInfo) {
                callback(new Error('An attempt was made to parse a metainfo file with an unknown or unsupported format.'));
                return;
            }

            try {
                const info = result.MetaInfo;
                let handler, rootNode;

                if (info.Object && info.Object.length > 0) {
                    handler = new NexacroMetaObjectInfoHandler;
                    rootNode = info.Object;
                }
                else if (info.UnitInfo) {
                    handler = new NexacroMetaUnitInfoHandler;
                    rootNode = info.UnitInfo;
                }
                else if (info.EnumInfo) {
                    handler = new NexacroMetaEnumInfoHandler;
                    rootNode = info.EnumInfo;
                }
                else if (info.RefreshInfo) {
                    callback(null, null);
                    return;
                }
                else {
                    const keys = Object.keys(info).filter(val => val != '$');
                    callback(new Error(`Unexpected a tag '<${keys.join(',')}>'.`));
                    return;
                }

                if (!handler.parse(rootNode)) {
                    callback(new Error('An attempt was made to parse a metainfo file with an unknown or unsupported format.'));
                    return;
                }
                
                callback(null, handler.toDTS(gen_opts));
            }
            catch (ex) {
                callback(ex);
            }
        });
    }

    static generate (srcfile, outfile, option, callback) {

        if (arguments.length === 3 && typeof option === 'function') {
            callback = option;
            option = {};
        }
        else if (!srcfile || !outfile || (option != null && typeof option !== 'object')) {
            throw new Error('Wrong arguments.');
        }

        if (!option) {
            option = {};
        }
        if (!callback) {
            callback = function (err) {
                if (err) throw err;
            };
        }

        if (!srcfile || !fs.existsSync(srcfile)) {
            callback(new Error(`Missing source file name or could not be found: ${srcfile}.`));
            return;
        }

        if (!outfile) {
            callback(new Error('The output path is not specified.'));
            return;
        }

        const outpath = path.dirname(outfile);

        fs.readFile(srcfile, 'utf8', (err, data) => {

            if (err) {
                callback(err);
                return;
            }

            const parse_opts = {};            
            this.generateFromXMLData(data, parse_opts, option, (err, result) => {

                if (err) {
                    callback(err);
                    return;
                }

                if (result) {
                    if (!fs.existsSync(outpath)) {
                        fs.mkdirSync(outpath, {recursive : true});

                        if (!fs.existsSync(outpath)) {
                            callback(new Error(`Failed to create directory '${outpath}'.`));
                            return;
                        }
                    }

                    fs.writeFileSync(outfile, result);

                    callback(null, outfile);
                }
                else {
                    // no error, no emit : skip
                    callback(0);
                }

            });
        });
    }

    static generatePromise (srcfile, outfile, option) {

        return new Promise ((resolve, reject) => {

            NexacroDTSGenerator.generate(srcfile, outfile, option, (err, result) => {
                if (err) {
                    err.source = srcfile;
                    reject(err);
                }
                else {
                    if (err === 0) {
                        resolve({status: 'skipped', source: srcfile});    
                    }
                    else {
                        resolve({status: 'succeed', source: result, output: result});
                    }
                }
            });  
        });
    }
}

module.exports = NexacroDTSGenerator;
