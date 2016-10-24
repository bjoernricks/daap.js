/*
/* (c) 2016 Björn Ricks <bjoern.ricks@gmail.com>
/*
/* See LICENSE comming with the source of daap.js for details.
*/

import {includes, is_defined} from './utils.js';
import {Data, DEFAULT_CONTENT_CODES, CONTENT_TYPES} from './data.js';
import request from './request.js';
import List from './list.js';
import Song from ',/song.js';
import Database from './database.js';

const LOGIN_URL = 'login';
const LOGOUT_URL = 'logout';
const UPDATE_URL = 'update';
const SERVER_INFO_URL = 'server-info';
const DATABASES_URL = 'databases';
const ITEMS_URL = 'items';
const PLAYLISTS_URL = 'containers';
const CONTENT_CODES_URL = 'content-codes';

const DEFAULT_SERVER = '127.0.0.1';
const DEFAULT_PORT = 3689;

const SORT = ['name', 'album', 'artist', 'releasedate'];

function convert_playlist(list) {
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
}

export class Daap {

    constructor(options = {}) {
        let {server, port, password} = options;
        this.status = Daap.Status.Disconnected;
        this.content_codes = DEFAULT_CONTENT_CODES;
        this.setServer(server, port);
        this.setPassword(password);
    }

    setPassword(password) {
        if (is_defined(password)) {
            /* username is ignored by daap implementations */
            this.password = btoa('admin:' + password);
        }
        else {
            this.password = undefined;
        }
        return this;
    }

    setServer(server, port) {
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
        this.url = 'http://' + this.server + ':' + this.port + '/';
        return this;
    }

    login(password) {
        let url = this.url + LOGIN_URL;

        if (is_defined(password)) {
            this.setPassword(password);
        }

        return this._checkStatus([Daap.Status.Disconnected, Daap.Status.Error],
            'Invalid status ' + this.status + ' for login')
            .then(() => this._request(url))
            .then(data => {
                this.status = Daap.Status.Connected;
                this.session_id = data.get('mlid');
                this.status = Daap.Status.HasSession;
                return this.update();
            });
    }

    logout() {
        if (this.status === Daap.Status.Disconnected) {
            return Daap.Promise.resolve();
        }

        let url = this.url + LOGOUT_URL + '?session-id=' + this.session_id;

        return this._request(url).then(data => {
            this.status = Daap.Status.Disconnected;
            return data;
        });
    }

    update() {
        let url = this.url + UPDATE_URL + '?session-id=' + this.session_id;

        return this._checkStatus([Daap.Status.HasSession], 'Invalid status ' +
            this.status + ' for update')
            .then(() => this._request(url))
            .then(data => {
                this.revision_id = data.get('musr');
                this.status = Daap.Status.HasRevision;
            });
    }

    databases() {
        let url = this.url + DATABASES_URL + '?session-id=' + this.session_id +
            '&revision-id=' + this.revision_id;

        return this._checkStatus([Daap.Status.HasRevision], 'Invalid status ' +
            this.status + ' for databases')
            .then(() => this._request(url))
            .then(data => {
                return new List(Database, data);
            });
    }

    items({db_id = 1, sort}) {
        let fields = [
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

        let url = this.url + DATABASES_URL + '/' + db_id + '/' + ITEMS_URL +
            '?session-id=' + this.session_id + '&revision-id=' +
            this.revision_id + '&meta=' + fields.join();

        if (is_defined(sort)) {
            if (includes(SORT, sort)) {
                url = url + '&sort=' + sort;
            }
        }

        return this._checkStatus([Daap.Status.HasRevision], 'Invalid status ' +
            this.status + ' for items')
            .then(() => this._request(url))
            .then(data => {
                return new List(Song, data, db_id, this.session_id, this.url);
            });
    }

    playlists(db_id = 1) {
        const fields = [
            'dmap.itemid',
            'dmap.itemname',
            'dmap.itemcount',
            'dmap.persistentid',
            'dmap.parentcontainerid',
            'daap.baseplaylist',
            'com.apple.itunes.special-playlist',
            'com.apple.itunes.smart-playlist',
        ];

        let url = this.url + DATABASES_URL + '/' + db_id + '/' + PLAYLISTS_URL +
            '?session-id=' + this.session_id + '&revision-id=' +
            this.revision_id + '&meta=' + fields.join();

        return this._checkStatus([Daap.Status.HasRevision], 'Invalid status ' +
            this.status + ' for playlists')
            .then(() => this._request(url))
            .then(data => {
                let results = [];
                let items = data.find('mlcl');
                let list = items.find('mlit');
                while (list.isValid()) {
                    results.push(convert_playlist(list, db_id));
                    list = list.next();
                }
                return results;
            });
    }

    serverinfo() {
        let url = this.url + SERVER_INFO_URL;

        return this._request(url)
            .then(data => {
                return {
                    daap_version: data.get('apro'),
                    damp_version: data.get('mpro'),
                    name: data.get('minm'),
                    timeout: data.get('mstm'),
                    database_count: data.get('msdc'),
                    login_required: data.get('mslr'),
                };
            });
    }

    updateContentCodes() {
        var url = this.url + CONTENT_CODES_URL;

        return this._request(url)
            .then(data => {
                let entry = data.find('mdcl');
                if (entry.isValid()) {
                    var content_codes = {};

                    while (entry.isValid()) {
                        content_codes[entry.get('mcnm')] =
                            CONTENT_TYPES[entry.get('mcty')];
                        entry = entry.next();
                    }
                    this.content_codes = content_codes;
                }
            });
    }

    _getHttpOptions() {
        var options = {};
        options.headers = {
            Accept: 'application/x-dmap-tagged',
        };

        if (is_defined(this.password)) {
            options.headers.Authorization = 'Basic ' + this.password;
        }

        options.response_type = 'arraybuffer';
        return options;
    }

    _newData(xhr) {
        return new Data({
            buffer: xhr.response,
            content_codes: this.content_codes,
        });
    }

    _checkStatus(status, message) {
        return new Daap.Promise((resolve, reject) => {
            if (includes(status, this.status)) {
                resolve();
                return;
            }
            reject(new Error(message));
        });
    }

    _request(url) {
        return request(url, this._getHttpOptions(), Daap.Promise)
            .then(xhr => {
                var data = this._newData(xhr);
                if (!data.isValid()) {
                    this.status = Daap.Status.Error;
                    throw new Error('Invalid data in response');
                }
                return data;
            }, xhr => {
                this.status = Daap.Status.Error;
                var error = new Error('Requesting ' + url + ' failed');
                error.name = 'RequestError';
                if (xhr instanceof XMLHttpRequest) {
                    error.xhr = xhr;
                }
                throw error;
            });
    }
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


export default Daap;

// vim: set ts=4 sw=4 tw=80:
