var Mongoose = require('mongoose');
var Document = Mongoose.Document;
//var Mongoose.connection.db = Mongoose.connection.db; 
var GridStore = Mongoose.mongo.GridStore;

function writeGridStore(name, permissions, data, isFile, callback) {
    
    var gridStore = new GridStore(Mongoose.connection.db, name, permissions);
    gridStore.open(function(error, gridStore) {
        
        if (error) {
            return callback(error);
        }
        
        function done(error, gridStoreIn) {
            
            if (error) {
                return callback(error);
            }
            gridStore.close(function(error, result) {
                
                return callback(error);
            });
        }
                
        if (isFile) {
            gridStore.writeFile(data, done);
        } else {
            gridStore.write(data, done);
        }
    });
}

Document.prototype.gridStoreRead = function (callback) {
    
    if (!this._id) {
        
        var error = "Object doesn't have an id";
        return callback(error, null);
    }
    GridStore.read(Mongoose.connection.db, this._id, function (error, data){
        
        return callback(error, data);
    });
};

Document.prototype.gridStoreStream = function (callback) {
    
    if (!this._id) {
        
        var error = "Object doesn't have an id";
        return callback(error, null);
    }
    var gridStore = new GridStore(Mongoose.connection.db, this._id, "r");
    gridStore.open(function(error, gridStore) {
        
        return callback(error, gridStore.stream(true));
    });    
}

Document.prototype.gridStoreExists = function (callback) {
    
    if (!this._id) {
        
        var error = "Object doesn't have an id";
        return callback(error, false);
    }
    GridStore.exist(Mongoose.connection.db, this._id, function(error, result) {
          
          return callback(error, result);
    });
}

Document.prototype.gridStoreWrite = function (data, callback) {
    
    if (!this._id) {
        
        var error = "Object doesn't have an id";
        return callback(error);
    }
    writeGridStore(this._id, "w", data, false, function (error){
        return callback(error);
    });
}

Document.prototype.gridStoreAppend = function (data, callback) {
    
    if (!this._id) {
        
        var error = "Object doesn't have an id";
        return callback(error);
    }
    writeGridStore(this._id, "w+", data, false, function (error){
        return callback(error);
    });
}

Document.prototype.gridStoreWriteFile = function (data, callback) {
    
    if (!this._id) {
        
        var error = "Object doesn't have an id";
        return callback(error);
    }
    writeGridStore(this._id, "w", data, true, function (error){
        return callback(error);
    });
}

Document.prototype.gridStoreDelete = function (callback) {
    
    if (!this._id) {
        
        var error = "Object doesn't have an id";
        return callback(error);
    }
    GridStore.unlink(Mongoose.connection.db, this._id, function (error, gridStore) {
        
        return callback(error);
    });
}