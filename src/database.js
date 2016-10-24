/*
/* (c) 2016 Björn Ricks <bjoern.ricks@gmail.com>
/*
/* See LICENSE comming with the source of daap.js for details.
*/

import Item from './item.js';

export class Database extends Item {

    get itemCount() {
        return this.get('mimc');
    }

    get playlistCount() {
        return this.get('mctc');
    }
}

export default Database;

// vim: set ts=4 sw=4 tw=80:
