/*
/* (c) 2016 Björn Ricks <bjoern.ricks@gmail.com>
/*
/* See LICENSE comming with the source of daap.js for details.
*/

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

export default Song;

// vim: set ts=2 sw=2 tw=80:
