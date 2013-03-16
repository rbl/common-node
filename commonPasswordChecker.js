var Mongo = require("mongodb");
var Logger = require("rbl/logger");

function CommonPasswordChecker(opts, cb) {
    var self = this;

    if (!opts) opts = {};
    
    if (!opts.hostname) opts.hostname = "127.0.0.1";
    if (!opts.port) opts.port = 27017;
    if (!opts.dbname) opts.dbname = "common_passwords";
    if (!opts.collection) opts.collection = "common_passwords";
    
    self.opts = opts;
    
    // Connect to mongo
    server = new Mongo.Server(opts.hostname, opts.port, {auto_reconnect:true});
    self.db = new Mongo.Db(opts.dbname, server, {safe:false});
 
    self.db.open(function(err, db) {
        if (err) self.dberr = err;
        if (Logger.logErrorObj("Opening DB ", err) ) {
            self.dberr = err;
            if (cb) cb(err);
            return;
        }
        
        // Get a collection
        self.db.collection(opts.collection, function(err, col) {
            if (Logger.logErrorObj("Getting collection ", err) ) {
                self.dberr = err;
                if (cb) cb(err);
                return;
            }
            
            self.collection = col;
            
            if (cb) cb();
        });
    });
}
module.exports = CommonPasswordChecker;

CommonPasswordChecker.prototype.isPasswordKnown = function(password, cb) {
    var self = this;
    
    if (!cb) return;
    
    if (self.dberr) {
        Logger.error("Can not check password because of db error:",self.dberr);
        return cb(self.dberr, false);
    }
    
    self.collection.findOne({_id: password}, function(err, doc) {
        if (Logger.logErrorObj("Looking for password in db ",err)) {
            return cb(err, false);
        }
        
        if (doc) return cb(null, true);
        cb(null, false);
    });
}

CommonPasswordChecker.prototype.close = function() {
    if (this.db) {
        this.db.close();
        this.dberr = "Database has already been closed";
    }
}