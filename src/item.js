/*
/* (c) 2016 Björn Ricks <bjoern.ricks@gmail.com>
/*
/* See LICENSE comming with the source of daap.js for details.
*/

export class Item {

    constructor(data) {
        this._data = data;
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
