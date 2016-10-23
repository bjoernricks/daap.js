/*
/* (c) 2016 Björn Ricks <bjoern.ricks@gmail.com>
/*
/* See LICENSE comming with the source of daap.js for details.
*/

import {is_defined} from './utils.js';

import Song from './song.js';

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
