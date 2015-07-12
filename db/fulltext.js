'use strict';

let Promise = require('../lib/bluebird/bluebird.js'),
	Lunr = require('../lib/lunr.js/lunr.js'),
	Stream = require('../lib/streamjs/stream.js');

let _cfg = Symbol('cfg'),
	_index = Symbol('index');

export default function() {
	let index_map = new Map();

	return {
		set: function(name, cfg) {
			index_map.set(name, cfg);
			return this;
		},
		then: (resolve, reject) => {
			return new Promise(resolve => {
				for ( let [name, cfg] of index_map.entries() ) {
					index_map.set(name, new Index(cfg));
				}

				resolve(index_map);
			}).then(resolve, reject);
		}
	};
}

class Index {
	constructor(cfg) {
		this[_index] = null;
		this[_cfg] = cfg;
		this.clear();
	}

	put(items) {
		return update_index('update', items, this[_index]);
	}

	add(items) {
		return update_index('add', items, this[_index]);
	}

	delete(id_list) {
			let ref = this[_cfg].ref;

			return update_index('remove', id_list.map(id => {
				return {[ref]: id};
			}), this[_index]);
	}

	search(query) {
		return Promise.resolve(Stream(this[_index].search(query)));
	}

	clear() {
		return new Promise(resolve => {
			this[_index] = Lunr(function() {
				this.ref(this[_cfg].ref);

				this[_cfg].fields
					.map(field => {
						this.field(field.name, {boost: field.boost||0});
					});
			});

			resolve(this);
		});
	}

	raw_set_data(data) {
		return new Promise(resolve => {
			this[_index] = Lunr.Index.load(data);
			resolve();
		});
	}

	raw_get_data() {
		return new Promise(resolve => {
			resolve(JSON.parse(JSON.stringify(this[_index])));
		});
	}
}

function update_index(action, data, index) {
		return new Promise((resolve, reject) => {
			let failed = [];

			data.forEach(item => {
				try {
					index[action](item);
				} catch (err) {
					failed.push({data: item, error: err});
				}
			});

			if ( failed.length > 0 ) {
				reject(failed);
			} else {
				resolve();
			}
		});
}
