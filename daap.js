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

    var DEFAULT_SERVER = '127.0.0.1';
    var DEFAULT_PORT = 3689;

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
        if (!is_defined(offset)) {
            offset = this.offset + HEADER_LENGTH + this.length;
        }
        if (offset >= this.getMaxLength()) {
            return new DaapData({offset: INVALID_OFFSET});
        }
        return new DaapData({view: this.view, offset: offset});
    };

    DaapData.prototype.getMaxLength = function() {
        return this.isValid() ? this.view.byteLength : -1;
    };

    DaapData.prototype.getUInt8 = function() {
        if (this.isValid()) {
            return this.view.getUint8(this.data_offset);
        }
        return null;
    };

    DaapData.prototype.getUInt16 = function() {
        if (this.isValid()) {
            return this.view.getUint16(this.data_offset);
        }
        return null;
    };

    DaapData.prototype.getUInt32 = function() {
        if (this.isValid()) {
            return this.view.getUint32(this.data_offset);
        }
        return null;
    };

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
        if (this.isValid()) {
            return this.view.getUint8(this.data_offset) === 1;
        }
        return null;
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
                                song_count: db.find('mimc').getUInt32(),
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
                        var i = 0;
                        while (song.isValid()) {
                            results.push(self._convertSong(song));
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

    Daap.prototype._convertSong = function(song) {
        return {
            id: song.find('miid').getUInt32(),
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
            format: song.find('asfm').getString(),
            bitrate: song.find('asbr').getUInt16(),
            size: song.find('assz').getUInt32(),
            year: song.find('asyr').getUInt16(),
            duration: song.find('astm').getUInt32(), // daap.songtime in ms
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
