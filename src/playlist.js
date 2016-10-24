/*
/* (c) 2016 Björn Ricks <bjoern.ricks@gmail.com>
/*
/* See LICENSE comming with the source of daap.js for details.
*/

import Item from './item.js';

export class Playlist extends Item {

    get persistentId() {
        return this.get('mper');
    }

    get parentId() {
        return this.get('mpco');
    }

    get itemCount() {
        return this.get('mimc');
    }

    isBase() {
        return this.get('abpl') === 1;
    }

    isSmart() {
        return this.get('aeSP') === 1;
    }

    isSpecial() {
        return this.get('aePS') === 1;
    }
}

export default Playlist;

// vim: set ts=4 sw=4 tw=80:
