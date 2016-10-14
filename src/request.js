/*
/* (c) 2016 Björn Ricks <bjoern.ricks@gmail.com>
/*
/* See LICENSE comming with the source of daap.js for details.
*/

import {is_defined} from './utils.js';

export const DEFAULT_TIMEOUT = 10000;

function request(url, {method = 'GET', response_type = 'text',
        timeout = DEFAULT_TIMEOUT, headers}, promise = Promise) {

    return new promise(function(resolve, reject) {
        let xhr = new XMLHttpRequest();

        xhr.open(method.toUpperCase(), url, true);
        xhr.responseType = response_type || 'text';
        xhr.timeout = is_defined(timeout) ? timeout : DEFAULT_TIMEOUT;

        if (headers) {
            for (let name in headers) {
                if (headers.hasOwnProperty(name)) {
                    xhr.setRequestHeader(name, headers[name]);
                }
            }
        }

        xhr.send();

        xhr.onload = function() {
            if (this.status >= 200 && this.status < 300) {
                resolve(this);
            }
            else {
                reject(this);
            }
        };

        xhr.onerror = function() {
            reject(this);
        };

    });
}

export default request;

// vim: set ts=4 sw=4 tw=80:
