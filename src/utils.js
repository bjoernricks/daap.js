/*
/* (c) 2016 Björn Ricks <bjoern.ricks@gmail.com>
/*
/* See LICENSE comming with the source of daap.js for details.
*/

export function includes(array, value) {
    if (!is_defined(array)) {
        return false;
    }

    if (Array.prototype.includes) {
        return array.includes(value);
    }
    return array.indexOf(value) !== -1;
}

export function decode_utf8(buffer) {
    var plaintext = '';
    var i = 0;
    var c = 0;
    var c1 = 0;
    var c2 = 0;

    while (i < buffer.length) {
        c = buffer[i];
        if (c < 128) {
            plaintext += String.fromCharCode(c);
            i++;
        }
        else if ((c > 191) && (c < 224)) {
            c1 = buffer[i + 1];
            plaintext += String.fromCharCode(((c & 31) << 6) | (c1 & 63));
            i += 2;
        }
        else {
            c1 = buffer[i + 1];
            c2 = buffer[i + 2];
            plaintext += String.fromCharCode(
                    ((c & 15) << 12) | ((c1 & 63) << 6) | (c2 & 63));
            i += 3;
        }
    }
    return plaintext;
}

export function decode_ascii(buffer) {
    return String.fromCharCode.apply(null, buffer);
}

export function is_defined(value) {
    return value !== undefined;
}

// vim: set ts=4 sw=4 tw=80:
