/*
/* (c) 2016 Björn Ricks <bjoern.ricks@gmail.com>
/*
/* See LICENSE comming with the source of daap.js for details.
*/

export class Item {

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

    get name() {
        return this.get('minm');
    }

}

export default Item;

// vim: set ts=4 sw=4 tw=80:
