/*
/* (c) 2016 Björn Ricks <bjoern.ricks@gmail.com>
/*
/* See LICENSE comming with the source of daap.js for details.
*/

import {is_defined, decode_ascii, decode_utf8} from './utils.js';

const INVALID_OFFSET = -1;

const NAME_LENGTH = 4;
const SIZE_LENGTH = 4;
const HEADER_LENGTH = NAME_LENGTH + SIZE_LENGTH;

function get_uint8(data) {
    return data.isValid() ? data.view.getUint8(data.data_offset) : null;
}

function get_int8(data) {
    return data.isValid() ? data.view.getInt8(data.data_offset) : null;
}

function get_uint16(data) {
    return data.isValid() ? data.view.getUint16(data.data_offset) : null;
}

function get_int16(data) {
    return data.isValid() ? data.view.getInt16(data.data_offset) : null;
}

function get_uint32(data) {
    return data.isValid() ? data.view.getUint32(data.data_offset) : null;
}

function get_int32(data) {
    return data.isValid() ? data.view.getInt32(data.data_offset) : null;
}

/**
    * FIXME
    *
    * JavaScript has no long (64 Bit integer) value. Therefore currently read
    * only the lower 32 Bit
    */
function get_int64(data) {
    return data.isValid() ? data.view.getUint32(data.data_offset + 4) :
        null;
}

const get_uint64 = get_int64;

function get_version(data) {
    if (data.isValid()) {
        var version = new Uint8Array(data.view.buffer, data.data_offset,
                data.length);
        return version.join('.');
    }
    return null;
}

function get_string(data, decode_func = decode_utf8) {
    if (data.isValid()) {
        var buf = new Uint8Array(data.view.buffer, data.data_offset,
                data.length);
        return decode_func(buf);
    }
    return null;
}

export const CONTENT_TYPES = {
    1: get_int8,     // byte
    2: get_uint8,    // unsigned byte
    3: get_int16,    // short
    4: get_uint16,   // unsigned short
    5: get_int32,    // int
    6: get_uint32,   // unsigned int
    7: get_int64,    // long
    8: get_uint64,   // unsinged long
    9: get_string,   // utf-8 string
    10: get_uint32,  // 4 byte int as seconds since 1.1.1970 (UNIX timestamp)
    11: get_version, // represented as 4 single bytes, e.g. 0.1.0.0
    12: null,       // list
};

export const DEFAULT_CONTENT_CODES = {
    apro: get_version, // daap.protocolversion
    mpro: get_version, // dmap.protocolversion
    mlid: get_int32,   // dmap.sessionid
    mstm: get_int32,   // dmap.timeoutinterval
    msdc: get_int32,   // dmap.databasescount
    mslr: get_int8,    // dmap.loginrequired (1 or 0)
    musr: get_int32,   // server revision
    miid: get_int32,   // dmap.itemid
    minm: get_string,  // dmap.itemname
    mimc: get_int32,   // dmap.itemcount
    mctc: get_int32,   // number of playlists in db
    asfm: get_string,  // daap.songformat
    asul: get_string,  // daap.songdataurl
    asal: get_string,  // daap.songalbum
    asar: get_string,  // daap.songartist
    asco: get_int8,    // daap.songcompilation
    asgn: get_string,  // daap.songgenre
    asdt: get_string,  // daap.songdescription
    ascm: get_string,  // daap.songcomment
    asdn: get_int16,   // daap.songdiscnumber
    asdc: get_int16,   // daap.songdisccount
    astn: get_int16,   // daap.songtracknumber
    astc: get_int16,   // daap.songtrackcount
    asbr: get_int16,   // daap.songbitrate
    assz: get_int32,   // daap.songsize
    asyr: get_int16,   // daap.songyear
    astm: get_int32,   // daap.songtime (in ms)
    mper: get_int64,   // dmap.persistentid
    mpco: get_int32,   // dmap.parentcontainerid
    abpl: get_int8,    // daap.baseplaylist (1 or 0)
    aeSP: get_int8,    // com.apple.itunes.smart-playlist (1 or 0)
    aePS: get_int8,    // com.apple.itunes.special-playlist (1 or 0)
    mcnm: get_string,  // dmap.contentcodesnumber the 4 byte codename
    mcna: get_string,  // dmap.contentcodesname the full name of the code
    mcty: get_int16,   // dmap.contentcodestype the type of the code
    mlcl: null,                      // dmap.listing
    mdcl: null,                      // dmap.dictionary
};


export class Data {

    constructor({offset, content_codes, view, buffer}) {
        this.offset = is_defined(offset) ? offset : 0;
        if (this.isValid()) {
            this.content_codes = is_defined(content_codes) ?
                content_codes : DEFAULT_CONTENT_CODES;

            this.view = view ? view : new DataView(buffer);
            this.data_offset = this.offset + HEADER_LENGTH;
            this.length = this.view.getUint32(this.offset + NAME_LENGTH);
            var buf = new Uint8Array(this.view.buffer, this.offset,
                    NAME_LENGTH);
            this.name = decode_ascii(buf);
            this.children = {};
            this.last_offset = this.offset + HEADER_LENGTH;
        }
        else {
            this.length = 0;
            this.last_offset = INVALID_OFFSET;
        }
    }

    isValid() {
        return this.offset >= 0;
    }

    find(name) {
        if (name in this.children) {
            // tag is in cache
            return this.children[name];
        }

        let tag = this.next(this.last_offset);

        while (tag.isValid() && tag.name !== name) {
            this.children[tag.name] = tag;
            this.last_offset = this.last_offset + HEADER_LENGTH + tag.length;
            tag = this.next(this.last_offset);
        }

        if (tag.isValid()) {
            // add found valid tag to cache
            this.children[tag.name] = tag;
        }
        return tag;
    }

    get(name) {
        let func = this.content_codes[name];

        if (!is_defined(func)) {
            throw new Error('Unknown content code ' + name);
        }
        if (func === null) {
            return this.find(name);
        }
        return func(this.find(name));
    }

    getMaxLength() {
        return this.isValid() ? this.view.byteLength : -1;
    }

    next(offset) {
        if (!this.isValid()) {
            return new Data({offset: INVALID_OFFSET});
        }
        if (!is_defined(offset)) {
            offset = this.offset + HEADER_LENGTH + this.length;
        }
        if (offset >= this.getMaxLength()) {
            return new Data({offset: INVALID_OFFSET});
        }
        return new Data({
            view: this.view,
            offset: offset,
            content_codes: this.content_codes
        });
    }
}

// vim: set ts=4 sw=4 tw=80:
