const path = require("path");  
const fs = require('fs');

var parseString = require('xml2js').parseString;

const NexacroMetaObjectInfoHandler = require('./ObjectInfoHandler');
const NexacroMetaEnumInfoHandler = require('./EnumInfoHandler');
const NexacroMetaUnitInfoHandler = require('./UnitInfoHandler');

class NexacroDTSGenerator {

    // generateFromXMLData(xmlData[, opts], callback)
    static generateFromXMLData (xmlData, opts, callback) {

        if (arguments.length === 2 && typeof opts === 'function') {
            callback = opts;
            opts = {};
        }
        else if (!xmlData || (opts != null && typeof opts !== 'object')) {
            throw new Error('Wrong arguments.');
        }

        if (!opts) {
            opts = {};
        }
        if (!callback) {
            callback = function (err, result) {
                if (err) throw err;
            };
        }

        parseString(xmlData, opts, (err, result) => {

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
                else {
                    const keys = Object.keys(info).filter(val => val != '$');
                    callback(new Error(`Unexpected a tag '<${keys.join(',')}>'.`));
                    return;
                }

                if (!handler.parse(rootNode)) {
                    callback(new Error('An attempt was made to parse a metainfo file with an unknown or unsupported format.'));
                    return;
                }
                
                callback(null, handler.toDTS());
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
            callback = function (err, result) {
                if (err) throw err;
            };
        }

        if (!srcfile || !fs.existsSync(srcfile)) {
            callback(new Error(`Missing source file name or could not be found: ${srcfile}.`));
        }

        if (!outfile) {
            callback(new Error('The output path is not specified.'));
        }

        const outpath = path.dirname(outfile);

        fs.readFile(srcfile, 'utf8', (err, data) => {

            if (err) {
                callback(err);
                return;
            }

            const parse_opts = {};            
            this.generateFromXMLData(data, parse_opts, (err, result) => {

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

            });
        });
    }
}

module.exports = NexacroDTSGenerator;
