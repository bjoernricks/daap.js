/*
/* (c) 2016 Björn Ricks <bjoern.ricks@gmail.com>
/*
/* See LICENSE comming with the source of daap.js for details.
*/

import {is_defined} from './utils.js';
import Item from './item.js';

export class Items {

    constructor(data, db_id, session_id, url, clazz = Item) {
        this._data = data;
        this._db_id = db_id;
        this._session_id = session_id;
        this._url = url;
        let items = data.find('mlcl');
        this._item = items.find('mlit');
        this._clazz = clazz;
    }

    get length() {
        return this._data.get('mrco');
    }

    get(max) {
        let results = [];

        for (let i = 0; is_defined(this._item) && this._item.isValid() &&
                (!is_defined(max) || i < max); i++) {
            results.push(new this.clazz(this._item, this._db_id,
                this._session_id, this._url));
            this._item = this._item.next();
        }

        return results;
    }

    [Symbol.iterator]() {
        return this;
    }

    next() {
        let item = this._item;
        let has_item = is_defined(item) && item.isValid();
        this._item = this._item.next();
        return {
            done: !has_item,
            value: has_item ?
            new this.clazz(item, this._db_id, this._session_id, this._url) :
            undefined,
        };
    }
}

export default Items;

// vim: set ts=4 sw=4 tw=80:
