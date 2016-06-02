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

    var DEFAULT_SERVER = '127.0.0.1';
    var DEFAULT_PORT = 3689;

    var NAME_LENGTH = 4;
    var SIZE_LENGTH = 4;
    var HEADER_LENGTH = NAME_LENGTH + SIZE_LENGTH;

    function decode_utf8(utftext) {
        var plaintext = '';
        var i = 0;
        var c = 0;
        var c1 = 0;
        var c2 = 0;

        while (i < utftext.length) {
            c = utftext[i];
            if (c < 128) {
                plaintext += String.fromCharCode(c);
                i++;
            }
            else if ((c > 191) && (c < 224)) {
                c1 = utftext[i + 1];
                plaintext += String.fromCharCode(((c & 31) << 6) | (c1 & 63));
                i += 2;
            }
            else {
                c1 = utftext[i + 1];
                c2 = utftext[i + 2];
                plaintext += String.fromCharCode(
                        ((c & 15) << 12) | ((c1 & 63) << 6) | (c2 & 63));
                i += 3;
            }
        }
        return plaintext;
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
            this.name = String.fromCharCode.apply(null, buf);
        }
        else {
            this.size = 0;
        }
    }

    DaapData.prototype.find = function(name) {
        var offset = this.offset + HEADER_LENGTH;
        var tag = this.next(offset);
        while (tag.isValid() && tag.name !== name) {
            offset = offset + HEADER_LENGTH + tag.length;
            tag = this.next(offset);
        }
        return tag;
    };

    DaapData.prototype.isValid = function() {
        return this.offset >= 0;
    };

    DaapData.prototype.next = function(offset) {
        if (!this.isValid() || offset >= this.getMaxLength()) {
            return new DaapData({view: this.view, offset: -1});
        }
        return new DaapData({view: this.view, offset: offset});
    };

    DaapData.prototype.getMaxLength = function() {
        if (this.isValid()) {
            return this.view.byteLength;
        }
        return -1;
    };

    DaapData.prototype.getUInt8 = function() {
        if (this.isValid()) {
            return this.view.getUint8(this.data_offset);
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

    DaapData.prototype.getString = function() {
        if (this.isValid()) {
            var buf = new Uint8Array(this.view.buffer, this.data_offset,
                    this.length);
            return decode_utf8(buf);
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
        this.setServer(options.server, options.port);
        this.setPassword(options.password);
    }

    Daap.Promise = promise;

    Daap.Status = {
        Disconnected: 1,
        Connecting: 2,
        Connected: 3,
        Error: 4,
    };

    Daap.prototype.connect = function() {
        var self = this;
        var url = this.url + LOGIN_URL;
        var options = this._getHttpOptions();

        this.status = Daap.Status.Connecting;

        var promise = new Daap.Promise(function(resolve, reject) {

            if (self.status !== Daap.Status.Disconnected &&
                    self.status !== Daap.Status.Error) {
                reject();
                return;
            }

            request(url, options).then(
                function(xhr) {
                    self.status = Daap.Status.Connected;
                    var data = new DaapData({buffer: xhr.response})
                        .find('mlid');
                    if (!data.isValid()) {
                        self.status = Daap.Status.Error;
                        reject(xhr);
                    }
                    else {
                        self.session_id = data.getUInt32();
                        return self.update();
                    }
                }, function(xhr) {
                    self.status = Daap.Status.Error;
                    reject(xhr);
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

            if (self.status !== Daap.Status.Connected) {
                reject();
                return;
            }

            request(url, options).then(
                function(xhr) {
                    var data = new DaapData({buffer: xhr.response})
                        .find('musr');
                    if (!data.isValid()) {
                        self.status = Daap.Status.Error;
                        reject(xhr);
                    }
                    else {
                        self.revision_id = data.getUInt32();
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
