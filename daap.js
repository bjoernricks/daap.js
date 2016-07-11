/*
/* (c) 2016 Björn Ricks <bjoern.ricks@gmail.com>
/*
/* See LICENSE comming with the source of daap.js for details.
*/

(function(global, promise) {
    'use strict';

    var LOGIN_URL = 'login';
    var UPDATE_URL = 'update';
    var SERVER_INFO_URL = 'server-info';
    var DATABASES_URL = 'databases';
    var ITEMS_URL = 'items';
    var PLAYLISTS_URL = 'containers';

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
     * only to lower 32 Bit
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
        mslr: DaapData.prototype.getBoolean, // dmap.loginrequired
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
        abpl: DaapData.prototype.getBoolean, // daap.baseplaylist
        aeSP: DaapData.prototype.getBoolean, // com.apple.itunes.smart-playlist
        aePS: DaapData.prototype.getBoolean, // com.apple.itunes.special-playlist
        mcnm: DaapData.prototype.getString,  // dmap.contentcodesnumber the 4 byte codename
        mcna: DaapData.prototype.getString,  // dmap.contentcodesname the full name of the code
        mcty: DaapData.prototype.getInt16,   // dmap.contentcodestype the type of the code
        mlcl: null,                          // dmap.listing
        mdcl: null,                          // dmap.dictionary
    };

    function Daap(options) {
        options = options || {};
        this.status = Daap.Status.Disconnected;
        this.setServer(options.server, options.port);
        this.setPassword(options.password);
    }

    Daap.Promise = promise;

    Daap.Status = {
        Disconnected: 1,
        Connecting: 2,
        Connected: 3,
        HasSession: 4,
        HasRevision: 5,
        Error: -1,
    };

    Daap.prototype.connect = function() {
        var self = this;
        var url = this.url + LOGIN_URL;
        var options = this._getHttpOptions();

        var promise = new Daap.Promise(function(resolve, reject) {

            if (self.status !== Daap.Status.Disconnected &&
                    self.status !== Daap.Status.Error) {
                reject(new Error('Invalid status ' + self.status +
                            ' for connect'));
                return;
            }

            self.status = Daap.Status.Connecting;

            request(url, options).then(
                function(xhr) {
                    self.status = Daap.Status.Connected;
                    var data = new DaapData({buffer: xhr.response})
                        .find('mlid');
                    if (!data.isValid()) {
                        self.status = Daap.Status.Error;
                        reject(new Error('Could not extract session id from ' +
                                    'DAAP response'));
                    }
                    else {
                        self.session_id = data.getUInt32();
                        self.status = Daap.Status.HasSession;
                        return self.update();
                    }
                }, function(xhr) {
                    self.status = Daap.Status.Error;
                    reject(new Error(xhr.statusText));
                }
            ).then(function() {
                resolve();
            });
        });
        return promise;
    };

    Daap.prototype.update = function() {
        var self = this;
        var url = this.url + UPDATE_URL + '?session-id=' + this.session_id;
        var options = this._getHttpOptions();

        var promise = new Daap.Promise(function(resolve, reject) {

            if (self.status !== Daap.Status.HasSession) {
                reject(new Error('Invalid status ' + self.status +
                            ' for update'));
                return;
            }

            request(url, options).then(
                function(xhr) {
                    var data = new DaapData({buffer: xhr.response})
                        .find('musr');
                    if (!data.isValid()) {
                        self.status = Daap.Status.Error;
                        reject(new Error('Could not extract revision id from ' +
                                    'DAAP response'));
                    }
                    else {
                        self.revision_id = data.getUInt32();
                        self.status = Daap.Status.HasRevision;
                        resolve();
                    }
                }, function(xhr) {
                    self.status = Daap.Status.Error;
                    reject(xhr);
                }
            );
        });
        return promise;
    };

    Daap.prototype.databases = function() {
        var self = this;
        var url = this.url + DATABASES_URL + '?session-id=' + this.session_id +
            '&revision-id=' + this.revision_id;
        var options = this._getHttpOptions();

        var promise = new Daap.Promise(function(resolve, reject) {
            if (self.status !== Daap.Status.HasRevision) {
                reject(new Error('Invalid status ' + self.status +
                            ' for databases'));
                return;
            }
            request(url, options).then(
                function(xhr) {
                    var data = new DaapData({buffer: xhr.response});
                    if (!data.isValid()) {
                        self.status = Daap.Status.Error;
                        reject(new Error('Could not find database data'));
                    }
                    else {
                        var results = [];
                        var databases = data.find('mlcl');

                        var db = databases.find('mlit');
                        while (db.isValid()) {
                            results.push({
                                id: db.find('miid').getUInt32(),
                                name: db.find('minm').getString(),
                                item_count: db.find('mimc').getUInt32(),
                                playlist_count: db.find('mctc').getUInt32(),
                            });
                            db = db.next();
                        }

                        resolve(results);
                    }
                }, function(xhr) {
                    self.status = Daap.Status.Error;
                    reject(new Error(xhr));
                }
            );
        });
        return promise;
    };

    Daap.prototype.items = function(db_id) {
        if (!is_defined(db_id)) {
            db_id = 1;
        }

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
        var options = this._getHttpOptions();

        var promise = new Daap.Promise(function(resolve, reject) {
            if (self.status !== Daap.Status.HasRevision) {
                reject(new Error('Invalid status ' + self.status +
                            ' for items'));
                return;
            }
            request(url, options).then(
                function(xhr) {
                    var data = new DaapData({buffer: xhr.response});
                    if (!data.isValid()) {
                        self.status = Daap.Status.Error;
                        reject(new Error('Could not find items data'));
                    }
                    else {
                        var results = [];
                        var items = data.find('mlcl');
                        var song = items.find('mlit');
                        while (song.isValid()) {
                            results.push(self._convertSong(song, db_id));
                            song = song.next();
                        }
                        resolve(results);
                    }
                }, function(xhr) {
                    self.status = Daap.Status.Error;
                    reject(new Error(xhr));
                }
            );
        });
        return promise;
    };

    Daap.prototype._convertSong = function(song, db_id) {
        var id = song.find('miid').getUInt32();
        var format = song.find('asfm').getString();
        var stream = this.url + 'databases/' + db_id + '/items/' + id +
            '.' + format + '?session-id=' + this.session_id;
        return {
            id: id,
            url: song.find('asul').getString(),
            album: song.find('asal').getString(),
            artist: song.find('asar').getString(),
            compilation: song.find('asco').getUInt8(),
            genre: song.find('asgn').getString(),
            description: song.find('asdt').getString(),
            comment: song.find('ascm').getString(),
            disc_nr: song.find('asdn').getUInt16(),
            disc_count: song.find('asdc').getUInt16(),
            track_nr: song.find('astn').getUInt16(),
            track_count: song.find('astc').getUInt16(),
            format: format,
            bitrate: song.find('asbr').getUInt16(),
            size: song.find('assz').getUInt32(),
            year: song.find('asyr').getUInt16(),
            duration: song.find('astm').getUInt32(), // daap.songtime in ms
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
        var options = this._getHttpOptions();

        var promise = new Daap.Promise(function(resolve, reject) {
            if (self.status !== Daap.Status.HasRevision) {
                reject(new Error('Invalid status ' + self.status +
                            ' for playlists'));
                return;
            }
            request(url, options).then(
                function(xhr) {
                    var data = new DaapData({buffer: xhr.response});
                    if (!data.isValid()) {
                        self.status = Daap.Status.Error;
                        reject(new Error('Could not find playlists data'));
                    }
                    else {
                        var results = [];
                        var items = data.find('mlcl');
                        var list = items.find('mlit');
                        while (list.isValid()) {
                            results.push(self._convertPlayList(list, db_id));
                            list = list.next();
                        }
                        resolve(results);
                    }
                }, function(xhr) {
                    self.status = Daap.Status.Error;
                    reject(new Error(xhr));
                }
            );
        });
        return promise;
    };

    Daap.prototype._convertPlayList = function(list, db_id) {
        return {
            id: list.find('miid').getUInt32(),
            persistent_id: list.find('mper').getInt64(),
            parent_id: list.find('mpco').getUInt32(),
            name: list.find('minm').getString(),
            item_count: list.find('mimc').getUInt32(),
            base_playlist: list.find('abpl').getBoolean(),
            smart_playlist: list.find('aeSP').getBoolean(),
            special_playlist: list.find('aePS').getBoolean(),
        };
    };

    Daap.prototype.serverinfo = function() {
        var self = this;
        var url = this.url + SERVER_INFO_URL;
        var options = this._getHttpOptions();

        var promise = new Daap.Promise(function(resolve, reject) {
            request(url, options).then(function(xhr) {
                var data = new DaapData({buffer: xhr.response});
                resolve({
                    daap_version: data.find('apro').getVersion(),
                    damp_version: data.find('mpro').getVersion(),
                    name: data.find('minm').getString(),
                    timeout: data.find('mstm').getUInt32(),
                    database_count: data.find('msdc').getUInt32(),
                    login_required: data.find('mslr').getBoolean(),
                });
            });
        });
        return promise;
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

    global.Daap = Daap;
})(window, Promise);
