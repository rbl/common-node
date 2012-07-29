
var FS = require("fs");

var Logger = require("rbl/logger");

var Uglify = require('uglify-js');

// ensureDirectory
//
// Start at a base directory and then walk down a file path making sure that all
// the intermediate directories exist. Assumes the last element of the path is a
// filename which should not be created as a directory.
module.exports.ensureDirectory = function(base, additional, next) {
    
    function recurseOrNot() {
        
        // Rip off the next part of 'addl' and if we have more remaining keep going. Otherwise
        // we are successfully done.
        
        var ix = additional.indexOf("/");
        if (ix==-1) {
            // Only the file part remains, thus we are done
            return next();
        }
        if (ix==0) {
            // try again big guy - it starts with a /
            additional = additional.slice(1);
            return recurseOrNot();
        }
        
        // We have at least 1 directory remaining
        var dir = additional.slice(0,ix);
        var remains = additional.slice(ix+1, additional.length);
        
        if (base[base.length-1] != "/") {
            base += "/";
        }
        base += dir;
        
        // Big guy recursion it is
        module.exports.ensureDirectory(base, remains, next);
    }
    
    FS.stat(base, function(err, stats) {
        
        if (!err && !stats.isDirectory()) {
            err = "" + base + " is not a directory";
        }
        
        if (err) {
            if (err.code!='ENOENT') return next(err);
        
            // Try to make it        
            FS.mkdir(base, 0775, function(err) {
                // Don't know why EEXIST is happening on first dir (probably a logic error) but don't care
                if (err && err.code!="EEXIST") return next(err);
                
                recurseOrNot(additional);
            })
            return;
        }
        
        // It exists and is a directory, so we might want to just recurse
        recurseOrNot(additional);        
    });
}

// Helpers
function bareURL(url) {
    var ix = url.indexOf("?");
    if (ix!=-1) {
        return url.slice(ix);
    }
    return url;    
}

function extensionFrom(path) {
    var ix = path.lastIndexOf(".");
    if (ix==-1) {
        return "";
    }
    
    return path.slice(ix+1, path.length);
}


// ensureDirectoryMiddleware
//
// Returns a middleware that will make sure the path of the file named in the URL exists in the
// specified base directory. This is useful to use in front of the stylus middleware or in front
// of the minifier middleware to make sure they don't throw an error when trying to write their
// output.

module.exports.ensureDirectoryMiddleware = function(options) {

    // setup necessary default options
    options = options || {};
    
    // Copy these options in so they don't change underneath us
    var src = options.src || false;
    var dest = options.dest;    
    var extensions = options.extensions || {"js": true}
    var debug = options.debug;
    
    // Validate
    if (!dest) {
        throw "ensureDirectory: requires a 'dest' option to be set";
    }
    
    return function(req, res, next) {
        
        // Get the extension of the URL
        var url = bareURL(req.url);
        var ext = extensionFrom(url);
        
        if (!ext || !extensions[ext]) {
            // not for us
            return next();
        }
        if (debug) {
            Logger.debug("ensureDirectory: active for url "+url);
        }
        
        // It is for us, it is!
        if (src) {
            // Only do the output if the src directory exists. We don't know about the file, but try the source dir
            
            var srcPath = src+url;
            var ix = srcPath.lastIndexOf("/");
            if (ix!=-1) {
                srcPath = srcPath.slice(0,ix);
            }
            
            FS.stat(srcPath, function(err, stats) {
                
                if (err) {
                    // ignore it, but don't ensure directories
                    if (debug) Logger.debug("ensureDirectory: could not find src path "+ srcPath + " so not making directories")
                    return next();
                }
                
                // Ok to ensure output directory because source exists
                if (debug) Logger.debug("ensureDirectory: found src path "+srcPath+" ensuring path for destination "+(dest+url));
                return module.exports.ensureDirectory(dest, url, next);
            });
        } else {
            // always ensure the output without bothering to check for a source
            if (debug) Logger.debug("ensureDirectory: ensuring path for destination "+(dest+url));
            return module.exports.ensureDirectory(dest, url, next);
        }
    }
}

// middleware
//
// Returns the normal minifier middleware. Right now the 'copy' option must be set to true
// because this doesn't actually know how to compile things on it's own (yet)

module.exports.middleware = function(options) {
    
    // setup necessary default options
    options = options || {};
    
    // Copy these options in so they don't change underneath us
    var src = options.src;
    var dest = options.dest;
    var mangle = options.mangle;
    var squeeze = options.squeeze;
    var copy = options.copy;
    var debug = options.debug;
    var extensions = options.extensions || {"js": true};
    
    if (!src) {
        throw "minifier: requires a 'src' option to be set";
    }
    
    if (!dest) {
        throw "minifier: requires a 'dest' option to be set";
    }

    // If there is no mangle or squeeze that is the same as a copy
    if (!mangle && !squeeze) copy = true;
    
    // Setup a compile function to translate a source string into a destination string    
    var compile = options.compile;
    
    if (!compile) {

        // If the copy flag is specified, the 'compile' does nothing!
        if (copy) {
            compile = function(srcContent) { return srcContent; }
        } else {
            compile = function(srcContent) {
                var ast = Uglify.parser.parse(str);
                if (mangle) ast = Uglify.uglify.ast_mangle(ast);
                if (squeeze) ast = Uglify.uglify.ast_squeeze(ast);
                var ugly = Uglify.uglify.gen_code(ast);
                return ugly;
            }
        }
    }
    
    // Return the middleware function
    return function(req, res, next) {

        var url = bareURL(req.url);
        var ext = extensionFrom(url);
        
        if (!ext || !extensions[ext]) {
            // Not for us
            return next();
        }

        // Ok, seems like it is for us ....
        var srcPath = src + url;
        var destPath =dest + url;

        if (debug) {
            Logger.debug("minifier:  srcPath="+srcPath);
            Logger.debug("minifier: destPath="+destPath);
        }
        
        // Let's get the source mtime. If no source, we bail
        FS.stat(srcPath, function(err, srcStats) {
            if (err) {
                if (err.code == 'ENOENT') {
                    // File was not found, so just fall through to 404 land later
                    Logger.debug("minifier: srcPath "+srcPath+" not found - perhaps it's a static file?");
                    return next();
                }
                // else, some other bizzare issue, report it
                
                return next(err);
            }
            
            // Now we need a destination file mtime (if any)
            FS.stat(destPath, function(err, destStats) {
                if (err && err.code != 'ENOENT') {
                    // Something lame, bail
                    return next(err);
                }
                
                // Either it exists (in which case we got a dstats object) or it doesn't
                if (err || !destStats || destStats.mtime < srcStats.mtime) {
                    // We must compile it!
                    
                    // Presume these files are small enough to read into memory
                    FS.readFile(srcPath, function(err, srcContent) {
                        if (err) return next(err);
                        
                        if (debug) {
                            Logger.debug("minifier: destination file "+destPath+" does not exist or is out of date. Compiling.");
                        }
                        var destContent = compile(srcContent);
                        
                        // And write out the file, and then we're outtie
                        return FS.writeFile(destPath, destContent, next);
                    });
                    return;
                }
                
                // else, no need to do anything. It exists and has the same mod time
                if (debug) {
                    Logger.debug("minifier: destination file is up to date src.mtime=",srcStats.mtime," dest.mtime=",destStats.mtime);
                }
                return next();
            });
        });
    }
}


// Some test code ...
//
// if (!module.parent) {
//     module.exports.ensureDirectory("/tmp/", "foo/bar/allowed/file.js", function(err) {
//         Logger.debug("err="+err);
//     })
// }