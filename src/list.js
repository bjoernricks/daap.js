/*
/* (c) 2016 Björn Ricks <bjoern.ricks@gmail.com>
/*
/* See LICENSE comming with the source of daap.js for details.
*/

import {is_defined} from './utils.js';

export class List {

    constructor(clazz, data, ...params) {
        this._clazz = clazz;
        this._data = data;
        let items = data.find('mlcl');
        this._item = items.find('mlit');
        this._params = params;
    }

    get length() {
        return this._data.get('mrco');
    }

    get(max) {
        let results = [];

        for (let i = 0; is_defined(this._item) && this._item.isValid() &&
                (!is_defined(max) || i < max); i++) {

            results.push(new this._clazz(this._item, ...this._params));

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
            new this._clazz(item, ...this._params) :
            undefined,
        };
    }
}

export default List;

// vim: set ts=4 sw=4 tw=80:
