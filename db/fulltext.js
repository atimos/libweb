'use strict';

let Promise = require('../lib/bluebird/bluebird');
let Lunr = require('../lib/lunr.js/lunr', 'es5');

let _cfg = Symbol('cfg'),
	_index = Symbol('index');

export default function() {
	let index_map = new Map(), data_map = new Map();

	return {
		set: function(name, cfg, data = []) {
			data_map.set(name, data);
			index_map.set(name, cfg);
			return this;
		},
		then: (resolve, reject) => {
			return new Promise(resolve => {
				for ( let entry of index_map.entries() ) {
					let [name, cfg] = entry;
					let index = new Index(cfg);

					data_map
						.get(name)
						.forEach(item => {
							index.put(item);
						});

					index_map.set(name, index);
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
		return new Promise(resolve => {
			if ( Array.isArray(items) ) {
				items.forEach(item => {
					this[_index].update(item);
				});
			} else {
				this[_index].update(items);
			}

			resolve(items);
		});
	}

	add(items) {
		return new Promise(resolve => {
			if ( Array.isArray(items) ) {
				items.forEach(item => {
					this[_index].add(item);
				});
			} else {
				this[_index].add(items);
			}

			resolve(items);
		});
	}

	delete(id_list) {
		return new Promise(resolve => {
			let ref = this[_cfg].ref;

			if ( Array.isArray(id_list) ) {
				id_list.forEach(item => {
					this.index.remove({[ref]: id});
				});
			} else {
				this.index.remove({[ref]: id_list});
			}

			resolve(id_list);
		});
	}

	search(query) {
		return Promise.resolve(this[_index].search(query));
	}

	clear() {
		return new Promise(resolve => {
			let cfg = this[_cfg];

			this[_index] = Lunr(function() {
				this.ref(cfg.ref);

				cfg.fields
					.map(field => {
						this.field(field.name, {boost: field.boost||0});
					});
			});

			resolve(this);
		});
	}

	raw_set_data(data) {
		return new Promise(resolve => {
			resolve();
		});
	}

	raw_get_data() {
		return new Promise(resolve => {
			resolve();
		});
	}
}
