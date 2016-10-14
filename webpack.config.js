/*
/* (c) 2016 Björn Ricks <bjoern.ricks@gmail.com>
/*
/* See LICENSE comming with the source of daap.js for details.
*/

module.exports = {
    entry: './src/daap.js',
    output: {
        path: './build',
        pathinfo: true,
        filename: 'daap.bundle.js',
    },
    module: {
        preLoaders: [
            {
                test: /\.js$/,
                loader: 'eslint',
            }
        ],
        loaders: [
            {
                test: /\.jss$/,
                loader: 'babel',
                exclude: /node_modules/,
                query: {
                    cacheDirectory: true,
                },
            },
        ],
    },
};
