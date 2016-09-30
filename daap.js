/*
/* (c) 2016 Björn Ricks <bjoern.ricks@gmail.com>
/*
/* See LICENSE comming with the source of daap.js for details.
*/

'use strict';

var LOGIN_URL = 'login';
var LOGOUT_URL = 'logout';
var UPDATE_URL = 'update';
var SERVER_INFO_URL = 'server-info';
var DATABASES_URL = 'databases';
var ITEMS_URL = 'items';
var PLAYLISTS_URL = 'containers';
var CONTENT_CODES_URL = 'content-codes';

var DEFAULT_SERVER = '127.0.0.1';
var DEFAULT_PORT = 3689;
var DEFAULT_TIMEOUT = 10000;

var INVALID_OFFSET = -1;

var NAME_LENGTH = 4;
var SIZE_LENGTH = 4;
var HEADER_LENGTH = NAME_LENGTH + SIZE_LENGTH;

function decode_utf8(buffer) {
    var plaintext = '';
    var i = 0;
    var c = 0;
    var c1 = 0;
    var c2 = 0;

    while (i < buffer.length) {
        c = buffer[i];
        if (c < 128) {
            plaintext += String.fromCharCode(c);
            i++;
        }
        else if ((c > 191) && (c < 224)) {
            c1 = buffer[i + 1];
            plaintext += String.fromCharCode(((c & 31) << 6) | (c1 & 63));
            i += 2;
        }
        else {
            c1 = buffer[i + 1];
            c2 = buffer[i + 2];
            plaintext += String.fromCharCode(
                    ((c & 15) << 12) | ((c1 & 63) << 6) | (c2 & 63));
            i += 3;
        }
    }
    return plaintext;
}

function decode_ascii(buffer) {
    return String.fromCharCode.apply(null, buffer);
}

function is_defined(value) {
    return value !== undefined;
}

function request(url, options) {
    return new Daap.Promise(function(resolve, reject) {
        var xhr = new XMLHttpRequest();
        var method = options.method ? options.method.toUpperCase() : 'GET';

        xhr.open(method, url, true);
        xhr.responseType = options.response_type || 'text';
        xhr.timeout = is_defined(options.timeout) ? options.timeout :
            DEFAULT_TIMEOUT;

        if (options.headers) {
            for (var name in options.headers) {
                xhr.setRequestHeader(name, options.headers[name]);
            }
        }

        xhr.send();

        xhr.onload = function() {
            if (this.status >= 200 && this.status < 300) {
                resolve(this);
            }
            else {
                reject(this);
            }
        };

        xhr.onerror = function() {
            reject(this);
        };

    });
}

function DaapData(options) {
    this.offset = is_defined(options.offset) ? options.offset : 0;
    if (this.isValid()) {
        this.content_codes = is_defined(options.content_codes) ?
            options.content_codes : DEFAULT_CONTENT_CODES;

        this.view = options.view ? options.view :
            new DataView(options.buffer);
        this.data_offset = this.offset + HEADER_LENGTH;
        this.length = this.view.getUint32(this.offset + NAME_LENGTH);
        var buf = new Uint8Array(this.view.buffer, this.offset,
                NAME_LENGTH);
        this.name = decode_ascii(buf);
        this.children = {};
        this.last_offset = this.offset + HEADER_LENGTH;
    }
    else {
        this.length = 0;
        this.last_offset = INVALID_OFFSET;
    }
}

DaapData.prototype.find = function(name) {
    if (name in this.children) {
        // tag is in cache
        return this.children[name];
    }

    var tag = this.next(this.last_offset);

    while (tag.isValid() && tag.name !== name) {
        this.children[tag.name] = tag;
        this.last_offset = this.last_offset + HEADER_LENGTH + tag.length;
        tag = this.next(this.last_offset);
    }

    if (tag.isValid()) {
        // add found valid tag to cache
        this.children[tag.name] = tag;
    }
    return tag;
};

DaapData.prototype.get = function(name) {
    var func = this.content_codes[name];
    if (!is_defined(func)) {
        throw new Error('Unknown content code ' + name);
    }
    if (func === null) {
        return this.find(name);
    }
    return func.call(this.find(name));
};

DaapData.prototype.isValid = function() {
    return this.offset >= 0;
};

DaapData.prototype.next = function(offset) {
    if (!this.isValid()) {
        return new DaapData({offset: INVALID_OFFSET});
    }
    if (!is_defined(offset)) {
        offset = this.offset + HEADER_LENGTH + this.length;
    }
    if (offset >= this.getMaxLength()) {
        return new DaapData({offset: INVALID_OFFSET});
    }
    return new DaapData({
        view: this.view,
        offset: offset,
        content_codes: this.content_codes
    });
};

DaapData.prototype.getMaxLength = function() {
    return this.isValid() ? this.view.byteLength : -1;
};

DaapData.prototype.getUInt8 = function() {
    return this.isValid() ? this.view.getUint8(this.data_offset) : null;
};

DaapData.prototype.getInt8 = function() {
    return this.isValid() ? this.view.getInt8(this.data_offset) : null;
};

DaapData.prototype.getUInt16 = function() {
    return this.isValid() ? this.view.getUint16(this.data_offset) : null;
};

DaapData.prototype.getInt16 = function() {
    return this.isValid() ? this.view.getInt16(this.data_offset) : null;
};

DaapData.prototype.getUInt32 = function() {
    return this.isValid() ? this.view.getUint32(this.data_offset) : null;
};

DaapData.prototype.getInt32 = function() {
    return this.isValid() ? this.view.getInt32(this.data_offset) : null;
};

/**
    * FIXME
    *
    * JavaScript has no long (64 Bit integer) value. Therefore currently read
    * only the lower 32 Bit
    */
DaapData.prototype.getInt64 = function() {
    return this.isValid() ? this.view.getUint32(this.data_offset + 4) :
        null;
};

DaapData.prototype.getUInt64 = DaapData.prototype.getInt64;

DaapData.prototype.getVersion = function() {
    if (this.isValid()) {
        var version = new Uint8Array(this.view.buffer, this.data_offset,
                this.length);
        return version.join('.');
    }
    return null;
};

DaapData.prototype.getString = function(decode_func) {
    if (this.isValid()) {
        if (!is_defined(decode_func)) {
            decode_func = decode_utf8;
        }
        var buf = new Uint8Array(this.view.buffer, this.data_offset,
                this.length);
        return decode_func(buf);
    }
    return null;
};

DaapData.prototype.getBoolean = function() {
    return this.isValid() ? this.view.getUint8(this.data_offset) === 1 :
        null;
};

var CONTENT_TYPES = {
    1: DaapData.prototype.getInt8,     // byte
    2: DaapData.prototype.getUInt8,    // unsigned byte
    3: DaapData.prototype.getInt16,    // short
    4: DaapData.prototype.getUInt16,   // unsigned short
    5: DaapData.prototype.getInt32,    // int
    6: DaapData.prototype.getUInt32,   // unsigned int
    7: DaapData.prototype.getInt64,    // long
    8: DaapData.prototype.getUInt64,   // unsinged long
    9: DaapData.prototype.getString,   // utf-8 string
    10: DaapData.prototype.getUInt32,  // 4 byte int as seconds since 1.1.1970 (UNIX timestamp)
    11: DaapData.prototype.getVersion, // represented as 4 single bytes, e.g. 0.1.0.0
    12: null,                          // list
};

var DEFAULT_CONTENT_CODES = {
    apro: DaapData.prototype.getVersion, // daap.protocolversion
    mpro: DaapData.prototype.getVersion, // dmap.protocolversion
    mlid: DaapData.prototype.getInt32,   // dmap.sessionid
    mstm: DaapData.prototype.getInt32,   // dmap.timeoutinterval
    msdc: DaapData.prototype.getInt32,   // dmap.databasescount
    mslr: DaapData.prototype.getInt8,    // dmap.loginrequired (1 or 0)
    musr: DaapData.prototype.getInt32,   // server revision
    miid: DaapData.prototype.getInt32,   // dmap.itemid
    minm: DaapData.prototype.getString,  // dmap.itemname
    mimc: DaapData.prototype.getInt32,   // dmap.itemcount
    mctc: DaapData.prototype.getInt32,   // number of playlists in db
    asfm: DaapData.prototype.getString,  // daap.songformat
    asul: DaapData.prototype.getString,  // daap.songdataurl
    asal: DaapData.prototype.getString,  // daap.songalbum
    asar: DaapData.prototype.getString,  // daap.songartist
    asco: DaapData.prototype.getInt8,    // daap.songcompilation
    asgn: DaapData.prototype.getString,  // daap.songgenre
    asdt: DaapData.prototype.getString,  // daap.songdescription
    ascm: DaapData.prototype.getString,  // daap.songcomment
    asdn: DaapData.prototype.getInt16,   // daap.songdiscnumber
    asdc: DaapData.prototype.getInt16,   // daap.songdisccount
    astn: DaapData.prototype.getInt16,   // daap.songtracknumber
    astc: DaapData.prototype.getInt16,   // daap.songtrackcount
    asbr: DaapData.prototype.getInt16,   // daap.songbitrate
    assz: DaapData.prototype.getInt32,   // daap.songsize
    asyr: DaapData.prototype.getInt16,   // daap.songyear
    astm: DaapData.prototype.getInt32,   // daap.songtime (in ms)
    mper: DaapData.prototype.getInt64,   // dmap.persistentid
    mpco: DaapData.prototype.getInt32,   // dmap.parentcontainerid
    abpl: DaapData.prototype.getInt8,    // daap.baseplaylist (1 or 0)
    aeSP: DaapData.prototype.getInt8,    // com.apple.itunes.smart-playlist (1 or 0)
    aePS: DaapData.prototype.getInt8,    // com.apple.itunes.special-playlist (1 or 0)
    mcnm: DaapData.prototype.getString,  // dmap.contentcodesnumber the 4 byte codename
    mcna: DaapData.prototype.getString,  // dmap.contentcodesname the full name of the code
    mcty: DaapData.prototype.getInt16,   // dmap.contentcodestype the type of the code
    mlcl: null,                          // dmap.listing
    mdcl: null,                          // dmap.dictionary
};

function Daap(options) {
    options = options || {};
    this.status = Daap.Status.Disconnected;
    this.content_codes = DEFAULT_CONTENT_CODES;
    this.setServer(options.server, options.port);
    this.setPassword(options.password);
}

Daap.Promise = Promise;

Daap.Status = {
    Disconnected: 1,
    Connecting: 2,
    Connected: 3,
    HasSession: 4,
    HasRevision: 5,
    Error: -1,
};

Daap.prototype.login = function(password) {
    var self = this;
    var url = this.url + LOGIN_URL;

    if (is_defined(password)) {
        this.setPassword(password);
    }

    return this._checkStatus([Daap.Status.Disconnected, Daap.Status.Error],
            'Invalid status ' + this.status + ' for connect')
        .then(function() {
            return self._request(url);
        }).then(function(data) {
            self.status = Daap.Status.Connected;
            self.session_id = data.get('mlid');
            self.status = Daap.Status.HasSession;
            return self.update();
        });
};

Daap.prototype.logout = function() {
    if (this.status === Daap.Status.Disconnected) {
        return Daap.Promise.resolve();
    }

    var self = this;
    var url = this.url + LOGOUT_URL + '?session-id=' + this.session_id;

    return this._request(url).then(function(data) {
        self.status = Daap.Status.Disconnected;
        return data;
    });
};

Daap.prototype.update = function() {
    var self = this;
    var url = this.url + UPDATE_URL + '?session-id=' + this.session_id;

    return this._checkStatus([Daap.Status.HasSession], 'Invalid status ' +
        self.status + ' for update').then(function() {
            return self._request(url);
        }).then(function(data) {
            self.revision_id = data.get('musr');
            self.status = Daap.Status.HasRevision;
            return;
        });
};

Daap.prototype.databases = function() {
    var self = this;
    var url = this.url + DATABASES_URL + '?session-id=' + this.session_id +
        '&revision-id=' + this.revision_id;

    return this._checkStatus([Daap.Status.HasRevision], 'Invalid status ' +
        self.status + ' for databases').then(function() {
            return self._request(url);
        }).then(function(data) {
            var results = [];
            var databases = data.find('mlcl');

            var db = databases.find('mlit');
            while (db.isValid()) {
                results.push({
                    id: db.get('miid'),
                    name: db.get('minm'),
                    item_count: db.get('mimc'),
                    playlist_count: db.get('mctc'),
                });
                db = db.next();
            }

            return results;
        });
};

Daap.prototype.items = function(options) {
    options = options || {};

    var db_id = is_defined(options.db_id) ? options.db_id : 1;

    var fields = [
        'dmap.itemid',
        'dmap.itemname',
        'daap.songalbum',
        'daap.songartist',
        'daap.songbitrate',
        'daap.songcomment',
        'daap.songcompilation',
        'daap.songcomposer',
        'daap.songdataurl',
        'daap.songdateadded',
        'daap.songdatemodified',
        'daap.songdescription',
        'daap.songdisccount',
        'daap.songdiscnumber',
        'daap.songformat',
        'daap.songgenre',
        'daap.songsize',
        'daap.songtime',
        'daap.songtracknumber',
        'daap.songtrackcount',
        'daap.songyear',
    ];

    var self = this;
    var url = this.url + DATABASES_URL + '/' + db_id + '/' + ITEMS_URL +
        '?session-id=' + this.session_id + '&revision-id=' +
        this.revision_id + '&meta=' + fields.join();

    return this._checkStatus([Daap.Status.HasRevision], 'Invalid status ' +
        self.status + ' for items').then(function() {
            return self._request(url);
        }).then(function(data) {
            var items = data.find('mlcl');
            self._song = items.find('mlit');
            self._db_id = db_id;
            return self.nextItems(options.max);
        });
};

Daap.prototype.nextItems = function(max) {
    var self = this;
    var results = [];

    for (var i = 0; is_defined(self._song) && self._song.isValid() &&
            (!is_defined(max) || i < max); i++) {
        results.push(self._convertSong(self._song, self._db_id));
        self._song = self._song.next();
    }

    return Daap.Promise.resolve(results);
};

Daap.prototype._convertSong = function(song, db_id) {
    var id = song.get('miid');
    var format = song.get('asfm');
    var stream = this.url + 'databases/' + db_id + '/items/' + id +
        '.' + format + '?session-id=' + this.session_id;
    return {
        id: id,
        name: song.get('minm'),
        url: song.get('asul'),
        album: song.get('asal'),
        artist: song.get('asar'),
        compilation: song.get('asco'),
        genre: song.get('asgn'),
        description: song.get('asdt'),
        comment: song.get('ascm'),
        disc_nr: song.get('asdn'),
        disc_count: song.get('asdc'),
        track_nr: song.get('astn'),
        track_count: song.get('astc'),
        format: format,
        bitrate: song.get('asbr'),
        size: song.get('assz'),
        year: song.get('asyr'),
        duration: song.get('astm'),
        stream_url: stream,
    };
};

Daap.prototype.playlists = function(db_id) {
    if (!is_defined(db_id)) {
        db_id = 1;
    }

    var fields = [
        'dmap.itemid',
        'dmap.itemname',
        'dmap.itemcount',
        'dmap.persistentid',
        'dmap.parentcontainerid',
        'dmap.editc',
        'daap.baseplaylist',
        'com.apple.itunes.special-playlist',
        'com.apple.itunes.smart-playlist',
    ];

    var self = this;
    var url = this.url + DATABASES_URL + '/' + db_id + '/' + PLAYLISTS_URL +
        '?session-id=' + this.session_id + '&revision-id=' +
        this.revision_id + '&meta=' + fields.join();

    return this._checkStatus([Daap.Status.HasRevision], 'Invalid status ' +
        self.status + ' for playlists').then(function() {
            return self._request(url);
        }).then(function(data) {
            var results = [];
            var items = data.find('mlcl');
            var list = items.find('mlit');
            while (list.isValid()) {
                results.push(self._convertPlayList(list, db_id));
                list = list.next();
            }
            return results;
        });
};

Daap.prototype._convertPlayList = function(list) {
    return {
        id: list.get('miid'),
        persistent_id: list.get('mper'),
        parent_id: list.get('mpco'),
        name: list.get('minm'),
        item_count: list.get('mimc'),
        base_playlist: list.get('abpl'),
        smart_playlist: list.get('aeSP'),
        special_playlist: list.get('aePS'),
    };
};

Daap.prototype.serverinfo = function() {
    var url = this.url + SERVER_INFO_URL;

    return this._request(url).then(function(data) {
        return {
            daap_version: data.get('apro'),
            damp_version: data.get('mpro'),
            name: data.get('minm'),
            timeout: data.get('mstm'),
            database_count: data.get('msdc'),
            login_required: data.get('mslr'),
        };
    });
};

Daap.prototype.updateContentCodes = function() {
    var self = this;
    var url = this.url + CONTENT_CODES_URL;

    return this._request(url).then(function(data) {
        var entry = data.find('mdcl');
        if (entry.isValid()) {
            var content_codes = {};

            while (entry.isValid()) {
                content_codes[entry.get('mcnm')] =
                    CONTENT_TYPES[entry.get('mcty')];
                entry = entry.next();
            }
            self.content_codes = content_codes;
        }
    });
};

Daap.prototype.setPassword = function(password) {
    if (is_defined(password)) {
        /* username is ignored by daap implementations */
        this.password = global.btoa('admin:' + password);
    }
    else {
        this.password = undefined;
    }
    return this;
};

Daap.prototype.setServer = function(server, port) {
    if (is_defined(server)) {
        this.server = server;
    }
    else {
        this.server = DEFAULT_SERVER;
    }

    if (is_defined(port)) {
        this.port = port;
    }
    else {
        this.port = DEFAULT_PORT;
    }
    this._setUrl();
    return this;
};

Daap.prototype._getHttpOptions = function() {
    var options = {};
    options.headers = {};

    if (is_defined(this.password)) {
        options.headers.Authorization = 'Basic ' + this.password;
    }

    options.response_type = 'arraybuffer';
    return options;
};

Daap.prototype._setUrl = function() {
    this.url = 'http://' + this.server + ':' + this.port + '/';
};

Daap.prototype._newData = function(xhr) {
    return new DaapData({
        buffer: xhr.response,
        content_codes: this.content_codes,
    });
};

Daap.prototype._checkStatus = function(status, message) {
    var self = this;
    return new Daap.Promise(function(resolve, reject) {
        if (status.indexOf(self.status) === -1) { // not in array
            reject(new Error(message));
        }
        resolve();
    });
};

Daap.prototype._request = function(url) {
    var self = this;
    return request(url, this._getHttpOptions()).then(function(xhr) {
        var data = self._newData(xhr);
        if (!data.isValid()) {
            self.status = Daap.Status.Error;
            throw new Error('Invalid data in response');
        }
        return data;
    }, function(xhr) {
        self.status = Daap.Status.Error;
        throw new Error(xhr);
    });
};

module.exports.Daap = Daap;

// vim: set ts=4 sw=4 tw=80:
