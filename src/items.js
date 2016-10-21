/*
/* (c) 2016 Björn Ricks <bjoern.ricks@gmail.com>
/*
/* See LICENSE comming with the source of daap.js for details.
*/

import {is_defined} from './utils.js';

export class Song {

    constructor(data, db_id, session_id, url) {
        this._data = data;
        this._db_id = db_id;
        this._session_id = session_id;
        this._url = url;
    }

    get(name) {
        return this._data.get(name);
    }

    get id() {
        return this.get('miid');
    }

    get format() {
        return this.get('asfm');
    }

    get streamUrl() {
        return this._url + 'databases/' + this._db_id + '/items/' + this.id +
            '.' + this.format + '?session-id=' + this._session_id;
    }

    get name() {
        return this.get('minm');
    }

    get url() {
        return this.get('asul');
    }

    get album() {
        return this.get('asal');
    }

    get artist() {
        return this.get('asar');
    }

    get compilation() {
        return this.get('asco');
    }

    get genre() {
        return this.get('asgn');
    }

    get description() {
        return this.get('asdt');
    }

    get discNr() {
        return this.get('asdn');
    }

    get discCount() {
        return this.get('asdc');
    }

    get trackNr() {
        return this.get('astn');
    }

    get trackCount() {
        return this.get('astc');
    }

    get bitrate() {
        return this.get('asbr');
    }

    get size() {
        return this.get('assz');
    }

    get year() {
        return this.get('asyr');
    }

    get duration() {
        return this.get('astm');
    }
}

export class Items {

    constructor(data, db_id, session_id, url) {
        this._data = data;
        this._db_id = db_id;
        this._session_id = session_id;
        this._url = url;
        let items = data.find('mlcl');
        this._song = items.find('mlit');
        this._length = data.get('mrco');
    }

    get length() {
        return this._length;
    }

    get(max) {
        let results = [];

        for (let i = 0; is_defined(this._song) && this._song.isValid() &&
                (!is_defined(max) || i < max); i++) {
            results.push(new Song(this._song, this._db_id, this._session_id,
                this._url));
            this._song = this._song.next();
        }

        return results;
    }

    [Symbol.iterator]() {
        return this;
    }

    next() {
        let song = this._song;
        let has_song = is_defined(song) && song.isValid();
        this._song = this._song.next();
        return {
            done: !has_song,
            value: has_song ?
            new Song(song, this._db_id, this._session_id, this._url) :
            undefined,
        };
    }
}

export default Items;

// vim: set ts=4 sw=4 tw=80:
